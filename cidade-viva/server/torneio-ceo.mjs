// Torneio dos CEOs: a forma repetível de medir quem é melhor.
//
//   node server/torneio-ceo.mjs --modo solo  --sementes 10
//   node server/torneio-ceo.mjs --modo arena --sementes 10
//
// solo:  cada competidor joga sozinho as MESMAS Campinas (mesmas sementes), sem
//        rivais. Mede a capacidade de fazer patrimônio, sem interferência.
//        Entram quatro referências de regras: padeiro, expansionista,
//        diversificador e inercia (ninguém decide nada).
// arena: os três juntos, com tudo o que podem fazer uns contra os outros.
//
// ARENA_ENSAIO=1 roda com respostas simuladas, sem chamar nem gastar nada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarJogo, avancarMes, despachar, dossie, ceoPorRegras, naVez, temTokens, registrarTokens, terminou, classificacao, bensPessoais, reais, CEOS, VALENCIAS, TOKENS_SECULO } from '../src/empresas/jogo.js';
import { PROVEDORES, ativo, decidir } from './provedores.mjs';

const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const modo = arg('modo', 'solo'), nSementes = +arg('sementes', 3), ateAno = +arg('ate', 2126);
const sementes = Array.from({ length: nSementes }, (_, i) => 1001 + i * 7919);
const REFERENCIAS = ['padeiro', 'expansionista', 'diversificador', 'inercia'];
const comChave = Object.keys(PROVEDORES).filter(ativo);
const competidores = (arg('competidores', '') || [...comChave, ...REFERENCIAS].join(',')).split(',').filter(Boolean);

async function decisao(j, c, quem) {
  if (!naVez(j, c)) return null;
  if (!PROVEDORES[quem]) return { modo: 'regras', d: ceoPorRegras(j, c, quem === 'perfil' ? CEOS[c.id].perfil : quem) };
  if (!temTokens(c)) return { modo: 'semtokens' };
  try {
    const r = await decidir(quem, dossie(j, c), 'ceo');
    registrarTokens(c, r.tokens, r.custo);
    if (r.invalida) { c.invalidas++; return { modo: 'invalida', tokens: r.tokens }; }
    return { modo: 'ia', d: r.decisao, tokens: r.tokens };
  } catch (e) { c.falhas = (c.falhas || 0) + 1; return { modo: 'erro' }; }
}

async function partida(semente, ids, quemJoga) {
  const j = criarJogo(semente, ids);
  while (!terminou(j) && j.t < (ateAno - 2026) * 12) {
    // Todos decidem vendo a mesma situação; só depois o ano fecha.
    const rs = await Promise.all(j.ceos.map((c) => decisao(j, c, quemJoga(c))));
    rs.forEach((r, k) => { if (r) despachar(j, j.ceos[k], r.d || null, r.modo, r.tokens || 0); });
    avancarMes(j);
  }
  return j;
}

const marco = (c, v) => { const m = c.marcos.find((x) => x.valor === v); return m ? 2026 + Math.floor(m.t / 12) : null; };
const medir = (j, c, quem, semente, lugar) => ({
  quem, semente, lugar, patrimonio: Math.round(c.patrimonio), bolso: Math.round(bensPessoais(c)), falencias: c.falencias, valencias: Object.fromEntries(Object.entries(VALENCIAS).map(([k, v]) => [k, +c[v.campo].toFixed(2)])), quebrou: c.quebrou, ano_1_milhao: marco(c, 1e6), ano_10_milhoes: marco(c, 1e7), ano_100_milhoes: marco(c, 1e8), ano_1_bilhao: marco(c, 1e9),
  receita: Math.round(c.receita), unidades: Object.fromEntries(Object.values(c.ops).filter((o) => o.unidades + o.fora).map((o) => [o.tipo, o.unidades + o.fora])), franqueados: c.franqueados,
  tokens: c.tokens, reunioes: c.chamadas, invalidas: c.invalidas, falhas: c.falhas || 0, ilicitos: c.ilicitos, flagrantes: c.flagrantes, dolares: +c.dolares.toFixed(3),
});

const resultados = [];
console.log(`Torneio ${modo}: ${nSementes} sementes, mês a mês de 2026 a ${ateAno} · ${modo === 'arena' ? Object.keys(CEOS).map((id) => (ativo(id) ? id : `${id} (regras: ${CEOS[id].perfil})`)).join(', ') : competidores.join(', ')}`);
console.log(`Verba por IA por partida: ${TOKENS_SECULO.toLocaleString('pt-BR')} tokens.\n`);
for (const semente of sementes) {
  if (modo === 'arena') {
    const j = await partida(semente, Object.keys(CEOS), (c) => (ativo(c.id) ? c.id : 'perfil'));
    const ordem = classificacao(j);
    for (const c of j.ceos) resultados.push(medir(j, c, c.id, semente, ordem.indexOf(c) + 1));
  } else {
    const js = await Promise.all(competidores.map((q) => partida(semente, [PROVEDORES[q] ? q : 'anthropic'], () => q)));
    const ordem = js.map((j, k) => ({ k, p: j.ceos[0].patrimonio })).sort((a, b) => b.p - a.p);
    js.forEach((j, k) => resultados.push(medir(j, j.ceos[0], competidores[k], semente, ordem.findIndex((o) => o.k === k) + 1)));
  }
  console.log(`semente ${semente}: ${resultados.filter((r) => r.semente === semente).map((r) => `${r.quem} ${r.quebrou ? `quebrou em ${r.quebrou}` : reais(r.patrimonio)}`).join(' · ')}`);
}

const mediana = (v) => { const o = [...v].sort((a, b) => a - b); return o.length ? (o[(o.length - 1) >> 1] + o[o.length >> 1]) / 2 : NaN; };
const linhas = [...new Set(resultados.map((r) => r.quem))].map((q) => {
  const rs = resultados.filter((r) => r.quem === q), pats = rs.map((r) => r.patrimonio);
  const anoDe = (campo) => { const a = rs.map((r) => r[campo]).filter(Boolean); return a.length ? `${Math.round(mediana(a))} (${a.length}/${rs.length})` : '—'; };
  return {
    ceo: q, 'patrimônio (mediana)': reais(mediana(pats)), 'pior': reais(Math.min(...pats)), 'melhor': reais(Math.max(...pats)), '1º lugar': `${rs.filter((r) => r.lugar === 1).length}/${rs.length}`,
    'fora do jogo': `${rs.filter((r) => r.quebrou).length}/${rs.length}`, 'falências': rs.reduce((s, r) => s + r.falencias, 0), 'R$ 1 mi': anoDe('ano_1_milhao'), 'R$ 100 mi': anoDe('ano_100_milhoes'), 'R$ 1 bi': anoDe('ano_1_bilhao'),
    tokens: Math.round(rs.reduce((s, r) => s + r.tokens, 0) / rs.length).toLocaleString('pt-BR'), 'inválidas': rs.reduce((s, r) => s + r.invalidas + r.falhas, 0), 'ilícitos/pegos': `${rs.reduce((s, r) => s + r.ilicitos, 0)}/${rs.reduce((s, r) => s + r.flagrantes, 0)}`, _m: mediana(pats),
  };
}).sort((a, b) => b._m - a._m).map(({ _m, ...l }) => l);
console.log();
console.table(linhas);
console.log('Colunas R$: ano mediano em que o patrimônio passou do valor (em quantas partidas passou).');
console.log('Com poucas sementes, diferenças pequenas são sorte. Compare mediana, pior e melhor caso.');

const pasta = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'resultados');
fs.mkdirSync(pasta, { recursive: true });
const arquivo = path.join(pasta, `torneio-ceo-${modo}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
fs.writeFileSync(arquivo, JSON.stringify({ modo, ateAno, sementes, modelos: Object.fromEntries(Object.entries(PROVEDORES).map(([k, v]) => [k, v.modelo])), ensaio: process.env.ARENA_ENSAIO === '1', resumo: linhas, partidas: resultados }, null, 2));
console.log(`\nResultados completos em ${path.relative(process.cwd(), arquivo)}`);
