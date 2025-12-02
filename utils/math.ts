export function zeros(n: number, m: number | null = null): any {
  if (m === null) return new Array(n).fill(0);
  return new Array(n).fill(0).map(() => new Array(m).fill(0));
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  // Clone to avoid modifying originals
  const M = A.map((row) => row.slice());
  const x = b.slice();

  for (let k = 0; k < n; k++) {
    let iMax = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(M[i][k]) > Math.abs(M[iMax][k])) iMax = i;
    }
    
    if (Math.abs(M[iMax][k]) < 1e-12) {
       // Singular matrix or close to it
       // In structural context, this often means unstable structure
       throw new Error("Singular matrix: Structure may be unstable.");
    }

    if (iMax !== k) {
      [M[k], M[iMax]] = [M[iMax], M[k]];
      [x[k], x[iMax]] = [x[iMax], x[k]];
    }
    
    const pivot = M[k][k];
    for (let j = k; j < n; j++) M[k][j] /= pivot;
    x[k] /= pivot;
    
    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k];
      for (let j = k; j < n; j++) M[i][j] -= factor * M[k][j];
      x[i] -= factor * x[k];
    }
  }
  
  for (let k = n - 1; k >= 0; k--) {
    let s = x[k];
    for (let j = k + 1; j < n; j++) s -= M[k][j] * x[j];
    x[k] = s / M[k][k];
  }
  
  return x;
}