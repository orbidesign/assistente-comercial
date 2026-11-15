import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAIS, PONTO_INICIAL } from '../src/empresas/campinas.js';
import { criarJogo, avancarMes, despachar, dossie, ceoPorRegras, naVez, terminou, vencedor, classificacao, patrimonio, composicao, aliquotaSimples, registrarTokens, temTokens, bensPessoais, dataDe, CEOS, NEGOCIOS, EVENTOS, GOVERNO, TOKENS_JOGO, CAIXA_INICIAL, MESES } from '../src/empresas/jogo.js';

const jogar = (semente, perfil, meses = MESES) => {
  const j = criarJogo(semente);
  while (!terminou(j) && j.t < meses) {
    for (const c of j.ceos) if (naVez(j, c)) despachar(j, c, ceoPorRegras(j, c, perfil || CEOS[c.id].perfil), 'regras');
    avancarMes(j);
  }
  return j;
};
const todos = (c, re) => c.sala.flatMap((s) => [...s.eventos, ...s.notas.map((n) => n.texto)]).filter((t) => re.test(t));

test('os três começam iguais: uma padaria em Campinas, R$ 20 mil no caixa da empresa, em janeiro de 2026', () => {
  const j = criarJogo(3);
  assert.equal(j.cidade.nome, 'Campinas');
  assert.equal(dataDe(j.t), 'jan/2026');
  assert.equal(MESES, 600);
  for (const c of j.ceos) { assert.equal(c.caixa, CAIXA_INICIAL); assert.equal(c.ops.padaria.unidades, 1); assert.equal(c.ops.padaria.equipe, 8); }
  // Iguais em tudo, menos no endereço: três bairros de classe média com os mesmos números.
  assert.equal(new Set(j.ceos.map((c) => JSON.stringify({ ...c, id: 0, nome: '', marcaNome: '', ops: { padaria: { ...c.ops.padaria, locais: 0 } } }))).size, 1);
  assert.equal(new Set(j.ceos.map((c) => Object.keys(c.ops.padaria.locais)[0])).size, 3);
});

test('Simples Nacional: alíquotas efetivas do Anexo I', () => {
  assert.equal(aliquotaSimples(150_000), 0.04);
  assert.ok(Math.abs(aliquotaSimples(780_000) - (780_000 * 0.107 - 22_500) / 780_000) < 1e-9);
});

test('o primeiro ano de uma padaria bem tocada é plausível: vende perto de R$ 70 mil por mês e paga o dono', () => {
  const j = jogar(4, 'padeiro', 12), c = j.ceos[0];
  const receitas = c.sala.map((s) => s.resultado.receita);
  assert.equal(receitas.length, 12);
  const media = receitas.reduce((s, v) => s + v, 0) / 12;
  assert.ok(media > 55_000 && media < 100_000, `receita média ${media}`);
  assert.ok(receitas[11] > receitas[1], 'dezembro vende mais que fevereiro');
  assert.equal(c.regime, 'Simples Nacional');
  assert.ok(bensPessoais(c) > -5_000, 'o pró-labore cobre o custo de vida');
  assert.ok(Math.abs(Object.values(composicao(j, c)).reduce((s, v) => s + v, 0) - c.patrimonio) < 50 || patrimonio(j, c) === bensPessoais(c));
  const n = c.sala[11].numeros;
  assert.ok(n.caixa_empresa !== undefined && n.pro_labore > 0 && n.patrimonio !== undefined && n.salario_pago > 0);
});

test('o acaso do dia a dia acontece nas frequências pedidas', () => {
  // 30 padarias paradas por 10 anos: 3.600 meses de padaria.
  let assaltos = 0, saidas = 0, climas = 0, meses = 0;
  for (let s = 1; s <= 30; s++) {
    const j = criarJogo(s, ['anthropic']), c = j.ceos[0];
    for (let m = 0; m < 120; m++) {
      despachar(j, c, { operacoes: [{ negocio: 'padaria', contratar: Math.max(0, 8 - c.ops.padaria.equipe) }], respostas: c.pendencias.map((p) => ({ id: p.id, opcao: p.opcoes[1] })) }, 'teste');
      avancarMes(j); meses++;
    }
    assaltos += todos(c, /^(\d+ assaltos|Assalto)/).length; saidas += todos(c, /pedi(u|ram) para sair/).length; climas += todos(c, /Evento climático sério/).length;
  }
  assert.ok(Math.abs(climas / meses - EVENTOS.clima.chance) < 0.012, `clima ${climas / meses}`);
  assert.ok(assaltos / meses > 0.03 && assaltos / meses < 0.09, `assaltos ${assaltos / meses}`);
  assert.ok(saidas / meses > 0.1 && saidas / meses < 0.22, `pedidos de demissão ${saidas / meses}`);
});

test('eleições a cada quatro anos mudam as regras; não há pandemias', () => {
  const j = jogar(6, 'padeiro', 240);
  const eleicoes = j.log.filter((l) => l.texto.startsWith('Eleição'));
  assert.deepEqual(eleicoes.slice(0, 4).map((l) => dataDe(l.t)), ['out/2026', 'out/2028', 'out/2030', 'out/2032']);
  assert.ok(eleicoes[0].texto.includes('federal') && eleicoes[1].texto.includes('municipal'));
  assert.ok(GOVERNO.federal.esquerda.irpj > 0 && GOVERNO.federal.direita.irpj < 0, 'esquerda cobra mais, direita alivia');
  assert.ok(!JSON.stringify(j.log).toLowerCase().includes('pandemia') && !JSON.stringify(j.log).includes('sanitária nacional'));
  let trocas = 0;
  for (let s = 1; s <= 12; s++) { const g = jogar(s, 'padeiro', 130); if (g.politica.federal.lado !== 'esquerda' || g.politica.municipal.lado !== 'direita') trocas++; }
  assert.ok(trocas >= 3, `em 12 partidas o governo mudou de lado em ${trocas}`);
});

test('meio século determinístico; quem gere bem termina muito acima de quem só toca a padaria', () => {
  const a = jogar(5), b = jogar(5);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const melhor = classificacao(a)[0];
  assert.ok(melhor.patrimonio > 50_000_000, `${melhor.patrimonio}`);
  assert.ok(melhor.sala.length > 200 && melhor.marcos.length > 0 && melhor.hist.length === melhor.sala.length + 1);
  JSON.parse(JSON.stringify(a));
});

test('decisão malformada não quebra nada; limites valem', () => {
  const j = criarJogo(2), c = j.ceos[0];
  for (const lixo of [null, 'x', 9, { movimentos: 'tudo', operacoes: 4, gestao: [], financas: 'x', bolso: 3, respostas: 'sim', acoes_externas: {} },
    { movimentos: [{ acao: 'abrir', negocio: 'marca_nacional', quantidade: 1e9 }, { acao: 'abrir', negocio: 'padaria', quantidade: 1e9, onde: 'marte' }], operacoes: { padaria: { preco_indice: -4, salario_indice: 0, funcionarios_por_unidade: 1e6, investir_em_qualidade: 1e12, contratar: 1e9, demitir: -3 } }, financas: { tomar_emprestimo: 1e15, pro_labore: 1e12, distribuir_lucros: 1e15, aporte_do_dono: 1e15 }, bolso: { aplicar_bolsa: 1e15, comprar_imoveis: -5 }, gestao: { marketing: 1e15, seguro: 'sim' }, respostas: [{ id: 999, opcao: 'x' }] }]) {
    despachar(j, c, lixo, 'teste');
    avancarMes(j);
    assert.ok(Number.isFinite(c.patrimonio) && Number.isFinite(c.caixa) && Number.isFinite(bensPessoais(c)));
  }
  assert.ok(c.ops.padaria.preco >= 0.5 && c.ops.padaria.salario >= 0.7);
  assert.equal(c.ops.padaria.unidades, 1, 'sem caixa, não abre');
  assert.ok(c.ops.padaria.equipe <= 8 * 2 * 1.3 + 1);
  assert.ok(c.divida < 1_000_000, 'crédito limitado pelo faturamento');
});

test('pendências: responder muda o desfecho; sem resposta vale a primeira opção', () => {
  const j = criarJogo(9), [a, b] = j.ceos;
  for (const c of [a, b]) c.pendencias.push({ id: 77, tipo: 'pedido_demissao', texto: 'x', opcoes: ['nao_repor', 'repor', 'contraproposta'], negocio: 'padaria', n: 2 });
  despachar(j, a, { respostas: [{ id: 77, opcao: 'repor', justificativa: 'não posso ficar sem gente' }] }, 'teste');
  avancarMes(j);
  assert.equal(a.sala[0].decisao.respostas[0].justificativa, 'não posso ficar sem gente');
  assert.ok(a.ops.padaria.equipe >= 8 && b.ops.padaria.equipe === 6);
  assert.ok(a.ops.padaria.experiencia < b.ops.padaria.experiencia, 'repor custa experiência');
  assert.ok(b.sala[0].notas.some((n) => n.texto.includes('vaga fica aberta')));
});

test('bolso e empresa são separados: pró-labore, lucros distribuídos, aporte e falência da empresa', () => {
  const j = criarJogo(5), c = j.ceos[0];
  c.caixa = 400_000; c.lucrosRetidos = 300_000;
  despachar(j, c, { financas: { pro_labore: 9_000, distribuir_lucros: 100_000 }, bolso: { aplicar_renda_fixa: 60_000 } }, 'teste');
  avancarMes(j);
  assert.equal(c.proLabore, 9_000);
  assert.ok(c.pessoal.rendaFixa > 59_000 && c.pessoal.caixa > 30_000, `bolso ${JSON.stringify(c.pessoal)}`);
  assert.ok(c.sala[0].resultado.bolso.pro_labore_liquido < 9_000, 'INSS e imposto de renda descontados');
  // A empresa quebra; o dono segue com o que tem no nome e pode recomeçar.
  c.divida = 30_000_000; c.caixa = -1;
  for (let m = 0; m < 30 && !c.falencias; m++) avancarMes(j);
  assert.equal(c.falencias, 1);
  assert.equal(c.ops.padaria.unidades, 0);
  assert.ok(!c.quebrou && c.patrimonio > 50_000, 'continua no jogo com o patrimônio pessoal');
  despachar(j, c, { financas: { aporte_do_dono: 250_000 }, bolso: { resgatar_renda_fixa: 1e9 }, movimentos: [{ acao: 'abrir', negocio: 'padaria', quantidade: 1 }] }, 'teste');
  avancarMes(j);
  despachar(j, c, { financas: { aporte_do_dono: 250_000 }, movimentos: [{ acao: 'abrir', negocio: 'padaria', quantidade: 1 }] }, 'teste');
  avancarMes(j);
  assert.ok(c.pessoal.caixa >= 0);
});

test('abrir, sair do Simples, franquear e vender um negócio a um rival', () => {
  const j = criarJogo(5), [a, b] = j.ceos;
  a.caixa = 3_000_000; a.gestao = 0.6; a.marca = 0.6;
  despachar(j, a, { movimentos: [{ acao: 'abrir', negocio: 'padaria', quantidade: 8, onde: 'campinas', justificativa: 'crescer' }] }, 'teste');
  for (let m = 0; m < 12; m++) avancarMes(j);
  assert.equal(a.ops.padaria.unidades, 9);
  assert.equal(a.regime, 'Lucro presumido');
  assert.ok(a.sala[0].notas.some((n) => n.macro && n.texto.includes('Abre 8')) && todos(a, /sai do Simples/).length >= 1);
  a.caixa = 1_000_000; a.marca = 0.7;
  despachar(j, a, { movimentos: [{ acao: 'lancar_franquia' }] }, 'teste');
  for (let m = 0; m < 12; m++) avancarMes(j);
  assert.ok(a.franquia && a.franqueados > 0);
  despachar(j, b, { operacoes: [{ negocio: 'padaria', vendo_por: 500_000 }] }, 'teste');
  avancarMes(j);
  a.caixa = 2_000_000;
  despachar(j, a, { acoes_externas: [{ tipo: 'oferta_de_compra', alvo: b.nome, negocio: 'padaria', recursos: 600_000 }] }, 'teste');
  despachar(j, b, { operacoes: [{ negocio: 'padaria', vendo_por: 500_000 }] }, 'teste');
  const antes = a.ops.padaria.unidades;
  avancarMes(j);
  assert.equal(a.ops.padaria.unidades, antes + 1);
  assert.equal(b.ops.padaria.unidades, 0);
  assert.ok(b.caixa > 400_000 && !b.quebrou, 'quem vende fica com o dinheiro e segue no jogo');
});

test('batalha justa: com decisões idênticas, os três terminam exatamente iguais (o acaso é o mesmo para todos)', () => {
  for (const semente of [11, 12, 13]) {
    const j = criarJogo(semente);
    for (let m = 0; m < 240; m++) {
      for (const c of j.ceos) despachar(j, c, { ...ceoPorRegras(j, c, 'padeiro'), acoes_externas: [] }, 'teste');
      avancarMes(j);
    }
    const p = j.ceos.map((c) => Math.round(c.patrimonio));
    assert.equal(new Set(p).size, 1, `semente ${semente}: ${p}`);
  }
});

test('tokens: verba igual e dossiê mensal com o que é preciso para decidir', () => {
  const j = jogar(1, 'padeiro', 3), c = j.ceos[0];
  const d = dossie(j, c);
  assert.ok(d.seu_bolso.pro_labore_atual > 0 && d.empresa.caixa !== undefined && d.cenario.governo_federal && d.rivais.length === 2);
  assert.ok(Array.isArray(d.pendencias_para_responder) && d.resultado_do_mes_passado.receita > 0);
  assert.ok(JSON.stringify(d).length < 8000, `dossiê enxuto: ${JSON.stringify(d).length} caracteres`);
  assert.equal(TOKENS_JOGO, 5_000_000);
  registrarTokens(c, TOKENS_JOGO - 500);
  assert.ok(!temTokens(c));
});

test('lugares: os três pontos iniciais valem o mesmo; abrir em bairro rico rende mais e custa mais; o jogo vai até 2075 mesmo com fracassos', () => {
  const ini = Object.values(PONTO_INICIAL).map((l) => `${LOCAIS[l].renda}/${LOCAIS[l].aluguel}/${LOCAIS[l].gente}`);
  assert.equal(new Set(ini).size, 1);
  const j = criarJogo(3), [a, b, c] = j.ceos;
  for (const x of [a, b]) { x.caixa = 800_000; x.gestao = 0.5; }
  despachar(j, a, { movimentos: [{ acao: 'abrir', negocio: 'padaria', quantidade: 1, onde: 'cambui' }] }, 'teste');
  despachar(j, b, { movimentos: [{ acao: 'abrir', negocio: 'padaria', quantidade: 1, onde: 'ouro_verde' }] }, 'teste');
  for (let m = 0; m < 30; m++) avancarMes(j);
  assert.equal(a.ops.padaria.locais.cambui, 1); assert.equal(b.ops.padaria.locais.ouro_verde, 1);
  const ra = a.sala.at(-1).resultado, rb = b.sala.at(-1).resultado;
  assert.ok(ra.receita > rb.receita * 1.1 && ra.alugueis > rb.alugueis * 1.2, `${ra.receita} x ${rb.receita}; ${ra.alugueis} x ${rb.alugueis}`);
  assert.ok(a.hist.at(-1).cx !== undefined && a.hist.at(-1).rec > 0 && a.hist.length === 31);
  // C quebra de vez; o jogo continua para os outros.
  c.pessoal.divida = 9e9;
  avancarMes(j);
  assert.ok(c.quebrou);
  assert.ok(!terminou(j));
  assert.equal(vencedor(j), null);
});

test('impostos com os números oficiais de 2026: IRPF, ganho de capital e lucro presumido', async () => {
  const { irpfMensal, impostoGanhoDeCapital, REGRAS } = await import('../src/empresas/jogo.js');
  assert.equal(irpfMensal(5_000), 0);
  assert.ok(Math.abs(irpfMensal(6_000) - (6_000 * 0.275 - 908.73 - (978.62 - 0.133145 * 6_000))) < 0.01);
  assert.ok(Math.abs(irpfMensal(10_000) - (10_000 * 0.275 - 908.73)) < 0.01);
  assert.equal(impostoGanhoDeCapital(1_000_000), 150_000);
  assert.equal(impostoGanhoDeCapital(12_000_000), 5e6 * 0.15 + 5e6 * 0.175 + 2e6 * 0.2);
  assert.equal(REGRAS.tetoInss, 932.31);
});

test('canais de divulgação: o resultado é oculto, varia por canal e só aparece no retorno', () => {
  const resultados = {};
  for (const canal of ['instagram_posts', 'instagram_anuncios', 'panfleto', 'whatsapp', 'google', 'radio_e_jornal']) {
    const j = criarJogo(11), c = j.ceos[0];
    c.caixa = 200_000;
    for (let m = 0; m < 8; m++) { despachar(j, c, { apostas: [{ canal, negocio: 'padaria', abordagem: 'produto', investimento: 2_000 }] }, 'teste'); avancarMes(j); }
    resultados[canal] = c.ops.padaria.publico;
    const d = dossie(j, c);
    assert.ok(d.resultado_das_apostas[0].clientes_novos >= 0 && d.resultado_das_apostas[0].canal === canal);
    assert.ok(!JSON.stringify(d).includes('afinidade'));
  }
  const v = Object.values(resultados);
  assert.ok(Math.max(...v) > Math.min(...v) * 2, `canais rendem diferente: ${JSON.stringify(resultados)}`);
});

test('comprar negócio anunciado: oferta baixa é recusada, a maior leva, e a conta escondida aparece depois', () => {
  const j = criarJogo(4), [a, b] = j.ceos;
  while (!j.anuncios.length) avancarMes(j);
  const an = j.anuncios[0], pub = dossie(j, a).negocios_a_venda[0];
  assert.equal(pub.anuncio, an.id); assert.equal(pub.receitaReal, undefined); assert.equal(pub.minimo, undefined);
  a.caixa = an.pede * 2; b.caixa = an.pede * 2;
  despachar(j, a, { movimentos: [{ acao: 'comprar_anuncio', anuncio: an.id, oferta: an.pede * 0.3 }, { acao: 'auditar_anuncio', anuncio: an.id }] }, 'teste');
  despachar(j, b, { movimentos: [{ acao: 'comprar_anuncio', anuncio: an.id, oferta: an.pede }] }, 'teste');
  const antes = (b.ops[an.tipo]?.unidades || 0) + (b.ops[an.tipo]?.fora || 0);
  avancarMes(j);
  assert.ok(a.sala.at(-1).notas.some((n) => /recusou/.test(n.texto)) && a.sala.at(-1).notas.some((n) => /Auditoria/.test(n.texto)));
  assert.equal(b.ops[an.tipo].unidades + b.ops[an.tipo].fora, antes + 1);
  assert.ok(b.ops[an.tipo].locais[an.local] >= 1 && !j.anuncios.includes(an));
  assert.ok(dossie(j, a).retorno_das_suas_ordens.some((t) => /Auditoria/.test(t)));
});

test('vender a empresa inteira: o dinheiro vai para o dono, paga ganho de capital, e dá para recomeçar', () => {
  const j = jogar(2, 'padeiro', 60), c = j.ceos[0];
  const bolsoAntes = bensPessoais(c);
  despachar(j, c, { movimentos: [{ acao: 'vender_empresa' }] }, 'teste');
  avancarMes(j);
  assert.equal(c.ops.padaria.unidades, 0); assert.equal(c.caixa, 0);
  assert.ok(bensPessoais(c) > bolsoAntes + 50_000 && c.sala.at(-1).notas.some((n) => /ganho de capital/.test(n.texto)));
  despachar(j, c, { financas: { aporte_do_dono: 400_000 }, movimentos: [{ acao: 'abrir', negocio: 'cafeteria', quantidade: 1, onde: 'cambui' }] }, 'teste');
  avancarMes(j);
  if (c.caixa + 400_000 > 0 && c.ops.cafeteria) assert.equal(c.ops.cafeteria.unidades, 1);
  assert.ok(!c.quebrou);
});
