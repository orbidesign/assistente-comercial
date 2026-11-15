// Torneio: a forma repetível de medir qual governo é melhor.
//
//   node server/torneio.mjs --modo solo  --sementes 5 --anos 300
//   node server/torneio.mjs --modo arena --sementes 5 --anos 500
//
// solo:  cada competidor governa sozinho as MESMAS cidades iniciais (mesmas
//        sementes), sem rivais nem guerra. Mede governança pura, e inclui duas
//        referências: "regras" (governo de regras) e "ausente" (ninguém governa).
// arena: os três juntos, com diplomacia e guerra. Mede estratégia.
//
// ARENA_ENSAIO=1 roda tudo com respostas simuladas, sem chamar nem gastar nada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarArena, avancarArena, turnoDevido, aplicarTurno, situacao, rivaisPublicos, podePagar, registrarCusto, naVez, PROVEDORES as CIDADES, TOKENS_MILENIO } from '../src/arena/arena.js';
import { governoPorRegras, pontos } from '../src/sim/sim.js';
import { ERAS } from '../src/sim/dados.js';
import { PROVEDORES, ativo, decidir } from './provedores.mjs';

const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const modo = arg('modo', 'solo'), nSementes = +arg('sementes', 3), anos = +arg('anos', 300);
const sementes = Array.from({ length: nSementes }, (_, i) => 1001 + i * 7919);
const comChave = Object.keys(PROVEDORES).filter(ativo);
const competidores = (arg('competidores', '') || [...comChave, 'regras', 'ausente'].join(',')).split(',').filter(Boolean);
const marcas = [50, 100, 200, 300, 500, 750, 1000].filter((x) => x <= anos);

async function governar(a, c, quem) {
  if (!c.w.estado.existe || !naVez(a, c)) return;
  if (quem === 'ausente') return;
  if (quem === 'regras' || !PROVEDORES[quem]) return aplicarTurno(a, c, governoPorRegras(c.w, rivaisPublicos(a, c), quem === 'regras' ? 'equilibrado' : CIDADES[c.id].perfil));
  if (!podePagar(a, c)) { c.turnosSemVerba++; return; }
  try {
    const r = await decidir(quem, situacao(a, c));
    registrarCusto(c, r.tokens, r.custo);
    if (r.invalida) c.invalidas++; else return r.decisao;
  } catch (e) { c.falhas = (c.falhas || 0) + 1; c.ultimaFalha = e.message.slice(0, 120); }
}

function medir(c, quem, semente, lugar) {
  const i = c.w.ind;
  return {
    quem, semente, lugar, pontos: pontos(c.w), era: c.w.era, eras: c.eras, marcas: c.marcas,
    populacao: i.populacao, conhecimento: Math.round(c.w.conhecimento), felicidade: +i.felicidade.toFixed(2), educacao: +i.educacao.toFixed(2),
    riqueza_media: Math.round(i.riquezaMedia), desigualdade: +i.gini.toFixed(2),
    tokens: c.tokens, reunioes: c.chamadas, invalidas: c.invalidas, falhas: c.falhas || 0, sem_verba: c.turnosSemVerba,
    vitorias: c.vitorias, derrotas: c.derrotas, saqueada: c.saqueada, dolares: +c.dolares.toFixed(3),
  };
}

async function partida(semente, ids, quemGoverna) {
  const a = criarArena(semente, ids);
  for (const c of a.cidades) c.marcas = {};
  for (let m = 0; m < anos * 12; m++) {
    avancarArena(a);
    if (turnoDevido(a)) {
      // Todos decidem vendo a mesma situação; as decisões são aplicadas depois.
      const ds = await Promise.all(a.cidades.map((c) => governar(a, c, quemGoverna(c))));
      ds.forEach((d, k) => { if (d) aplicarTurno(a, a.cidades[k], d); });
    }
    if (a.mes % 12 === 0 && marcas.includes(a.mes / 12)) for (const c of a.cidades) c.marcas[a.mes / 12] = pontos(c.w);
  }
  return a;
}

const resultados = [];
console.log(`Torneio ${modo}: ${nSementes} sementes × ${anos} anos · competidores: ${modo === 'arena' ? Object.keys(CIDADES).map((id) => (ativo(id) ? id : `${id} (regras)`)).join(', ') : competidores.join(', ')}`);
const reunioesMax = Math.ceil(anos / 5), tetoPorPartida = Math.min(reunioesMax * 4000, Math.ceil(anos / 1000) * TOKENS_MILENIO);
console.log(`Teto de tokens por IA por partida: cerca de ${tetoPorPartida.toLocaleString('pt-BR')} (o jogo impõe ${TOKENS_MILENIO.toLocaleString('pt-BR')} por milênio).\n`);

for (const semente of sementes) {
  if (modo === 'arena') {
    const a = await partida(semente, Object.keys(CIDADES), (c) => (ativo(c.id) ? c.id : 'perfil'));
    const ordem = [...a.cidades].sort((x, y) => pontos(y.w) - pontos(x.w));
    for (const c of a.cidades) resultados.push(medir(c, c.id, semente, ordem.indexOf(c) + 1));
  } else {
    // Cada competidor joga a mesma semente sozinho, em paralelo.
    const as = await Promise.all(competidores.map((q) => partida(semente, [PROVEDORES[q] ? q : 'anthropic'], () => q)));
    const ordem = as.map((a, k) => ({ k, p: pontos(a.cidades[0].w) })).sort((x, y) => y.p - x.p);
    as.forEach((a, k) => resultados.push(medir(a.cidades[0], competidores[k], semente, ordem.findIndex((o) => o.k === k) + 1)));
  }
  console.log(`semente ${semente}: ${resultados.filter((r) => r.semente === semente).map((r) => `${r.quem} ${r.pontos}`).join(' · ')}`);
}

// ---------- resumo ----------
const media = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN);
const desvio = (v) => { const m = media(v); return v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)) : 0; };
const nomes = [...new Set(resultados.map((r) => r.quem))];
const linhas = nomes.map((q) => {
  const rs = resultados.filter((r) => r.quem === q);
  const pts = rs.map((r) => r.pontos), tk = media(rs.map((r) => r.tokens));
  const linha = {
    governo: q, 'pontos (média)': Math.round(media(pts)), 'desvio': Math.round(desvio(pts)), '1º lugar': `${rs.filter((r) => r.lugar === 1).length}/${rs.length}`,
  };
  for (const e of [2, 4, 5, 6, 7]) {
    const anosEra = rs.map((r) => r.eras[e]).filter(Boolean);
    linha[ERAS[e].nome] = anosEra.length ? `ano ${Math.round(media(anosEra))} (${anosEra.length}/${rs.length})` : '—';
  }
  linha['tokens'] = Math.round(tk).toLocaleString('pt-BR');
  linha['pts/100 mil tk'] = tk ? Math.round(media(pts) / (tk / 1e5)) : '—';
  linha['inválidas'] = rs.reduce((s, r) => s + r.invalidas + r.falhas, 0);
  if (modo === 'arena') linha['guerras V/D'] = `${rs.reduce((s, r) => s + r.vitorias, 0)}/${rs.reduce((s, r) => s + r.derrotas, 0)}`;
  return linha;
}).sort((x, y) => y['pontos (média)'] - x['pontos (média)']);
console.log();
console.table(linhas);
console.log('Era: ano médio em que foi alcançada (em quantas partidas foi alcançada).');
console.log('Diferenças menores que o desvio não permitem dizer quem é melhor: rode mais sementes.');

const aqui = path.dirname(fileURLToPath(import.meta.url));
const pasta = path.join(aqui, '..', 'resultados');
fs.mkdirSync(pasta, { recursive: true });
const arquivo = path.join(pasta, `torneio-${modo}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
fs.writeFileSync(arquivo, JSON.stringify({ modo, anos, sementes, modelos: Object.fromEntries(Object.entries(PROVEDORES).map(([k, v]) => [k, v.modelo])), ensaio: process.env.ARENA_ENSAIO === '1', resumo: linhas, partidas: resultados }, null, 2));
console.log(`\nResultados completos em ${path.relative(process.cwd(), arquivo)}`);
