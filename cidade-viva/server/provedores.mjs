// Os três competidores da Arena. Cada função recebe o mesmo texto de sistema e
// a mesma situação, e devolve { texto, entrada, saida } (tokens cobrados).
// Modelos e preços vêm de variáveis de ambiente, porque mudam com frequência.
import Anthropic from '@anthropic-ai/sdk';
import { NEGOCIOS, FRANQUIA, EVENTOS, ACOES, GOVERNO, VALENCIAS } from '../src/empresas/jogo.js';
import { LOCAIS } from '../src/empresas/campinas.js';

const env = process.env;
const preco = (v, padrao) => (v ? v.split(',').map(Number) : padrao);

// Por padrão, um modelo de cada casa na mesma faixa de preço (cerca de US$ 2 por
// milhão de tokens de entrada), para a disputa ser de inteligência e não de bolso.
export const PROVEDORES = {
  anthropic: { chave: env.ANTHROPIC_API_KEY, modelo: env.ARENA_MODELO_ANTHROPIC || 'claude-sonnet-5-5', precos: preco(env.ARENA_PRECO_ANTHROPIC, [2, 10]) },
  xai: { chave: env.XAI_API_KEY, modelo: env.ARENA_MODELO_XAI || 'grok-4.7', precos: preco(env.ARENA_PRECO_XAI, [2, 6]) },
  gemini: { chave: env.GEMINI_API_KEY || env.GOOGLE_API_KEY, modelo: env.ARENA_MODELO_GEMINI || 'gemini-3.1-pro', precos: preco(env.ARENA_PRECO_GEMINI, [2, 12]) },
};

const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const ESQUEMA = obj({
  plano: { type: 'string' }, fala: { type: 'string' }, imposto: { type: 'number' }, construir: { type: 'string' },
  proxima_reuniao_anos: { type: 'integer' }, recrutar: { type: 'integer' }, dispensar: { type: 'integer' }, pesquisa: { type: 'number' }, auxilio: { type: 'number' },
  fomento: { type: 'string' }, atacar: { type: 'string' }, mensagem: obj({ para: { type: 'string' }, texto: { type: 'string' } }),
});

let clienteAnthropic = null;
async function anthropic(cfg, sistema, usuario, esquema = ESQUEMA) {
  clienteAnthropic ||= new Anthropic({ apiKey: cfg.chave });
  const corpo = {
    model: cfg.modelo, max_tokens: 8000, system: sistema,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: esquema } },
    messages: [{ role: 'user', content: usuario }],
  };
  let r;
  try {
    r = await clienteAnthropic.beta.messages.create({ ...corpo, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  } catch (e) {
    if (!(e instanceof Anthropic.BadRequestError)) throw e;
    r = await clienteAnthropic.messages.create(corpo);
  }
  if (r.stop_reason === 'refusal') throw new Error('o modelo recusou o pedido');
  const u = r.usage || {};
  return {
    texto: r.content.find((b) => b.type === 'text')?.text || '',
    entrada: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
    saida: u.output_tokens || 0,
  };
}

async function http(url, cabecalhos, corpo) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...cabecalhos }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(120000) });
  const texto = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${texto.slice(0, 200)}`);
  return JSON.parse(texto);
}

// A API da xAI segue o formato de chat completions.
async function xai(cfg, sistema, usuario) {
  const r = await http('https://api.x.ai/v1/chat/completions', { authorization: `Bearer ${cfg.chave}` }, {
    model: cfg.modelo, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
  });
  const u = r.usage || {};
  const entrada = u.prompt_tokens || 0;
  // O raciocínio é cobrado como saída; total menos entrada cobre os dois casos.
  return { texto: r.choices?.[0]?.message?.content || '', entrada, saida: Math.max(u.completion_tokens || 0, (u.total_tokens || 0) - entrada) };
}

async function gemini(cfg, sistema, usuario) {
  const r = await http(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.modelo)}:generateContent`, { 'x-goog-api-key': cfg.chave }, {
    systemInstruction: { parts: [{ text: sistema }] },
    contents: [{ role: 'user', parts: [{ text: usuario }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });
  const u = r.usageMetadata || {};
  return {
    texto: (r.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(''),
    entrada: u.promptTokenCount || 0,
    saida: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
  };
}

const CHAMAR = { anthropic, xai, gemini };

// Modo de ensaio (ARENA_ENSAIO=1): não chama ninguém e não gasta nada. Serve
// para testar o fluxo da Arena de ponta a ponta sem chaves.
function ensaio(situacao) {
  const v = situacao.voce;
  const obra = v.pode_construir.find((o) => o.custo <= v.tesouro);
  return {
    texto: JSON.stringify({
      plano: 'Ensaio: crescer e investir em saber.', fala: `Ensaio de ${v.cidade}: seguimos firmes.`, imposto: 0.1,
      construir: obra ? obra.tipo : 'nada', recrutar: v.tesouro > 150 ? 3 : 0, dispensar: 0, pesquisa: Math.max(0, v.tesouro * 0.2), auxilio: 0,
      fomento: 'nenhum', atacar: 'nenhuma', mensagem: { para: '', texto: '' }, proxima_reuniao_anos: 5,
    }),
    entrada: 1500, saida: 400,
  };
}

export function extrairJSON(texto) {
  const limpo = String(texto).replace(/```(?:json)?/g, '');
  const i = limpo.indexOf('{'), f = limpo.lastIndexOf('}');
  if (i < 0 || f <= i) throw new Error('a resposta não trouxe um objeto JSON');
  return JSON.parse(limpo.slice(i, f + 1));
}

export const ativo = (id) => !!PROVEDORES[id]?.chave || env.ARENA_ENSAIO === '1';

export const SISTEMA_ARENA = `Você governa uma cidade em um jogo de estratégia. Três cidades, cada uma governada por uma inteligência artificial diferente, partem de situações idênticas e disputam qual se torna a mais próspera e imponente no menor tempo. Você controla apenas o governo: o povo e os empresários agem por conta própria e reagem às suas decisões.

Objetivo: maximizar os pontos da sua cidade (era alcançada, população, conhecimento, felicidade e educação) e chegar antes das rivais às próximas eras.

Como o mundo funciona:
- O tesouro vem dos impostos sobre salários e lucros. Imposto alto arrecada mais, mas derruba a confiança dos empresários (menos negócios e empregos) e a felicidade. Serviços e soldados custam todo mês.
- Avançar de era exige população, conhecimento e, às vezes, um serviço específico (veja "proxima_era"). O conhecimento cresce com população e educação (escola, universidade) e com dinheiro investido em pesquisa.
- Legitimidade baixa por muito tempo derruba o governo. Felicidade muito baixa faz famílias irem embora.
- Guerra: um ataque parte com 70% do seu exército e chega em um ano. Se vencer, você saqueia tesouro e riqueza da rival e destrói construções dela; se perder, perde a maior parte da tropa. Quem defende tem vantagem (ainda maior com posto da guarda). É preciso ter ao menos 10 soldados para atacar. Atacar, defender-se, negociar ou ignorar as rivais é escolha estratégica sua.
- Tokens são o seu recurso mais escasso. Todas as cidades têm exatamente a mesma verba de tokens (o que você lê, raciocina e escreve conta). Veja "tokens" na situação: se a verba do milênio acabar, você fica sem se reunir e suas políticas ficam congeladas. Você escolhe quando será a próxima reunião: reunir-se menos poupa tokens, reunir-se mais reage mais rápido.

Responda apenas com um objeto JSON, sem texto fora dele, com exatamente estes campos:
{
  "plano": "nota curta para você mesmo ler na próxima reunião (sua única memória)",
  "fala": "uma frase pública, em primeira pessoa, com personalidade",
  "imposto": alíquota desejada entre 0 e 0.45,
  "construir": um "tipo" de "pode_construir" que caiba no tesouro, ou "nada",
  "recrutar": número de soldados a recrutar (6 moedas cada, mais soldo mensal), ou 0,
  "dispensar": número de soldados a dispensar, ou 0,
  "pesquisa": moedas do tesouro a investir em conhecimento, ou 0,
  "auxilio": moedas do tesouro a distribuir às famílias mais pobres, ou 0,
  "fomento": um "tipo" de "pode_fomentar" para subsidiar a abertura de um negócio (o tesouro paga metade), ou "nenhum",
  "atacar": o nome de uma cidade rival, ou "nenhuma",
  "mensagem": { "para": nome de uma rival ou "", "texto": mensagem diplomática ou "" },
  "proxima_reuniao_anos": daqui a quantos anos você volta a se reunir (5 a 50, em múltiplos de 5)
}`;

// ---------- o empresário: da padaria de bairro em Campinas, mês a mês, até 2125 ----------

const txt = { type: 'string' }, n = { type: 'number' }, int = { type: 'integer' }, bool = { type: 'boolean' };
const ESQUEMA_CEO = obj({
  diario: txt, estrategia: txt,
  respostas: { type: 'array', items: obj({ id: int, opcao: txt, justificativa: txt }) },
  operacoes: { type: 'array', items: obj({ negocio: txt, preco_indice: n, salario_indice: n, funcionarios_por_unidade: n, contratar: int, demitir: int, investir_em_qualidade: n, vendo_por: n, justificativa: txt }) },
  movimentos: { type: 'array', items: obj({ acao: { type: 'string', enum: ['abrir', 'fechar', 'vender', 'lancar_franquia'] }, negocio: txt, quantidade: int, onde: txt, justificativa: txt }) },
  agenda: { type: 'array', items: obj({ dia: int, area: { type: 'string', enum: Object.keys(VALENCIAS) }, acao: txt, investimento: n }) },
  gestao: obj({ seguro: bool, reposicao_de_pessoal: { type: 'string', enum: ['manual', 'automatica'] }, justificativa: txt }),
  financas: obj({ pro_labore: n, distribuir_lucros: n, aporte_do_dono: n, tomar_emprestimo: n, amortizar_divida: n, justificativa: txt }),
  bolso: obj({ aplicar_renda_fixa: n, resgatar_renda_fixa: n, aplicar_bolsa: n, resgatar_bolsa: n, comprar_imoveis: n, vender_imoveis: n, pagar_divida_pessoal: n, justificativa: txt }),
  acoes_externas: { type: 'array', items: obj({ tipo: txt, alvo: txt, negocio: txt, recursos: n, justificativa: txt }) },
  acao_livre: txt, fala: txt, memoria: txt, proximo_despacho_em_meses: int,
});

const R$ = (v) => `R$ ${v.toLocaleString('pt-BR')}`;
// As regras fixas do mundo ficam aqui, no texto de sistema, iguais para os três;
// o dossiê de cada mês traz só o que muda.
export const SISTEMA_CEO = `Você é um empresário em Campinas (SP). Em janeiro de 2026 você tem uma padaria de bairro, 8 funcionários e R$ 20 mil no caixa da empresa. Dois rivais, cada um comandado por outra inteligência artificial, começam exatamente iguais. O jogo anda mês a mês até dezembro de 2125. Vence quem tiver o maior patrimônio pessoal: o que está no seu nome (conta, aplicações, imóveis, menos dívidas) mais o valor da sua empresa.

Todo mês você recebe um relatório e despacha. É a vida de um empresário de verdade: pagar as contas, segurar a equipe, reagir ao que acontece e decidir como crescer. Valores em reais, a preços de 2026.

EMPRESA E BOLSO SÃO SEPARADOS
- Você vive do pró-labore que define (desconta 11% de INSS e imposto de renda acima de R$ 5 mil). Se ele não cobre o seu custo de vida, a diferença vira dívida pessoal a 3,5% ao mês.
- Lucro acumulado pode ser distribuído para o seu bolso (isento até R$ 50 mil por mês; 10% acima disso). Você também pode pôr dinheiro seu na empresa (aporte).
- No bolso você aplica em renda fixa (juros reais do ano), bolsa (média de 6,5% ao ano, com meses de queda forte) e imóveis (aluguel de 5% ao ano e valorização).
- Se a empresa quebrar, você fica com o que tem no próprio nome e pode recomeçar. Você só sai do jogo se as suas dívidas superarem tudo o que tem.

AS VALÊNCIAS DA EMPRESA
Sua empresa tem ${Object.keys(VALENCIAS).length} áreas, cada uma com um nível de 0 a 1. Todas começam medianas e iguais às dos rivais: ninguém nasce melhor em nada. Você decide onde ficar forte. Dinheiro posto em uma área (pela agenda) sobe o nível, com retorno cada vez menor; sem cuidado, a área volta devagar ao piso. Empresa maior precisa de mais dinheiro para o mesmo ganho.
${Object.entries(VALENCIAS).map(([k, v]) => `- ${k} (${v.nome}): ${v.efeito}.`).join('\n')}

COMO UM NEGÓCIO VENDE
Vendas dependem da qualidade de cada negócio, das valências acima, do preço (1 é o preço comum do mercado), de equipe completa e experiente e do salário (abaixo do mercado o atendimento piora, pode dar greve e mais gente pede para sair). Dezembro vende mais, janeiro e fevereiro menos. Campinas satura: muitas unidades do mesmo negócio dividem a clientela; fora de Campinas não satura tão cedo, mas exige mais gestão.

LUGARES
Cada unidade fica em um lugar do mapa real. O lugar muda a venda (renda do bairro), o aluguel e quantas unidades do mesmo negócio cabem antes de dividir a clientela (somando as suas e as dos rivais). Em "onde" use o id de um lugar; "campinas" ou "fora" deixam o jogo escolher o melhor lugar livre. Lugares marcados com * ficam fora de Campinas.
id (renda, aluguel, cabem): ${Object.entries(LOCAIS).map(([id, l]) => `${id}${l.fora ? '*' : ''} (${l.renda}, ${l.aluguel}, ${l.gente})`).join('; ')}.

O jogo sempre vai até dezembro de 2125. Não há prêmio por crescer primeiro nem por sobrar sozinho: vale só o seu patrimônio pessoal no fim. Fracassar, estagnar ou ficar com uma padaria só são desfechos possíveis.

A AGENDA: O DIA A DIA
Em cada despacho você entrega a agenda do mês: de 4 a 12 ações datadas (dia de 1 a 30), cada uma em uma área, com o que fez e quanto investiu (pode ser zero). É o seu registro diário, e é por ela que o dinheiro chega às valências. Exemplos de ações do dia a dia:
- dia 3, compras: "Fechei farinha com o moinho por seis meses, preço travado", investimento 800
- dia 5, pessoas: "Treinei a atendente nova no caixa e na vitrine", investimento 300
- dia 8, marketing: "Fotos da fornada das 6h no Instagram e panfleto no prédio da esquina", investimento 500
- dia 11, financas: "Conciliei a maquininha e renegociei a taxa do cartão", investimento 0
- dia 14, design: "Troquei a vitrine e a iluminação do balcão", investimento 2500
- dia 17, vendas: "Visitei três escritórios do bairro oferecendo café da manhã por assinatura", investimento 200
- dia 20, produto: "Testei pão de fermentação natural aos sábados", investimento 600
- dia 23, manutencao: "Revisão preventiva do forno e da masseira", investimento 900
- dia 27, contabilidade: "Fechei o mês com o contador e revisei o enquadramento no Simples", investimento 400
Exemplos de decisões do mês (nos outros campos): mudar preço, reajustar salários, contratar ou demitir, definir o pró-labore, distribuir lucro, tomar ou pagar empréstimo, contratar seguro, abrir ou fechar unidade, lançar franquia, responder a quem pediu para sair, aceitar uma encomenda, aplicar o dinheiro do bolso.

NEGÓCIOS QUE VOCÊ PODE TER (por unidade, por ano)
${Object.entries(NEGOCIOS).map(([t, d]) => `- ${t}: ${d.nome}. Abrir custa ${R$(d.capex)}; vende cerca de ${R$(d.receita)}; insumos ${Math.round(d.insumo * 100)}% da receita; ${d.func} funcionários; aluguel ${R$(d.aluguel)}.${d.requer ? ` Exige ${Object.entries(d.requer).map(([k, v]) => `${k} ${v}`).join(' e ')}.` : ''}`).join('\n')}
- franquia: lançar custa ${R$(FRANQUIA.lancamento)}, exige 5 padarias próprias e marca 0,5; rende 6% do faturamento de cada franqueado mais taxa de adesão.

IMPOSTOS E LEIS
- Simples Nacional: receita dos últimos 12 meses até R$ 4,8 milhões. Paga de 4% a 19% da receita conforme a faixa e encargos de 35% sobre salários.
- Acima disso: cerca de 9% da receita em tributos sobre vendas (a partir de 2033, IVA sobre receita menos insumos), 34% sobre o lucro e encargos de 70% sobre salários. Passar do teto é um degrau caro.
- Demitir custa 25% do salário anual por pessoa. Contratar custa 60% de um salário mensal e o novato chega sem experiência.
- Sem caixa e sem crédito a empresa entra em recuperação judicial por dois anos (Lei 11.101/2005): não investe nem distribui lucro. Se não se recuperar, vai à falência.

QUEM GOVERNA MUDA O JOGO (eleição federal em outubro de 2026, 2030...; municipal em 2028, 2032...; posse em janeiro)
- Governo federal de esquerda: ${GOVERNO.federal.esquerda.texto}.
- Governo federal de direita: ${GOVERNO.federal.direita.texto}.
- Prefeitura de esquerda: ${GOVERNO.municipal.esquerda.texto}.
- Prefeitura de direita: ${GOVERNO.municipal.direita.texto}.

O ACASO DO DIA A DIA (chance por mês; os sorteios são os mesmos para os três empresários, o que muda é o quanto cada um se preparou)
${Object.values(EVENTOS).map((e) => `- ${e.nome} (${e.chance < 1 ? `${(e.chance * 100).toFixed(1).replace('.0', '')}% por ${e.base}` : e.base}): ${e.texto}`).join('\n')}
Algumas situações chegam como pendência, com opções. Responda pelo id. Sem resposta, vale a primeira opção, que costuma ser a pior. Com "reposicao_de_pessoal": "automatica", quem sai é reposto sem você precisar responder.

CONTRA OS RIVAIS, TUDO É ESTRATÉGIA
${Object.entries(ACOES).map(([t, a]) => `- ${t}: ${a.nome}. ${a.lei}.`).join('\n')}
As ilícitas rendem mais e podem ser descobertas: multa, dano à reputação e, em alguns casos, afastamento. A escolha e o risco são seus.

TOKENS
Os três têm a mesma verba para o jogo inteiro (veja "tokens" no relatório). Tudo o que você lê, raciocina e escreve conta, e este texto de regras é cobrado a cada despacho. Você escolhe quando volta a despachar (de 1 a 12 meses). Nos meses sem despacho, preço, salários, equipe ideal, pró-labore e seguro ficam como estão, nada novo é investido e as pendências são resolvidas pela primeira opção. Seja breve.

RESPOSTA
Responda apenas com um objeto JSON, sem texto fora dele. Quem assiste lê o seu diário e as justificativas: fale como dono de padaria, de forma concreta.
{
  "diario": "duas a quatro frases, em primeira pessoa: como foi o mês, o que decidiu e por quê",
  "estrategia": "só quando mudar de plano; senão, texto vazio",
  "respostas": [ { "id": número da pendência, "opcao": uma das opções dela, "justificativa": "..." } ],
  "operacoes": [ { "negocio": um que você tem, "preco_indice": número, "salario_indice": número (1 é o salário de mercado), "funcionarios_por_unidade": equipe ideal, "contratar": pessoas, "demitir": pessoas, "investir_em_qualidade": reais, "vendo_por": valor pelo qual aceita vender esse negócio inteiro a um rival, ou 0, "justificativa": "..." } ],
  "movimentos": [ { "acao": "abrir" | "fechar" | "vender" | "lancar_franquia", "negocio": do catálogo, "quantidade": número, "onde": id de um lugar | "campinas" | "fora", "justificativa": "..." } ],
  "agenda": [ { "dia": 1 a 30, "area": uma das valências, "acao": "o que você fez nesse dia, em uma frase", "investimento": reais } ],
  "gestao": { "seguro": true ou false, "reposicao_de_pessoal": "manual" | "automatica", "justificativa": "..." },
  "financas": { "pro_labore": reais por mês, "distribuir_lucros": reais, "aporte_do_dono": reais, "tomar_emprestimo": reais, "amortizar_divida": reais, "justificativa": "..." },
  "bolso": { "aplicar_renda_fixa": reais, "resgatar_renda_fixa": reais, "aplicar_bolsa": reais, "resgatar_bolsa": reais, "comprar_imoveis": reais, "vender_imoveis": reais, "pagar_divida_pessoal": reais, "justificativa": "..." },
  "acoes_externas": [ { "tipo": da lista acima, "alvo": nome do rival ou "", "negocio": para oferta de compra, "recursos": reais, "justificativa": "..." } ],
  "acao_livre": "qualquer outra coisa que você faria; fica registrada para quem assiste, mas não muda os números",
  "fala": "frase pública, se quiser dizer algo aos rivais",
  "memoria": "nota para você mesmo ler no próximo despacho (sua única memória)",
  "proximo_despacho_em_meses": 1 a 12
}
A agenda, as contratações, os movimentos e as finanças valem só para este mês. Use zeros e listas vazias onde não quiser agir.`;

function ensaioCEO(s) {
  const e = s.empresa, tem = e.negocios[0];
  const sobra = Math.max(0, e.caixa - (tem ? tem.receita_do_mes : 60000) * 0.35) / 3;
  const areas = ['compras', 'pessoas', 'marketing', 'produto', 'atendimento', 'gestao', 'contabilidade', 'manutencao'];
  const agenda = areas.map((area, i) => ({ dia: 2 + i * 3, area, acao: `Ensaio: cuidei de ${area}.`, investimento: Math.round(sobra * 0.05) }));
  const z = { seguro: e.caixa > 40000, reposicao_de_pessoal: 'manual', justificativa: 'Ensaio.' };
  return {
    texto: JSON.stringify({
      diario: `Ensaio de ${s.voce}, ${s.data}: caixa de ${e.caixa}, ${s.pendencias_para_responder.length} pendência(s). Sigo tocando a padaria.`, estrategia: '',
      respostas: s.pendencias_para_responder.map((p) => ({ id: p.id, opcao: p.opcoes[1] || p.opcoes[0], justificativa: 'Ensaio.' })),
      operacoes: tem ? [{ negocio: tem.negocio, preco_indice: 1, salario_indice: 1, funcionarios_por_unidade: 8, contratar: Math.max(0, tem.equipe_ideal - tem.equipe), demitir: 0, investir_em_qualidade: sobra * 0.12, vendo_por: 0, justificativa: 'Ensaio: preço de mercado, equipe completa.' }] : [],
      movimentos: sobra * 3 > 220000 && e.capacidade_de_gestao > e.carga_de_gestao + 1 ? [{ acao: 'abrir', negocio: 'padaria', quantidade: 1, onde: 'campinas', justificativa: 'Ensaio: o caixa cobre mais uma.' }] : [],
      agenda, gestao: z, financas: { pro_labore: Math.round(s.seu_bolso.custo_de_vida_mensal * 1.15), distribuir_lucros: 0, aporte_do_dono: 0, tomar_emprestimo: 0, amortizar_divida: 0, justificativa: 'Ensaio: pró-labore cobre a casa.' },
      bolso: { aplicar_renda_fixa: 0, resgatar_renda_fixa: 0, aplicar_bolsa: 0, resgatar_bolsa: 0, comprar_imoveis: 0, vender_imoveis: 0, pagar_divida_pessoal: 0, justificativa: '' },
      acoes_externas: [], acao_livre: '', fala: '', memoria: 'ensaio', proximo_despacho_em_meses: 1,
    }),
    entrada: 3300, saida: 420,
  };
}

// Tokens são contados como cada API os informa: entrada + saída, com o
// raciocínio incluído na saída. Uma resposta que não é JSON válido também é
// cobrada: quem erra o formato perde a reunião e os tokens.
export async function decidir(id, situacao, jogo = 'arena') {
  const cfg = PROVEDORES[id];
  const ceo = jogo === 'ceo';
  const r = env.ARENA_ENSAIO === '1' ? (ceo ? ensaioCEO(situacao) : ensaio(situacao))
    : await CHAMAR[id](cfg, ceo ? SISTEMA_CEO : SISTEMA_ARENA, JSON.stringify(situacao), ceo ? ESQUEMA_CEO : ESQUEMA);
  const custo = (r.entrada * cfg.precos[0] + r.saida * cfg.precos[1]) / 1e6;
  let decisao = null;
  try { decisao = extrairJSON(r.texto); } catch { /* resposta inválida */ }
  return { decisao, invalida: !decisao, custo, tokens: r.entrada + r.saida, entrada: r.entrada, saida: r.saida };
}
