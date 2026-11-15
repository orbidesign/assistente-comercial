// Traduz o estado de um município em uma cidade que se pode ver: quantas casas,
// de que tipo, quantos prédios, quais equipamentos públicos existem.
import { gerarLotes } from '../sim/geo.js';

const LOTES = gerarLotes();
const hash = (j, s = 1) => { let h = Math.imul(j + 1, 374761393) ^ Math.imul(s, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const lim = (v, a, b) => Math.min(b, Math.max(a, v));

export function cidadeVisual(m) {
  const i = m.ind, prog = m.pol.programas;
  const usados = Math.round(lim(m.pop / 750, 70, LOTES.length - 2));
  const publicos = {
    2: 'prefeitura', 5: 'escola', 9: 'ubs',
    14: i.ideb > 6 ? 'escola' : null, 40: i.creche > 0.6 ? 'escola' : null, 46: i.atencaoBasica > 0.85 ? 'ubs' : null,
    20: i.expVida > 78.5 && i.atencaoBasica > 0.75 ? 'hospital' : null, 12: prog.videomonitoramento !== undefined ? 'guarda' : null,
    26: i.resiliencia > 0.45 ? 'parque' : null, 58: i.resiliencia > 0.75 ? 'parque' : null, 34: i.esgoto > 0.72 ? 'saneamento' : null,
    30: prog.polo_tecnologico !== undefined ? 'polo' : null,
  };
  const pPredio = lim((m.renda - 1300) / 7000 + (m.pop - 100000) / 500000, 0.04, 0.65);
  const pInd = lim((m.formais / m.pop) * 0.45 + (prog.distrito_industrial !== undefined ? 0.1 : 0), 0.06, 0.32);
  const pPobre = lim(m.pobreza * 1.7 + i.deficitHab * 2, 0.04, 0.75);
  const specs = [], familias = [];
  for (let j = 0; j < usados; j++) {
    const pos = LOTES[j], h = hash(j), h2 = hash(j, 7);
    let tipo, nivel = 1;
    if (publicos[j] !== undefined) { if (!publicos[j]) { tipo = 'casa'; } else tipo = publicos[j]; }
    if (!tipo) {
      const zona = j / usados;
      if (zona < 0.38) {
        if (h < pPredio) { tipo = 'predio'; nivel = Math.round(lim(3 + h2 * (3 + m.renda / 700), 3, 15)); }
        else if (h < pPredio + 0.2) tipo = 'comercio';
        else tipo = m.renda > 2200 || h2 > 0.5 ? 'sobrado' : 'casa';
      } else if (zona > 0.72) {
        if (h < pInd) { tipo = 'galpao'; nivel = prog.distrito_industrial !== undefined && h2 > 0.5 ? 2 : 1; }
        else tipo = h2 < pPobre ? 'casa_simples' : 'casa';
      } else tipo = h2 < pPobre * 0.7 ? 'casa_simples' : h > 0.8 && m.renda > 2600 ? 'sobrado' : 'casa';
    }
    specs.push({ chave: `b${j}`, classe: tipo.startsWith('casa') || tipo === 'sobrado' ? 'casa' : 'br', id: j + 1, tipo, nivel, pos });
    if ((tipo.startsWith('casa') || tipo === 'sobrado') && familias.length < 75) familias.push({ id: j + 1, membros: 4, dono: 0, emprego: null, pos });
  }
  return { specs, mundo: { familias, negocios: [] } };
}

// A cidade com as marcas dos CEOs: cada rede ocupa lotes com a própria cor.
// A quantidade de prédios cresce com o número de unidades (em escala logarítmica),
// e quem passa de R$ 20 milhões ganha uma sede.
const PUBLICOS = new Set([2, 5, 9, 14, 40, 46, 20, 12, 26, 58, 34, 30]);
const INDUSTRIA = new Set(['fabrica', 'distribuidora', 'marca_nacional']);
export function cidadeDosCEOs(j, cores) {
  const v = cidadeVisual(j.cidade);
  const porChave = new Map(v.specs.map((s) => [s.chave, s]));
  j.ceos.forEach((c, k) => {
    if (c.quebrou) return;
    const cor = cores[c.id];
    const lojas = [], galpoes = [];
    for (const op of Object.values(c.ops)) {
      const u = op.unidades + op.fora;
      if (!u) continue;
      const n = u <= 5 ? u : Math.min(14, 5 + Math.round(3 * Math.log10(u)));
      for (let i = 0; i < n; i++) (INDUSTRIA.has(op.tipo) ? galpoes : lojas).push(op.tipo);
    }
    let iL = 0, iG = 0;
    const total = v.specs.length;
    for (let idx = 3 + k; idx < total && (iL < lojas.length || iG < galpoes.length); idx += 3) {
      if (PUBLICOS.has(idx)) continue;
      const s = porChave.get(`b${idx}`);
      const borda = idx / total > 0.6;
      if (borda && iG < galpoes.length) { Object.assign(s, { tipo: 'galpao', classe: 'br', nivel: 1, cor, dono: c.id }); iG++; }
      else if (!borda && iL < lojas.length) { Object.assign(s, { tipo: 'comercio', classe: 'br', nivel: 1, cor, dono: c.id }); iL++; }
    }
    if (c.patrimonio > 20e6) {
      const s = porChave.get(`b${[6, 7, 8][k]}`);
      Object.assign(s, { tipo: 'predio', classe: 'br', nivel: Math.round(lim(3 * Math.log10(c.patrimonio / 1e6), 4, 15)), cor, dono: c.id });
    }
  });
  // A cor entra na assinatura: um lote que troca de dono é reconstruído.
  for (const s of v.specs) if (s.cor !== undefined) s.nivel = s.nivel * 100 + (s.cor % 97);
  return v;
}
