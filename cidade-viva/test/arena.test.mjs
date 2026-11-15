import test from 'node:test';
import assert from 'node:assert/strict';
import { criarArena, avancarArena, turnoDevido, aplicarTurno, rivaisPublicos, podePagar, registrarCusto, situacao, verbaLiberada, MESES_MILENIO, VERBA_MILENIO } from '../src/arena/arena.js';
import { governoPorRegras, aplicarGoverno, pontos } from '../src/sim/sim.js';
import { extrairJSON } from '../server/provedores.mjs';

const rodar = (a, anos, governo = true) => {
  for (let m = 0; m < anos * 12; m++) {
    avancarArena(a);
    if (governo && turnoDevido(a)) for (const c of a.cidades) aplicarTurno(a, c, governoPorRegras(c.w, rivaisPublicos(a, c)));
  }
  return a;
};

test('as três cidades partem iguais e a arena é determinística', () => {
  const a = criarArena(5);
  // Só o nome muda (e a frase de fundação, que cita o nome).
  assert.equal(new Set(a.cidades.map((c) => JSON.stringify({ ...c.w, nome: '', log: [] }))).size, 1);
  assert.equal(JSON.stringify(rodar(criarArena(5), 60)), JSON.stringify(rodar(criarArena(5), 60)));
});

test('sem governo decidindo, o Estado não age sozinho', () => {
  const a = rodar(criarArena(2), 80, false);
  for (const c of a.cidades) assert.ok(c.w.estado.predios.length <= 1, 'só a casa do conselho');
});

test('governo por regras leva as cidades adiante e o estado é serializável', () => {
  const a = rodar(criarArena(3), 150);
  for (const c of a.cidades) assert.ok(c.w.era >= 3 && pontos(c.w) > 800, `era ${c.w.era}`);
  const b = JSON.parse(JSON.stringify(a));
  assert.equal(JSON.stringify(rodar(a, 10)), JSON.stringify(rodar(b, 10)));
});

test('decisão malformada não quebra a cidade e os limites valem', () => {
  const a = rodar(criarArena(1), 60);
  const w = a.cidades[0].w;
  for (const lixo of [null, 'oi', [], { imposto: 'muito', recrutar: 1e9, pesquisa: -5, construir: 42, fomento: {}, atacar: 7 }, { imposto: 9, auxilio: 1e12, dispensar: 1e9 }]) {
    aplicarTurno(a, a.cidades[0], lixo);
    assert.ok(Number.isFinite(w.estado.tesouro) && w.estado.taxa <= 0.45 && w.estado.exercito >= 0);
    assert.ok(w.estado.exercito <= w.ind.populacao * 0.12 + 1);
  }
  const antes = w.estado.tesouro;
  aplicarGoverno(w, { pesquisa: 1e9 });
  assert.ok(w.estado.tesouro >= -0.001 && w.estado.tesouro <= Math.max(0, antes));
});

test('guerra: exército marcha, batalha acontece e alguém sai perdendo', () => {
  const a = rodar(criarArena(4), 70);
  const [x, y] = a.cidades;
  x.w.estado.exercito = 60; y.w.estado.exercito = 0;
  const ricoAntes = y.w.familias.reduce((s, f) => s + f.riqueza, 0);
  aplicarTurno(a, x, { atacar: y.w.nome });
  assert.equal(a.marchas.length, 1);
  assert.equal(x.w.estado.exercito, 18);
  rodar(a, 1, false);
  assert.equal(a.marchas.length, 0);
  assert.ok(a.log.some((l) => l.tipo === 'guerra' && l.texto.includes('vence')));
  assert.ok(y.w.familias.reduce((s, f) => s + f.riqueza, 0) < ricoAntes);
  assert.ok(situacao(a, y).guerras_recentes.length === 1);
});

test('verba: no máximo 1 dólar por milênio, liberado aos poucos', () => {
  const a = criarArena(1), c = a.cidades[0];
  a.mes = 600;                         // ano 50
  assert.ok(verbaLiberada(a) < 0.1);
  registrarCusto(c, 0.03);
  assert.ok(podePagar(a, c));
  registrarCusto(c, 0.03);
  assert.ok(!podePagar(a, c), 'modelo caro precisa esperar a verba ser liberada');
  a.mes = MESES_MILENIO - 1; c.gastoMilenio = VERBA_MILENIO - 0.001;
  assert.ok(!podePagar(a, c));
  c.gasto = 5; c.gastoMilenio = 0;
  assert.ok(!podePagar(a, c), 'teto total de 5 dólares');
});

test('JSON é extraído mesmo com cercas de código ou texto em volta', () => {
  assert.deepEqual(extrairJSON('```json\n{"a": 1}\n```'), { a: 1 });
  assert.deepEqual(extrairJSON('Claro! {"imposto": 0.1} pronto'), { imposto: 0.1 });
  assert.throws(() => extrairJSON('sem objeto'));
});
