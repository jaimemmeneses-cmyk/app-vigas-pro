import React, { useState, useEffect, useRef } from 'react';
import { BeamCalculator } from './utils/beamLogic';
import { BeamVisualizer } from './components/BeamVisualizer';
import { ResultsCharts } from './components/ResultsCharts';
import { GeminiAssistant } from './components/GeminiAssistant';
import { AppState, LoadType } from './types';
import { Plus, Trash2, Play, Settings, Bot, X, Printer, Image, ArrowDown, ArrowUp, RotateCcw, RotateCw, Info, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const initialState: AppState = {
  meta: { units: { length: 'm', force: 'kN' } },
  beam: { length: 10.0, section: { I: 8.5e-5, E: 210000.0 } },
  supports: [
    { id: 'S1', x: 0.0, type: 'pinned' },
    { id: 'S2', x: 10.0, type: 'roller' },
  ],
  loads: [
    { id: 'L1', type: 'point', magnitude: -20.0, x: 5.0 },
    { id: 'L2', type: 'udl', w: -2.0, x_start: 0.0, x_end: 4.0 },
  ],
  results: {
    reactions: [],
    x_points: [],
    shear_points: [],
    moment_points: [],
    keyPoints: [],
    log: [],
  },
};

export default function App() {
  // 1. ESTADO CON MEMORIA (Auto-Guardado)
  const [state, setState] = useState<AppState>(() => {
    const savedData = localStorage.getItem('beam_app_pro_v1');
    if (savedData) {
      try { return JSON.parse(savedData); } catch (e) { console.error(e); }
    }
    return initialState;
  });

  // 2. EFECTO PARA GUARDAR
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('beam_app_pro_v1', JSON.stringify(state));
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  const [useFEM, setUseFEM] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Derived Units
  const uL = state.meta.units.length;
  const uF = state.meta.units.force;
  const uM = `${uF}·${uL}`;
  const uD = `${uF}/${uL}`;

  // --- Actions ---
  
  const handleReset = () => {
    if (window.confirm('¿Quieres borrar todo y empezar un ejercicio nuevo?')) {
      setState(initialState);
      localStorage.removeItem('beam_app_pro_v1');
      window.location.reload();
    }
  };

  const updateUnit = (key: 'length' | 'force', val: string) => {
      setState(prev => ({
          ...prev,
          meta: { ...prev.meta, units: { ...prev.meta.units, [key]: val } }
      }));
  };

  const updateBeam = (key: keyof AppState['beam'], val: any) => {
    setState((prev) => ({ ...prev, beam: { ...prev.beam, [key]: val } }));
  };

    const addSupport = () => {
        // --- RESTRICCIÓN GRATUITA ---
        if (state.supports.length >= 2) {
            alert("🔒 LÍMITE DE LA VERSIÓN GRATUITA\n\nSolo se permiten 2 apoyos (Vigas Isostáticas Simples).\n\nPara calcular vigas continuas (3+ apoyos), adquiere la Versión PRO.");
            return;
        }
        // ----------------------------

        setState((prev) => ({
            ...prev,
            supports: [
                ...prev.supports,
                { id: `S${Date.now()}`, x: prev.beam.length / 2, type: 'pinned' },
            ],
        }));
    };

  const updateSupport = (id: string, key: string, val: any) => {
    setState((prev) => ({
      ...prev,
      supports: prev.supports.map((s) =>
        s.id === id ? { ...s, [key]: val } : s
      ),
    }));
  };

  const removeSupport = (id: string) => {
    setState((prev) => ({
      ...prev,
      supports: prev.supports.filter((s) => s.id !== id),
    }));
  };

    const addLoad = (type: LoadType) => {
        // --- RESTRICCIÓN GRATUITA ---
        if (type !== 'point') {
            alert("🔒 CARACTERÍSTICA PRO\n\nLas Cargas Distribuidas y Momentos solo están disponibles en la versión VIP.\n\nEn esta versión gratuita solo puedes usar Cargas Puntuales.");
            return;
        }

        if (state.loads.length >= 2) {
            alert("🔒 LÍMITE ALCANZADO\n\nLa versión gratuita permite máximo 2 cargas.\n\nPara agregar cargas ilimitadas, adquiere la versión PRO.");
            return;
        }
        // ----------------------------

        setState((prev) => ({
            ...prev,
            loads: [
                ...prev.loads,
                {
                    id: `L${Date.now()}`,
                    type,
                    magnitude: -10,
                    w: -5,
                    x: prev.beam.length / 2,
                    x_start: 0,
                    x_end: 2,
                },
            ],
        }));
    };

  const updateLoad = (id: string, key: string, val: any) => {
    setState((prev) => ({
      ...prev,
      loads: prev.loads.map((l) => (l.id === id ? { ...l, [key]: val } : l)),
    }));
  };

  const removeLoad = (id: string) => {
    setState((prev) => ({
      ...prev,
      loads: prev.loads.filter((l) => l.id !== id),
    }));
  };

  const runAnalysis = () => {
    try {
      setError(null);
      const calc = new BeamCalculator(state);
      const results = calc.solveReactions({ useFEM });
      setState((prev) => ({ ...prev, results }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Helper for Gemini to inject state
  const handleGeminiUpdate = (newConfig: Partial<AppState>) => {
      setState(prev => {
          const next = { ...prev, ...newConfig };
          if(newConfig.beam && !newConfig.beam.section) {
              next.beam.section = prev.beam.section;
          }
          return next;
      });
  };

    const handleExportPDF = async () => {
        // --- BLOQUEO PRO ---
        alert("🔒 EXPORTACIÓN BLOQUEADA\n\nGenerar reportes PDF profesionales es una función exclusiva de la Versión PRO.");
        return;
        // -------------------

        // (El código original sigue abajo, pero nunca se ejecutará)
        if (!reportRef.current || isGeneratingPdf) return;
        // ...
    };

    const handleExportPNG = async () => {
        // --- BLOQUEO PRO ---
        alert("🔒 EXPORTACIÓN BLOQUEADA\n\nLa descarga de imágenes HD está reservada para usuarios PRO.");
        return;
        // -------------------

        if (reportRef.current) {
            // ...
        }
    };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-slate-800 font-sans relative">
      
      {/* --- Main Content Area --- */}
      <div className={clsx("flex-1 flex flex-col transition-all duration-300 print:w-full", showAssistant ? "mr-0 md:mr-80 lg:mr-96" : "")}>
        
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm no-print">
          <div className="flex items-center gap-3">
             <button 
               onClick={handleReset}
               className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg transition-colors border border-gray-200"
               title="Reiniciar ejercicio (Borrar memoria)"
             >
                <RotateCcw className="w-5 h-5" />
             </button>

             <div className="bg-blue-600 text-white p-2 rounded-lg">
                <Settings className="w-5 h-5" />
             </div>
             <div>
                <h1 className="text-xl font-bold text-gray-900">Calculadora de Vigas Pro</h1>
                <p className="text-xs text-gray-500">Impulsado por Gemini AI</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
                onClick={handleExportPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Descargar PDF"
            >
                {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                {isGeneratingPdf ? 'Generando...' : 'PDF'}
            </button>
             <button 
                onClick={handleExportPNG}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                title="Exportar como PNG"
            >
                <Image className="w-4 h-4" /> PNG
            </button>

            <div className="h-6 w-px bg-gray-300 mx-1"></div>

            <button 
                onClick={runAnalysis}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
            >
                <Play className="w-4 h-4" /> Calcular
            </button>
            <button
                onClick={() => setShowAssistant(!showAssistant)}
                className={clsx("p-2.5 rounded-lg border transition-colors", showAssistant ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50")}
            >
                {showAssistant ? <X className="w-5 h-5"/> : <Bot className="w-5 h-5"/>}
            </button>
          </div>
        </header>

        <main className="p-6 max-w-7xl mx-auto w-full grid grid-cols-1 xl:grid-cols-3 gap-6 print:block">
          
          {/* --- Left Column: Configuration --- */}
          <div className="xl:col-span-1 space-y-6 no-print">
            
            {/* Unit Configuration */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                 Unidades
              </h2>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 uppercase">Longitud</label>
                    <select 
                        value={state.meta.units.length} 
                        onChange={(e) => updateUnit('length', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="m">m (Metros)</option>
                        <option value="cm">cm (Centímetros)</option>
                        <option value="mm">mm (Milímetros)</option>
                        <option value="ft">ft (Pies)</option>
                        <option value="in">in (Pulgadas)</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 uppercase">Fuerza</label>
                    <select 
                        value={state.meta.units.force} 
                        onChange={(e) => updateUnit('force', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="kN">kN (Kilonewton)</option>
                        <option value="N">N (Newton)</option>
                        <option value="kgf">kgf (Kilogramo-fuerza)</option>
                        <option value="lb">lb (Libras)</option>
                        <option value="kip">kip (Kilopounds)</option>
                    </select>
                 </div>
              </div>
            </section>

            {/* Beam Config */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                 Configuración de Viga
              </h2>
              <div className="space-y-4">
                <div>
                   <label className="block text-sm font-medium text-gray-600 mb-1">Longitud Total ({uL})</label>
                   <input 
                      type="number" 
                      value={state.beam.length} 
                      onChange={(e) => updateBeam('length', parseFloat(e.target.value))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                   />
                </div>
                
                <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-md">
                    <input 
                        type="checkbox" 
                        id="useFEM"
                        checked={useFEM}
                        onChange={(e) => setUseFEM(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="useFEM" className="text-sm text-blue-800 font-medium cursor-pointer">
                        Activar FEM Avanzado
                    </label>
                </div>
              </div>
            </section>

            {/* Supports */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
               <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-semibold text-gray-800">Apoyos</h2>
                 <button onClick={addSupport} className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"><Plus className="w-5 h-5"/></button>
               </div>
               <div className="space-y-3">
                  {state.supports.map((s, idx) => (
                      <div key={s.id} className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <span className="text-xs font-bold text-gray-400 w-6">S{idx+1}</span>
                          <select 
                            value={s.type} 
                            onChange={(e) => updateSupport(s.id, 'type', e.target.value)}
                            className="bg-white border border-gray-300 text-sm rounded px-2 py-1 focus:ring-2 focus:ring-blue-200 outline-none"
                          >
                             <option value="pinned">Articulado</option>
                             <option value="roller">Rodillo</option> 
                          </select>
                          <div className="flex items-center gap-1 flex-1">
                              <span className="text-xs text-gray-500">en</span>
                              <input 
                                type="number" 
                                value={s.x}
                                onChange={(e) => updateSupport(s.id, 'x', parseFloat(e.target.value))}
                                className="w-16 text-sm border border-gray-300 rounded px-2 py-1 text-center"
                              />
                              <span className="text-xs text-gray-500">{uL}</span>
                          </div>
                          <button onClick={() => removeSupport(s.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                      </div>
                  ))}
               </div>
            </section>

            {/* Loads */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
               <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-semibold text-gray-800">Cargas</h2>
                 <div className="flex gap-1">
                    <button onClick={() => addLoad('point')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 font-medium">Puntual</button>
                    <button onClick={() => addLoad('udl')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 font-medium">Distr.</button>
                    <button onClick={() => addLoad('moment')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 font-medium">Momento</button>
                 </div>
               </div>
               <div className="space-y-3">
                  {state.loads.map((L, idx) => (
                      <div key={L.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 relative group">
                          <button onClick={() => removeLoad(L.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3"/></button>
                          
                          <div className="flex items-center gap-2 mb-2">
                             <span className="text-xs font-bold text-gray-400">L{idx+1}</span>
                             <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 bg-blue-100 px-1.5 rounded">{L.type === 'point' ? 'Puntual' : L.type === 'udl' ? 'Distr.' : 'Momento'}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                             {/* Magnitude */}
                             {L.type !== 'udl' ? (
                                 <div className="flex flex-col">
                                    <label className="text-[10px] text-gray-500 uppercase">Magnitud {L.type === 'moment' ? `(${uM})` : `(${uF})`}</label>
                                    <input type="number" value={L.magnitude} onChange={(e) => updateLoad(L.id, 'magnitude', parseFloat(e.target.value))} className="text-sm border border-gray-300 rounded px-2 py-1"/>
                                 </div>
                             ) : (
                                 <div className="flex flex-col">
                                    <label className="text-[10px] text-gray-500 uppercase">Carga ({uD})</label>
                                    <input type="number" value={L.w} onChange={(e) => updateLoad(L.id, 'w', parseFloat(e.target.value))} className="text-sm border border-gray-300 rounded px-2 py-1"/>
                                 </div>
                             )}

                             {/* Position */}
                             {L.type !== 'udl' ? (
                                 <div className="flex flex-col">
                                    <label className="text-[10px] text-gray-500 uppercase">Posición ({uL})</label>
                                    <input type="number" value={L.x} onChange={(e) => updateLoad(L.id, 'x', parseFloat(e.target.value))} className="text-sm border border-gray-300 rounded px-2 py-1"/>
                                 </div>
                             ) : (
                                 <div className="flex flex-col col-span-2">
                                     <label className="text-[10px] text-gray-500 uppercase">Rango ({uL})</label>
                                     <div className="flex gap-2 items-center">
                                         <input type="number" value={L.x_start} onChange={(e) => updateLoad(L.id, 'x_start', parseFloat(e.target.value))} className="w-full text-sm border border-gray-300 rounded px-2 py-1" placeholder="Inicio"/>
                                         <span className="text-gray-400 text-xs">a</span>
                                         <input type="number" value={L.x_end} onChange={(e) => updateLoad(L.id, 'x_end', parseFloat(e.target.value))} className="w-full text-sm border border-gray-300 rounded px-2 py-1" placeholder="Fin"/>
                                     </div>
                                 </div>
                             )}
                          </div>
                      </div>
                  ))}
               </div>
            </section>
          </div>

          {/* --- Center/Right: Results --- */}
          <div ref={reportRef} className="xl:col-span-2 space-y-6 print:col-span-3 print:w-full print:block bg-white p-2 md:p-0">
             
             {/* SIGN CONVENTION SECTION */}
             <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm print-break-inside-avoid">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
                  <Info className="w-5 h-5 text-slate-600" />
                  <h3 className="font-bold text-slate-800">Convención de Signos</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Case 1: Left Cut */}
                  <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-slate-100">
                     <div className="flex flex-col items-center gap-1 min-w-[30px]">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 rounded">V</span>
                        <ArrowDown className="w-4 h-4 text-red-500" />
                        <span className="text-[10px] text-red-500 font-bold">(-)</span>
                     </div>
                     <div className="flex flex-col items-center gap-1 min-w-[30px] border-l pl-2 border-slate-100">
                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-1.5 rounded">M</span>
                        <RotateCcw className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] text-emerald-500 font-bold">(+)</span>
                     </div>
                     <div className="text-sm text-slate-600 ml-2">
                        <span className="font-semibold block text-slate-800">Corte Izquierdo</span>
                        (Mirando a la Izquierda): Cortante hacia abajo es negativo. Momento antihorario es positivo ({uM}).
                     </div>
                  </div>

                  {/* Case 2: Right Cut */}
                  <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-slate-100">
                     <div className="flex flex-col items-center gap-1 min-w-[30px]">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 rounded">V</span>
                        <ArrowUp className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] text-emerald-500 font-bold">(+)</span>
                     </div>
                     <div className="flex flex-col items-center gap-1 min-w-[30px] border-l pl-2 border-slate-100">
                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-1.5 rounded">M</span>
                        <RotateCw className="w-4 h-4 text-red-500" />
                        <span className="text-[10px] text-red-500 font-bold">(-)</span>
                     </div>
                     <div className="text-sm text-slate-600 ml-2">
                        <span className="font-semibold block text-slate-800">Corte Derecho</span>
                        (Mirando a la Derecha): Cortante hacia arriba es positivo. Momento horario es negativo ({uM}).
                     </div>
                  </div>
                </div>
             </section>

             {/* Error Banner */}
             {error && (
                 <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm no-print">
                    <p className="text-red-700 font-medium">Error de Análisis</p>
                    <p className="text-red-600 text-sm">{error}</p>
                 </div>
             )}

             {/* System Diagram */}
             <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 print-break-inside-avoid">
                <h3 className="text-gray-700 font-medium mb-4">Diagrama del Sistema</h3>
                <BeamVisualizer state={state} units={state.meta.units} />
             </section>

             {/* Charts */}
             {state.results.x_points.length > 0 && (
                 <>
                    <div className="print-break-inside-avoid">
                        <ResultsCharts results={state.results} length={state.beam.length} units={state.meta.units} />
                    </div>

                     {/* Key Points Table */}
                     {state.results.keyPoints && state.results.keyPoints.length > 0 && (
                        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print-break-inside-avoid">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-semibold text-gray-800">Fuerzas Internas en Puntos Clave</h3>
                                <p className="text-xs text-gray-500 mt-1">Calculado en apoyos, cargas y discontinuidades.</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white text-gray-500 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Posición (x)</th>
                                            <th className="px-6 py-3 font-medium">Nota/Elemento</th>
                                            <th className="px-6 py-3 font-medium">Cortante Izq. ({uF})</th>
                                            <th className="px-6 py-3 font-medium">Cortante Der. ({uF})</th>
                                            <th className="px-6 py-3 font-medium">Momento ({uM})</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {state.results.keyPoints.map((pt, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-3 font-mono font-medium text-gray-900">{pt.x.toFixed(3)} {uL}</td>
                                                <td className="px-6 py-3 text-gray-600">{pt.description}</td>
                                                <td className="px-6 py-3 text-gray-600">{pt.shearLeft.toFixed(3)}</td>
                                                <td className="px-6 py-3 text-gray-600">{pt.shearRight.toFixed(3)}</td>
                                                <td className="px-6 py-3 font-bold text-violet-700">{pt.momentLeft.toFixed(3)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                     )}

                     {/* Reactions Table */}
                     {state.results.reactions.length > 0 && (
                         <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print-break-inside-avoid">
                             <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-semibold text-gray-800">Reacciones en Apoyos</h3>
                             </div>
                             <table className="w-full text-sm text-left">
                                 <thead className="bg-white text-gray-500 border-b border-gray-100">
                                     <tr>
                                         <th className="px-6 py-3 font-medium">Apoyo</th>
                                         <th className="px-6 py-3 font-medium">Posición</th>
                                         <th className="px-6 py-3 font-medium">Fuerza Vertical (Ry)</th>
                                         <th className="px-6 py-3 font-medium">Momento (M)</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100">
                                     {state.results.reactions.map(r => (
                                         <tr key={r.supportId} className="hover:bg-gray-50">
                                             <td className="px-6 py-3 font-medium text-gray-900">{r.supportId}</td>
                                             <td className="px-6 py-3 text-gray-600">{r.x} {uL}</td>
                                             <td className="px-6 py-3 text-emerald-600 font-mono font-bold">{r.Ry.toFixed(3)} {uF}</td>
                                             <td className="px-6 py-3 text-gray-600 font-mono">{r.M.toFixed(3)} {uM}</td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                             
                             <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex gap-4">
                                 <span>ΣFy: {state.results.checks?.sumFy.toFixed(4)} {uF}</span>
                                 <span>ΣM: {state.results.checks?.sumM.toFixed(4)} {uM}</span>
                             </div>
                         </section>
                     )}
                 </>
             )}
          </div>

        </main>

        {/* --- FOOTER --- */}
        <footer className="bg-slate-900 text-slate-300 py-8 mt-12 text-center border-t-4 border-blue-500 no-print">
          <div className="mb-2 font-bold text-white text-lg">Calculadora de Vigas Pro v1.0</div>
          <div className="text-sm mb-4">Desarrollado con tecnología React + Google Gemini AI</div>
          
          <div className="w-16 h-px bg-slate-700 mx-auto my-4"></div>
          
          <div className="text-sm">
            Creado por{' '}
            <a 
              href="https://www.linkedin.com/in/jaime-m-meneses/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-400 hover:text-blue-300 font-bold transition-colors ml-1"
            >
              Jaime M. Meneses
            </a>
          </div>
          
          <div className="text-xs text-slate-500 mt-4">
            © {new Date().getFullYear()} Todos los derechos reservados.
          </div>
        </footer>

      </div>

      {/* --- Right Sidebar: Gemini Assistant --- */}
      {showAssistant && (
          <div className="no-print">
            <GeminiAssistant beamState={state} onUpdateBeam={handleGeminiUpdate} />
          </div>
      )}
      
    </div>
  );
}