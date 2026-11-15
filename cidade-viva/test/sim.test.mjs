import test from 'node:test';
import assert from 'node:assert/strict';
import { criarMundo, avancarMes, aplicarEvento, interpretarTexto, aplicarDecisoes, resumoParaIA } from '../src/sim/sim.js';
import { CARTAS, ERAS } from '../src/sim/dados.js';

const rodar = (w, anos) => { for (let i = 0; i < anos * 12; i++) avancarMes(w); return w; };

test('mesma semente, mesma história', () => {
  const a = rodar(criarMundo(7), 30), b = rodar(criarMundo(7), 30);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('o mundo é serializável e continua igual depois de salvar e carregar', () => {
  const a = rodar(criarMundo(3), 10);
  const b = JSON.parse(JSON.stringify(a));
  assert.equal(JSON.stringify(rodar(a, 5)), JSON.stringify(rodar(b, 5)));
});

for (const semente of [1, 2, 3, 4, 5]) {
  test(`semente ${semente}: a cidade cresce, o Estado nasce e o dinheiro não explode`, () => {
    const w = rodar(criarMundo(semente), 100);
    assert.ok(w.ind.populacao > 150, `população ${w.ind.populacao}`);
    assert.ok(w.estado.existe, 'Estado deveria existir');
    assert.ok(w.era >= 2, `era ${ERAS[w.era].nome}`);
    assert.ok(w.ind.riquezaMedia < 5000 && w.ind.salario < 500, 'inflação fora de controle');
    for (const f of w.familias) assert.ok(Number.isFinite(f.riqueza) && f.riqueza > -1 && f.membros > 0);
    const lotes = new Set();
    for (const p of [...w.familias, ...w.negocios, ...w.estado.predios.filter((q) => q.pos)]) {
      const k = `${p.pos.x},${p.pos.z}`;
      assert.ok(!lotes.has(k), 'dois prédios no mesmo lote');
      lotes.add(k);
    }
  });
}

test('todas as cartas aplicam sem quebrar', () => {
  const w = rodar(criarMundo(2), 25);
  for (const c of CARTAS) { aplicarEvento(w, c); rodar(w, 1); }
  assert.ok(w.familias.length > 0);
  assert.ok(Number.isFinite(w.ind.felicidade));
});

test('seca derruba a comida; texto livre cai na carta certa sem IA', () => {
  const ev = interpretarTexto('Uma seca terrível castiga o vale');
  assert.equal(ev.titulo, 'Seca');
  const w = rodar(criarMundo(1), 5);
  aplicarEvento(w, ev);
  assert.ok(w.mods.some((m) => m.alvo === 'comida' && m.fator < 1));
});

test('decisões dos agentes de IA são aplicadas e limitadas', () => {
  const w = rodar(criarMundo(1), 30);
  const r = resumoParaIA(w);
  assert.ok(r.estado && r.empresarios.length === 3);
  const antes = w.estado.taxa;
  aplicarDecisoes(w, { estado: { imposto_delta: 0.9, construir: 'nada', fala: 'teste' },
    empresarios: [{ familia: r.empresarios[0].familia, acao: 'aumentar_salarios', negocio: 'fazenda', fala: 'ok' }] });
  assert.ok(w.estado.taxa - antes <= 0.0501);
});
