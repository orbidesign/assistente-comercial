// Geografia do vale. Funções puras, usadas tanto pela simulação (onde dá para
// construir) quanto pelo render (forma do terreno).

export const RAIO_MUNDO = 110;
export const NIVEL_AGUA = -0.5;

function hash(ix, iz) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function suave(t) {
  return t * t * (3 - 2 * t);
}

function ruido(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = suave(x - ix), fz = suave(z - iz);
  const a = hash(ix, iz), b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

export function fbm(x, z) {
  return ruido(x, z) * 0.55 + ruido(x * 2.1, z * 2.1) * 0.3 + ruido(x * 4.3, z * 4.3) * 0.15;
}

function degrau(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return suave(t);
}

export function rioX(z) {
  return 20 + 13 * Math.sin(z * 0.035) + 5 * Math.sin(z * 0.09 + 1);
}

export function altura(x, z) {
  const d = Math.hypot(x, z);
  let h = fbm(x * 0.03 + 7, z * 0.03 + 3) * 7 - 2.2;
  const plano = 1.1 + fbm(x * 0.08, z * 0.08) * 0.9;
  h = plano + (h - plano) * degrau(28, 70, d);
  const borda = degrau(58, 108, d);
  h += borda * borda * 42 * (0.55 + 0.45 * fbm(x * 0.045 + 11, z * 0.045));
  const canal = 1 - degrau(2.5, 9, Math.abs(x - rioX(z)));
  return h + (-1.7 - h) * canal;
}

export function ehAgua(x, z) {
  return altura(x, z) < NIVEL_AGUA + 0.35;
}

// Lotes onde se pode construir, do centro para fora. A cidade cresce ocupando
// esta lista em ordem, então o desenho urbano é determinístico por semente.
export function gerarLotes() {
  const lotes = [];
  const passo = 7.5;
  for (let i = -11; i <= 11; i++) {
    for (let j = -11; j <= 11; j++) {
      const x = (i + (j % 2 ? 0.5 : 0)) * passo + (hash(i, j) - 0.5) * 2.4;
      const z = j * passo * 0.87 + (hash(j, i + 99) - 0.5) * 2.4;
      const d = Math.hypot(x, z);
      if (d < 6 || d > 78) continue;
      const h = altura(x, z);
      if (h < 0.5 || h > 7) continue;
      const incl = Math.abs(altura(x + 2, z) - h) + Math.abs(altura(x, z + 2) - h);
      if (incl > 1.1) continue;
      if (Math.abs(x - rioX(z)) < 10) continue;
      lotes.push({ x, z, d: d + hash(i * 3, j * 5) * 6 });
    }
  }
  lotes.sort((a, b) => a.d - b.d);
  return lotes.map(({ x, z }) => ({ x: +x.toFixed(2), z: +z.toFixed(2) }));
}
