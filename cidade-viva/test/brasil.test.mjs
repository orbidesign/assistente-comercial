import test from 'node:test';
import assert from 'node:assert/strict';
import { criarMunicipio, avancarAno, aplicarDecisao, cenarioDoAno, prefeitoPorRegras, calcularReceita, fatiaISS, pontos, LEIS, ANO_FINAL } from '../src/brasil/municipio.js';
import { criarDisputa, despachar, avancarDisputa, naVez, temTokens, registrarTokens, dossie, terminou, PREFEITOS, TOKENS_SECULO } from '../src/brasil/disputa.js';

const seculo = (perfil, semente = 3) => {
  const m = criarMunicipio(semente, 'Teste');
  for (let a = 2026; a < ANO_FINAL; a++) { aplicarDecisao(m, prefeitoPorRegras(m, perfil)); avancarAno(m, cenarioDoAno(semente, a)); }
  return m;
};

test('2026 parte dentro da lei: mínimos de educação e saúde, folha abaixo do teto', () => {
  const m = criarMunicipio(1, 'T');
  avancarAno(m, cenarioDoAno(1, 2026));
  assert.ok(m.fin.minimos.educacao >= LEIS.educacaoMin && m.fin.minimos.saude >= LEIS.saudeMin);
  assert.ok(m.fin.pessoal < LEIS.pessoalPrudencial, `folha ${m.fin.pessoal}`);
  assert.ok(m.desemprego > 0.06 && m.desemprego < 0.13);
});

test('reforma tributária: ISS encolhe de 2029 a 2032 e some em 2033', () => {
  assert.deepEqual([2028, 2029, 2032, 2033, 2050].map((a) => +fatiaISS(a).toFixed(1)), [1, 0.9, 0.6, 0, 0]);
  const m = seculo('inercia');
  const m2040 = criarMunicipio(3, 'T');
  for (let a = 2026; a < 2040; a++) avancarAno(m2040, cenarioDoAno(3, a));
  const r = calcularReceita(m2040);
  assert.equal(r.iss, 0); assert.equal(r.icms, 0); assert.ok(r.ibs > 50);
  assert.equal(m.hist.length, 101);
});

test('limites da lei valem para qualquer decisão', () => {
  const m = criarMunicipio(2, 'T');
  aplicarDecisao(m, { tributos: { iss: 0.5, iptu: 90, itbi: 50 }, pessoal: { reajuste_real_pct: 900 }, credito: { valor_milhoes: 1e9 }, orcamento: { educacao: -5, saude: 'x', meta_de_superavit_pct: 80 } });
  assert.ok(m.pol.iss >= LEIS.issMin && m.pol.iss <= LEIS.issMax && m.pol.iptu <= LEIS.iptuMax && m.pol.itbi <= LEIS.itbiMax);
  assert.ok(m.fin.divida <= m.fin.rcl * LEIS.dividaMax + 1);
  assert.ok(Math.abs(Object.values(m.pol.orcamento).reduce((s, v) => s + v, 0) - 100) < 1e-6);
  for (const lixo of [null, 7, 'x', { programas: { criar: 'nada' } }, { rivais: 4 }]) aplicarDecisao(m, lixo);
  avancarAno(m, cenarioDoAno(2, 2026));
  assert.ok(Number.isFinite(pontos(m)));
});

test('cortar educação abaixo de 25% faz o Tribunal de Contas rejeitar as contas e impugna a reeleição', () => {
  const m = criarMunicipio(4, 'T');
  for (let a = 2026; a < 2029; a++) {
    aplicarDecisao(m, { orcamento: { educacao: 5, saude: 24, seguranca: 3, infraestrutura: 30, saneamento: 4, habitacao: 2, assistencia: 5, meio_ambiente: 2, desenvolvimento: 5, cultura: 3, administracao: 17 } });
    avancarAno(m, cenarioDoAno(4, a));
  }
  assert.ok(m.politica.contasRejeitadas >= 1);
  assert.equal(m.politica.eleicoes[0].ano, 2028);
  assert.equal(m.politica.eleicoes[0].venceu, false);
  assert.equal(m.politica.noPoder, false);
  const iss = m.pol.iss;
  aplicarDecisao(m, { tributos: { iss: 2 } });
  assert.equal(m.pol.iss, iss, 'fora do poder, não decide');
});

test('governar importa: o prefeito técnico termina o século bem à frente da inércia', () => {
  const t = seculo('tecnico'), i = seculo('inercia');
  assert.ok(pontos(t) > pontos(i) + 80, `${pontos(t)} x ${pontos(i)}`);
  assert.equal(JSON.stringify(seculo('tecnico')), JSON.stringify(t), 'determinístico');
});

test('disputa: cidades iguais em 2026, gabinete registra tudo, tokens iguais para os três', () => {
  const d = criarDisputa(9);
  assert.equal(new Set(d.cidades.map((c) => JSON.stringify({ ...c.m, nome: '' }))).size, 1);
  while (!terminou(d)) {
    for (const c of d.cidades) if (naVez(d, c)) despachar(d, c, { ...prefeitoPorRegras(c.m, PREFEITOS[c.id].perfil), diagnostico: 'd', estrategia: 'e', tributos: { justificativa: 'porque sim' }, rivais: { disputar_edital_federal: 'saneamento' } }, 'regras');
    avancarDisputa(d);
  }
  assert.equal(d.ano, 2126);
  const g = d.cidades[0].gabinete;
  assert.ok(g.length > 40 && g[0].ano === 2026 && g[0].decisao.tributos.justificativa === 'porque sim' && g[0].politica.orcamento.educacao > 20);
  assert.ok(d.log.some((l) => l.texto.includes('edital federal')));
  const c = d.cidades[1];
  registrarTokens(c, TOKENS_SECULO - 100);
  assert.ok(!temTokens(c));
  assert.equal(dossie(d, c).tokens.restantes_ate_2126, 100);
  JSON.parse(JSON.stringify(d));
});
