import test from 'node:test';
import assert from 'node:assert/strict';
import { criarJogo, avancarJogo, despachar, dossie, ceoPorRegras, naVez, terminou, vencedor, classificacao, patrimonio, composicao, aliquotaSimples, registrarTokens, temTokens, ativos, CEOS, NEGOCIOS, TOKENS_SECULO, CAIXA_INICIAL } from '../src/empresas/jogo.js';

const jogar = (semente, perfil) => {
  const j = criarJogo(semente);
  while (!terminou(j)) {
    for (const c of j.ceos) if (naVez(j, c)) despachar(j, c, ceoPorRegras(j, c, perfil || CEOS[c.id].perfil), 'regras');
    avancarJogo(j);
  }
  return j;
};

test('os três começam iguais: uma padaria em Campinas e R$ 20 mil em caixa', () => {
  const j = criarJogo(3);
  assert.equal(j.cidade.nome, 'Campinas');
  assert.ok(j.cidade.pop > 1_000_000);
  for (const c of j.ceos) { assert.equal(c.caixa, CAIXA_INICIAL); assert.deepEqual(Object.keys(c.ops), ['padaria']); assert.equal(c.ops.padaria.unidades, 1); }
  assert.equal(new Set(j.ceos.map((c) => JSON.stringify({ ...c, id: 0, nome: '', marcaNome: '' }))).size, 1);
  assert.equal(new Set(j.ceos.map((c) => c.patrimonio)).size, 1);
});

test('Simples Nacional: alíquotas efetivas do Anexo I', () => {
  assert.equal(aliquotaSimples(150_000), 0.04);
  assert.ok(Math.abs(aliquotaSimples(780_000) - (780_000 * 0.107 - 22_500) / 780_000) < 1e-9);
  assert.ok(aliquotaSimples(4_800_000) > 0.11 && aliquotaSimples(4_800_000) < 0.12);
});

test('o primeiro ano de uma padaria parada é plausível', () => {
  const j = criarJogo(4);
  avancarJogo(j);
  const c = j.ceos[0];
  assert.ok(c.receita > 600_000 && c.receita < 900_000, `receita ${c.receita}`);
  assert.ok(c.lucro > 10_000 && c.lucro < 130_000, `lucro ${c.lucro}`);
  assert.equal(c.regime, 'Simples Nacional');
  assert.equal(Math.round(c.patrimonio), Math.round(patrimonio(j, c)));
  assert.ok(Math.abs(Object.values(composicao(j, c)).reduce((s, v) => s + v, 0) - c.patrimonio) < 5);
});

test('um século determinístico; gerir importa: perfis ativos terminam muito acima da padaria parada', () => {
  const a = jogar(7), b = jogar(7);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const parado = jogar(7, 'inercia');
  const melhor = classificacao(a)[0];
  assert.ok(melhor.patrimonio > Math.max(...parado.ceos.map((c) => c.patrimonio)) * 10, `${melhor.patrimonio}`);
  assert.equal(vencedor(a).ceo, melhor);
  assert.ok(melhor.hist.length > 30 && melhor.sala.length > 30 && melhor.marcos.length > 0);
  JSON.parse(JSON.stringify(a));
});

test('decisão malformada não quebra nada; limites valem', () => {
  const j = criarJogo(2), c = j.ceos[0];
  for (const lixo of [null, 'x', 9, { movimentos: 'tudo', operacoes: 4, gestao: [], financas: 'x', acoes_externas: {} },
    { movimentos: [{ acao: 'abrir', negocio: 'marca_nacional', quantidade: 1e9 }, { acao: 'abrir', negocio: 'padaria', quantidade: 1e9, onde: 'marte' }], operacoes: { padaria: { preco_indice: -4, salario_indice: 0, funcionarios_por_unidade: 1e6, investir_em_qualidade: 1e12 } }, financas: { tomar_emprestimo: 1e15, aplicar_bolsa: 1e15, comprar_imoveis: -5 }, gestao: { marketing: 1e15 } }]) {
    despachar(j, c, lixo, 'teste');
    avancarJogo(j);
    assert.ok(Number.isFinite(c.patrimonio) && Number.isFinite(c.caixa));
  }
  assert.ok(c.ops.padaria.preco >= 0.5 && c.ops.padaria.salario >= 0.75);
  assert.equal(c.ops.padaria.unidades, 1, 'sem caixa, não abre');
  assert.ok(Number.isFinite(c.divida) && c.divida < 2_000_000, 'crédito limitado pelo faturamento');
  assert.ok(c.sala.at(-1).notas.some((n) => !n.ok));
});

test('abrir, sair do Simples, franquear e vender um negócio a um rival', () => {
  const j = criarJogo(5), [a, b] = j.ceos;
  a.caixa = 3_000_000; a.gestao = 0.6; a.marca = 0.6;
  despachar(j, a, { movimentos: [{ acao: 'abrir', negocio: 'padaria', quantidade: 8, onde: 'campinas', justificativa: 'crescer' }], operacoes: [{ negocio: 'padaria', preco_indice: 1.05, vendo_por: 0, justificativa: 'margem' }] }, 'teste');
  avancarJogo(j);
  assert.equal(a.ops.padaria.unidades, 9);
  assert.equal(a.regime, 'Lucro real');
  assert.ok(a.sala[0].notas.some((n) => n.macro && n.texto.includes('Abre 8')) && a.sala[0].notas.some((n) => n.texto.includes('sai do Simples')));
  assert.equal(a.sala[0].decisao.movimentos[0].justificativa, 'crescer');
  a.caixa = 1_000_000; a.marca = 0.7;
  despachar(j, a, { movimentos: [{ acao: 'lancar_franquia' }] }, 'teste');
  avancarJogo(j);
  assert.ok(a.franquia && a.franqueados > 0);
  // B põe a padaria à venda; A compra.
  b.caixa = 0;
  despachar(j, b, { operacoes: [{ negocio: 'padaria', vendo_por: 500_000 }] }, 'teste');
  avancarJogo(j);
  a.caixa = 2_000_000;
  despachar(j, a, { acoes_externas: [{ tipo: 'oferta_de_compra', alvo: b.nome, negocio: 'padaria', recursos: 600_000 }] }, 'teste');
  despachar(j, b, { operacoes: [{ negocio: 'padaria', vendo_por: 500_000 }] }, 'teste');
  const antes = a.ops.padaria.unidades;
  avancarJogo(j);
  assert.equal(a.ops.padaria.unidades, antes + 1);
  assert.equal(b.ops.padaria.unidades, 0);
  assert.ok(b.caixa > 400_000 && !b.quebrou, 'quem vende fica com o dinheiro e segue no jogo');
});

test('ilícito pode ser descoberto; quem fica sem caixa e sem crédito quebra; último de pé vence', () => {
  let flagrantes = 0;
  for (let s = 1; s <= 30; s++) {
    const j = criarJogo(s), [a, b] = j.ceos;
    despachar(j, a, { acoes_externas: [{ tipo: 'difamacao', alvo: b.nome, recursos: 5000, justificativa: 'x' }] }, 'teste');
    avancarJogo(j);
    if (a.flagrantes) { flagrantes++; assert.ok(a.sala[0].notas.some((n) => n.texto.startsWith('DESCOBERTO'))); }
  }
  assert.ok(flagrantes > 4 && flagrantes < 26, `flagrantes ${flagrantes}`);
  const j = criarJogo(1);
  for (const c of j.ceos.slice(1)) { c.divida = 50_000_000; }
  while (!terminou(j)) avancarJogo(j);
  assert.equal(ativos(j).length, 1);
  assert.equal(vencedor(j).motivo, 'unico');
  assert.ok(j.ano < 2040);
});

test('tokens: verba igual e dossiê completo para decidir', () => {
  const j = criarJogo(1), c = j.ceos[0];
  const d = dossie(j, c);
  assert.equal(d.catalogo_de_negocios.length, Object.keys(NEGOCIOS).length);
  assert.ok(d.rivais.length === 2 && d.acoes_externas_possiveis.length > 10 && d.impostos.simples_nacional);
  registrarTokens(c, TOKENS_SECULO - 500);
  assert.ok(!temTokens(c));
  assert.equal(dossie(j, c).tokens.restantes_ate_2126, 500);
});

test('batalha justa: com decisões idênticas, os três terminam praticamente iguais (só a sorte da fiscalização varia)', () => {
  for (const semente of [11, 12, 13]) {
    const j = criarJogo(semente);
    for (let a = 0; a < 20; a++) {
      for (const c of j.ceos) despachar(j, c, { operacoes: [{ negocio: 'padaria', preco_indice: 1.02, salario_indice: 1 }], gestao: { marketing: c.caixa * 0.1, gestao: c.caixa * 0.1 } }, 'teste');
      avancarJogo(j);
    }
    const p = j.ceos.map((c) => c.patrimonio);
    assert.ok(Math.max(...p) / Math.min(...p) < 1.06, `semente ${semente}: ${p.map(Math.round)}`);
  }
});
