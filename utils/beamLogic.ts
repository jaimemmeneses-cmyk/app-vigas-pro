import { AppState, AnalysisResults, ReactionResult, EquilibriumCheck, KeyPointResult } from '../types';
import { zeros, clone, solveLinear } from './math';

export class BeamCalculator {
  state: AppState;
  length: number;
  EI: number | null;
  supports: AppState['supports'];
  loads: AppState['loads'];
  results: AnalysisResults;
  
  // Units helpers
  uL: string;
  uF: string;
  uM: string; // Moment unit
  uD: string; // Distributed unit

  constructor(state: AppState) {
    this.state = clone(state);
    this.length = state.beam.length;
    this.EI =
      state.beam.section && state.beam.section.E && state.beam.section.I
        ? state.beam.section.E * state.beam.section.I
        : null;
    this.supports = state.supports.slice();
    this.loads = state.loads.slice();
    this.results = {
      reactions: [],
      x_points: [],
      shear_points: [],
      moment_points: [],
      keyPoints: [],
      log: [],
    };

    // Initialize units for logging
    this.uL = state.meta.units.length;
    this.uF = state.meta.units.force;
    this.uM = `${this.uF}·${this.uL}`;
    this.uD = `${this.uF}/${this.uL}`;
  }

  countUnknowns() {
    let unknowns = 0;
    for (const s of this.supports) {
      if (s.type === 'fixed') unknowns += 2; // Vertical + Moment
      else if (s.type === 'pinned' || s.type === 'roller') unknowns += 1; // Vertical only
    }
    return unknowns;
  }

  solveReactions({ useFEM = false } = {}): AnalysisResults {
    this.results.reactions = [];
    this.results.log = [];
    const unknowns = this.countUnknowns();

    this.results.log.push('### REPORTE DE ANÁLISIS ESTRUCTURAL ###');
    this.results.log.push(`Fecha: ${new Date().toLocaleString()}`);
    this.results.log.push(`Unidades: Longitud [${this.uL}], Fuerza [${this.uF}]`);
    this.results.log.push(`Longitud de la Viga: ${this.length} ${this.uL}`);
    this.results.log.push(
      `Apoyos: ${this.supports.length} | Incógnitas: ${unknowns}`
    );
    this.results.log.push('--------------------------------------------------');

    let solved = false;

    // 1. Isostatic Attempt (Equilibrium Equations)
    if (unknowns <= 2) {
      try {
        this.results.log.push(
          'MÉTODO: Ecuaciones de Equilibrio Estático (Isostático)'
        );
        this.solveEquilibrium();
        solved = true;
      } catch (e) {
        console.warn('Isostatic method failed, trying FEM...', e);
        this.results.log.push('El solucionador isostático falló o es inestable. Cambiando a FEM.');
      }
    }

    // 2. Hyperstatic Attempt (FEM)
    if (!solved) {
      if (useFEM && this.EI) {
        this.results.log.push(
          'MÉTODO: Matriz de Rigidez (Elementos Finitos - FEM)'
        );
        this.results.log.push(
          `Propiedades: E=${this.state.beam.section.E}, I=${this.state.beam.section.I} -> EI=${this.EI}`
        );
        this.solveHyperstaticFEM();
        solved = true;
      } else {
        this.results.log.push(
          'ERROR: Sistema hiperestático detectado sin propiedades E/I o modo FEM desactivado.'
        );
        throw new Error(
          "Sistema hiperestático. Por favor active 'Modo Avanzado FEM' y proporcione Módulo de Young (E) e Inercia (I)."
        );
      }
    }

    this.generateFinalReport();
    this.buildPlotArrays(100);
    this.calculateKeyPoints(); // Generate the table data
    return this.results;
  }

  solveEquilibrium() {
    const totalLoad = this.loads.reduce(
      (acc, L) =>
        L.type === 'point'
          ? acc + (L.magnitude || 0)
          : L.type === 'udl'
          ? acc + (L.w || 0) * ((L.x_end || 0) - (L.x_start || 0))
          : acc,
      0
    );
    this.results.log.push(
      `Carga Vertical Total Aplicada: ${totalLoad.toFixed(3)} ${this.uF}`
    );

    const dofs: { id: string; x: number; comp: 'Ry' | 'M' }[] = [];
    for (const s of this.supports) {
      if (s.type === 'fixed') {
        dofs.push({ id: s.id, x: s.x, comp: 'Ry' });
        dofs.push({ id: s.id, x: s.x, comp: 'M' });
      } else {
        dofs.push({ id: s.id, x: s.x, comp: 'Ry' });
      }
    }

    const n = dofs.length;
    // Need at least 1 support usually, but strictly for code stability:
    if (n === 0) return; 

    const A = zeros(n, n);
    const b = zeros(n);

    // Moment points: x=0 and if needed x=L
    const eqPoints = [0];
    if (n >= 2) eqPoints.push(this.length);

    for (let i = 0; i < n; i++) {
      const refX = eqPoints[i] ?? eqPoints[eqPoints.length - 1];
      
      // Fill Matrix A
      for (let j = 0; j < n; j++) {
        const dof = dofs[j];
        if (dof.comp === 'Ry') {
          if (i === 0) A[i][j] = 1.0;
          else A[i][j] = dof.x - refX;
        } else if (dof.comp === 'M') {
          A[i][j] = i === 0 ? 0 : 1.0;
        }
      }

      // Fill Vector b (External Loads)
      if (i === 0) {
        // ΣFy
        const sumF = this.loads.reduce((acc, L) => {
          if (L.type === 'point') return acc + (L.magnitude || 0);
          if (L.type === 'udl')
            return acc + (L.w || 0) * ((L.x_end || 0) - (L.x_start || 0));
          return acc;
        }, 0);
        b[i] = -sumF;
      } else {
        // ΣM
        let mExt = 0;
        for (const L of this.loads) {
          if (L.type === 'point')
            mExt += (L.magnitude || 0) * ((L.x || 0) - refX);
          else if (L.type === 'udl') {
            const len = (L.x_end || 0) - (L.x_start || 0);
            const totalW = (L.w || 0) * len;
            const centroid = (L.x_start || 0) + len / 2;
            mExt += totalW * (centroid - refX);
          } else if (L.type === 'moment') mExt += L.magnitude || 0;
        }
        b[i] = -mExt;
      }
    }

    const sol = solveLinear(A, b);

    const reactions: ReactionResult[] = this.supports.map((s) => ({
      supportId: s.id,
      x: s.x,
      Ry: 0,
      M: 0,
    }));
    for (let j = 0; j < n; j++) {
      const dof = dofs[j];
      const idx = reactions.findIndex((r) => r.supportId === dof.id);
      if (dof.comp === 'Ry') reactions[idx].Ry = sol[j];
      else reactions[idx].M = sol[j];
    }
    this.results.reactions = reactions;
    this.results.checks = this.verifyEquilibrium();
  }

  solveHyperstaticFEM() {
    const events = new Set([0, this.length]);
    for (const s of this.supports) events.add(s.x);
    for (const L of this.loads) {
      if (L.type === 'point') events.add(L.x!);
      if (L.type === 'udl') {
        events.add(L.x_start!);
        events.add(L.x_end!);
      }
      if (L.type === 'moment') events.add(L.x!);
    }
    const nodes = Array.from(events).sort((a, b) => a - b);
    const nNodes = nodes.length;
    const ndof = 2 * nNodes;

    const K = zeros(ndof, ndof);
    const F = zeros(ndof);

    if (!this.EI) throw new Error("EI is undefined for FEM");

    for (let e = 0; e < nNodes - 1; e++) {
      const x1 = nodes[e];
      const x2 = nodes[e + 1];
      const L = x2 - x1;
      if (L <= 1e-9) continue;

      const kFactor = this.EI / (L * L * L);
      const kLocal = [
        [12, 6 * L, -12, 6 * L],
        [6 * L, 4 * L * L, -6 * L, 2 * L * L],
        [-12, -6 * L, 12, -6 * L],
        [6 * L, 2 * L * L, -6 * L, 4 * L * L],
      ].map((row) => row.map((v) => v * kFactor));

      const dofMap = [2 * e, 2 * e + 1, 2 * (e + 1), 2 * (e + 1) + 1];

      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++)
          K[dofMap[i]][dofMap[j]] += kLocal[i][j];

      // Equivalent Nodal Loads for UDL
      const udls = this.loads.filter((Ld) => Ld.type === 'udl');
      for (const udl of udls) {
        const a = Math.max(udl.x_start!, x1);
        const b = Math.min(udl.x_end!, x2);
        const overlap = b - a;
        if (overlap > 1e-9) {
            // Simplified for full coverage of element (nodes were split at udl start/end)
            const w = udl.w!;
            const fe = [
                (w * L) / 2,
                (w * L * L) / 12,
                (w * L) / 2,
                (-w * L * L) / 12,
            ];
            for (let i = 0; i < 4; i++) F[dofMap[i]] += fe[i];
        }
      }
    }

    // Point loads
    this.loads.forEach((L) => {
      if (L.type === 'point' || L.type === 'moment') {
        const nodeIdx = nodes.findIndex((n) => Math.abs(n - L.x!) < 1e-9);
        if (nodeIdx !== -1) {
          if (L.type === 'point') F[2 * nodeIdx] += L.magnitude!;
          if (L.type === 'moment') F[2 * nodeIdx + 1] += L.magnitude!;
        }
      }
    });

    // Boundary Conditions
    const constrained: Record<number, number> = {};
    this.supports.forEach((s) => {
      const idx = nodes.findIndex((n) => Math.abs(n - s.x) < 1e-9);
      if (idx !== -1) {
        if (s.type === 'fixed') {
          constrained[2 * idx] = 0;
          constrained[2 * idx + 1] = 0;
        } else {
          constrained[2 * idx] = 0; // pinned/roller dy=0
        }
      }
    });

    const freeDofs: number[] = [];
    for (let i = 0; i < ndof; i++) if (!(i in constrained)) freeDofs.push(i);

    const Krr = zeros(freeDofs.length, freeDofs.length);
    const Fr = zeros(freeDofs.length);

    for (let i = 0; i < freeDofs.length; i++) {
      Fr[i] = F[freeDofs[i]];
      for (let j = 0; j < freeDofs.length; j++) {
        Krr[i][j] = K[freeDofs[i]][freeDofs[j]];
      }
    }

    let ur: number[];
    try {
      ur = solveLinear(Krr, Fr);
    } catch (e: any) {
      throw new Error('Error resolviendo FEM: ' + e.message);
    }

    const u = zeros(ndof);
    freeDofs.forEach((dof, i) => (u[dof] = ur[i]));

    // Calculate Reactions
    const Ku = zeros(ndof);
    for (let i = 0; i < ndof; i++)
      for (let j = 0; j < ndof; j++) Ku[i] += K[i][j] * u[j];

    const R = zeros(ndof);
    for (let i = 0; i < ndof; i++) R[i] = Ku[i] - F[i];

    const reactions: ReactionResult[] = this.supports.map((s) => ({
      supportId: s.id,
      x: s.x,
      Ry: 0,
      M: 0,
    }));
    this.supports.forEach((s, i) => {
      const idx = nodes.findIndex((n) => Math.abs(n - s.x) < 1e-9);
      if (idx !== -1) {
        reactions[i].Ry = R[2 * idx];
        if (s.type === 'fixed') reactions[i].M = R[2 * idx + 1];
      }
    });

    this.results.reactions = reactions;
    this.results.checks = this.verifyEquilibrium();
  }

  generateFinalReport() {
    this.results.log.push('\nRESULTADOS DE REACCIONES:');
    this.results.reactions.forEach((r) => {
      const mText =
        Math.abs(r.M) > 0.001 ? `, Momento M = ${r.M.toFixed(3)} ${this.uM}` : '';
      this.results.log.push(
        `   > Apoyo ${r.supportId} (x=${r.x}${this.uL}): Ry = ${r.Ry.toFixed(
          3
        )} ${this.uF}${mText}`
      );
    });

    this.results.log.push('\nCOMPROBACIÓN DE EQUILIBRIO GLOBAL:');
    const chk = this.verifyEquilibrium();
    this.results.log.push(
      `   > Sumatoria Fy: ${chk.sumFy.toFixed(4)} ${this.uF} ${
        Math.abs(chk.sumFy) < 0.01 ? '✅' : '⚠️'
      }`
    );
    this.results.log.push(
      `   > Sumatoria M:  ${chk.sumM.toFixed(4)} ${this.uM} ${
        Math.abs(chk.sumM) < 0.01 ? '✅' : '⚠️'
      }`
    );
  }

  verifyEquilibrium(): EquilibriumCheck {
    const sumReactions = this.results.reactions.reduce((acc, r) => acc + r.Ry, 0);
    const sumLoads = this.loads.reduce((acc, L) => {
      if (L.type === 'point') return acc + (L.magnitude || 0);
      if (L.type === 'udl')
        return acc + (L.w || 0) * ((L.x_end || 0) - (L.x_start || 0));
      return acc;
    }, 0);
    const sumFy = sumReactions + sumLoads;

    const sumMomReactions = this.results.reactions.reduce(
      (acc, r) => acc + r.Ry * r.x + r.M,
      0
    );
    const sumMomLoads = this.loads.reduce((acc, L) => {
      if (L.type === 'point') return acc + (L.magnitude || 0) * (L.x || 0);
      if (L.type === 'udl') {
        const len = (L.x_end || 0) - (L.x_start || 0);
        return acc + (L.w || 0) * len * ((L.x_start || 0) + len / 2);
      }
      if (L.type === 'moment') return acc + (L.magnitude || 0);
      return acc;
    }, 0);
    const sumM = sumMomReactions + sumMomLoads;

    return { sumFy, sumM };
  }

  getInternalForces(x: number, side: 'left' | 'right' | 'mid' = 'mid') {
    const xp =
      side === 'left' ? x - 1e-9 : side === 'right' ? x + 1e-9 : x;
    let V = 0,
      M = 0;

    for (const r of this.results.reactions) {
      if (r.x < xp) {
        V += r.Ry;
        M += r.Ry * (xp - r.x) + r.M;
      }
    }

    for (const L of this.loads) {
      if (L.type === 'point') {
        if ((L.x || 0) < xp) {
          V += L.magnitude || 0;
          M += (L.magnitude || 0) * (xp - (L.x || 0));
        } else if (
          Math.abs((L.x || 0) - x) < 1e-6 &&
          side === 'right'
        ) {
          V += L.magnitude || 0;
        }
      } else if (L.type === 'udl') {
        const a = L.x_start || 0;
        if (xp > a) {
          const effEnd = Math.min(xp, L.x_end || 0);
          const len = effEnd - a;
          const loadMag = (L.w || 0) * len;
          V += loadMag;
          const centroid = a + len / 2;
          M += loadMag * (xp - centroid);
        }
      } else if (L.type === 'moment') {
        if ((L.x || 0) < xp) M += L.magnitude || 0;
        else if (
          Math.abs((L.x || 0) - x) < 1e-6 &&
          side === 'right'
        )
          M += L.magnitude || 0;
      }
    }
    return { V, M };
  }

  calculateKeyPoints() {
    const events = new Set([0, this.length]);
    const descriptions: Record<number, string[]> = {};
    const addDesc = (x: number, d: string) => {
      const k = Math.round(x * 1000) / 1000; // soft quantize key
      if (!descriptions[k]) descriptions[k] = [];
      if(!descriptions[k].includes(d)) descriptions[k].push(d);
    };

    addDesc(0, "Inicio");
    addDesc(this.length, "Fin");

    for (const s of this.supports) {
      events.add(s.x);
      addDesc(s.x, `Apoyo ${s.id}`);
    }
    for (const L of this.loads) {
      if (L.type === 'point') {
        events.add(L.x || 0);
        addDesc(L.x || 0, `Carga ${L.id}`);
      }
      if (L.type === 'udl') {
        events.add(L.x_start || 0);
        events.add(L.x_end || 0);
        addDesc(L.x_start || 0, `UDL ${L.id} Inicio`);
        addDesc(L.x_end || 0, `UDL ${L.id} Fin`);
      }
      if (L.type === 'moment') {
        events.add(L.x || 0);
        addDesc(L.x || 0, `Momento ${L.id}`);
      }
    }

    const sortedEvents = Array.from(events).sort((a, b) => a - b);
    const keyResults: KeyPointResult[] = [];

    for (const x of sortedEvents) {
      const left = this.getInternalForces(x, 'left');
      const right = this.getInternalForces(x, 'right');
      
      // Get descriptions for this x (fuzzy match)
      const key = Object.keys(descriptions).find(k => Math.abs(parseFloat(k) - x) < 1e-4);
      const desc = key ? descriptions[parseFloat(key)].join(", ") : "";

      keyResults.push({
        x: x,
        shearLeft: left.V,
        shearRight: right.V,
        momentLeft: left.M,
        momentRight: right.M,
        description: desc
      });
    }
    this.results.keyPoints = keyResults;
  }

  buildPlotArrays(samplesPerSegment = 20) {
    const events = new Set([0, this.length]);
    for (const s of this.supports) events.add(s.x);
    for (const L of this.loads) {
      if (L.type === 'point') events.add(L.x || 0);
      if (L.type === 'udl') {
        events.add(L.x_start || 0);
        events.add(L.x_end || 0);
      }
      if (L.type === 'moment') events.add(L.x || 0);
    }
    const ev = Array.from(events).sort((a, b) => a - b);

    const x_points: number[] = [];
    const shear_points: number[] = [];
    const moment_points: number[] = [];

    for (let i = 0; i < ev.length - 1; i++) {
      const a = ev[i],
        b = ev[i + 1];

      const points = [a];
      if (
        this.loads.some(
          (l) => l.type === 'point' && Math.abs((l.x || 0) - a) < 1e-9
        )
      )
        points.push(a + 1e-9);

      for (let k = 1; k <= samplesPerSegment; k++)
        points.push(a + (b - a) * (k / (samplesPerSegment + 1)));

      if (
        this.loads.some(
          (l) => l.type === 'point' && Math.abs((l.x || 0) - b) < 1e-9
        )
      )
        points.push(b - 1e-9);
      points.push(b);

      points.forEach((x) => {
        if (x >= 0 && x <= this.length) {
          const res = this.getInternalForces(x, 'left');
          x_points.push(x);
          shear_points.push(res.V);
          moment_points.push(res.M);
        }
      });
    }

    const finalX: number[] = [],
      finalV: number[] = [],
      finalM: number[] = [];

    if (x_points.length > 0) {
      finalX.push(x_points[0]);
      finalV.push(shear_points[0]);
      finalM.push(moment_points[0]);
      for (let i = 1; i < x_points.length; i++) {
        const diff = x_points[i] - x_points[i - 1];
        if (
          diff > 1e-9 ||
          (diff < 1e-9 &&
            Math.abs(shear_points[i] - shear_points[i - 1]) > 1e-3)
        ) {
          finalX.push(x_points[i]);
          finalV.push(shear_points[i]);
          finalM.push(moment_points[i]);
        }
      }
    }

    this.results.x_points = finalX;
    this.results.shear_points = finalV;
    this.results.moment_points = finalM;

    let maxM = -Infinity,
      maxM_x = 0;
    finalM.forEach((m, i) => {
      if (Math.abs(m) > maxM) {
        maxM = Math.abs(m);
        maxM_x = finalX[i];
      }
    });
    this.results.peaks = { maxMoment: { x: maxM_x, value: maxM } };
  }
}