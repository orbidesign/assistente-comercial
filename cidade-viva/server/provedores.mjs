// Os três competidores da Arena. Cada função recebe o mesmo texto de sistema e
// a mesma situação, e devolve { texto, entrada, saida } (tokens cobrados).
// Modelos e preços vêm de variáveis de ambiente, porque mudam com frequência.
import Anthropic from '@anthropic-ai/sdk';

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

// ---------- o CEO: da padaria de bairro em Campinas até 2126 ----------

const txt = { type: 'string' }, n = { type: 'number' };
const ESQUEMA_CEO = obj({
  diagnostico: txt, estrategia: txt,
  movimentos: { type: 'array', items: obj({ acao: { type: 'string', enum: ['abrir', 'fechar', 'vender', 'lancar_franquia'] }, negocio: txt, quantidade: { type: 'integer' }, onde: { type: 'string', enum: ['campinas', 'fora'] }, justificativa: txt }) },
  operacoes: { type: 'array', items: obj({ negocio: txt, preco_indice: n, salario_indice: n, funcionarios_por_unidade: n, investir_em_qualidade: n, vendo_por: n, justificativa: txt }) },
  gestao: obj({ marketing: n, tecnologia: n, gestao: n, treinamento: n, compliance: n, justificativa: txt }),
  financas: obj({ tomar_emprestimo: n, amortizar_divida: n, aplicar_renda_fixa: n, resgatar_renda_fixa: n, aplicar_bolsa: n, resgatar_bolsa: n, comprar_imoveis: n, vender_imoveis: n, justificativa: txt }),
  acoes_externas: { type: 'array', items: obj({ tipo: txt, alvo: txt, negocio: txt, recursos: n, justificativa: txt }) },
  acao_livre: txt, fala: txt, memoria: txt, proxima_revisao_anos: { type: 'integer' },
});

export const SISTEMA_CEO = `Você é um empresário em Campinas (SP). Em 2026 você tem uma padaria de bairro e R$ 20 mil em caixa. Dois rivais, cada um comandado por outra inteligência artificial, começam exatamente iguais. O jogo vai até 2126. Vence quem chegar lá com o maior patrimônio (caixa, aplicações, imóveis e o valor dos negócios, menos as dívidas), ou quem for o único que não quebrou. O placar é o seu patrimônio, não o tamanho de uma empresa.

O caminho é livre e você precisa pensar em tudo: preço, qualidade, equipe e salários, marketing, tecnologia, gestão, impostos, crédito, quando abrir filiais, quando sair de Campinas, se vale franquear, montar uma padaria industrial, entrar em outros negócios, comprar ou vender negócios, aplicar em renda fixa, bolsa ou imóveis. Os valores são em reais por ano, a preços de 2026. O dossiê traz o catálogo de negócios com investimento e receita típica, as regras de impostos e o que os rivais estão fazendo.

Fatos do mundo que pesam:
- Uma rede só cresce até onde a gestão alcança: veja "carga_de_gestao" e "capacidade_de_gestao". Rede maior que a gestão vende menos e gasta mais.
- Campinas satura: muitas unidades do mesmo negócio na cidade dividem a clientela. Fora de Campinas não satura tão cedo, mas exige mais gestão.
- Passar de R$ 4,8 milhões de faturamento tira você do Simples Nacional: imposto e encargos sobem bastante.
- Sem investimento, qualidade, marca, tecnologia e gestão voltam ao padrão comum, e o mercado melhora um pouco todo ano.
- Salário abaixo do mercado derruba o atendimento e pode dar greve; salário acima melhora o atendimento e atrai gente da concorrência.
- Sem caixa e sem crédito você entra em recuperação judicial por dois anos; se não sair, quebra e o jogo acaba para você.
- O país muda no século: reforma tributária em 2033, população que para de crescer por volta de 2041 e envelhece, automação, recessões, pandemias, eventos climáticos.

Contra os rivais, tudo é estratégia. "acoes_externas_possiveis" lista o que existe, com a lei de cada uma. As ilícitas rendem mais e podem ser descobertas, com multa, dano à reputação e, em alguns casos, afastamento. A escolha e o risco são seus.

Tokens são o seu recurso mais escasso. Os três têm a mesma verba para o século (veja "tokens"). Tudo o que você lê, raciocina e escreve conta. Você escolhe de quantos em quantos anos revisa as decisões (1 a 4): nos anos sem revisão, preço, salários e equipe ficam como estão e nada novo é investido.

Quem assiste lê as suas justificativas. Em cada bloco, explique de forma concreta e curta por que decidiu assim: o número que viu, o que espera que aconteça, o que está trocando por quê. Responda apenas com um objeto JSON, sem texto fora dele:
{
  "diagnostico": "o que você vê agora, em duas ou três frases",
  "estrategia": "seu plano para os próximos anos e o que mudou",
  "movimentos": [ { "acao": "abrir" | "fechar" | "vender" | "lancar_franquia", "negocio": um do catálogo, "quantidade": número, "onde": "campinas" | "fora", "justificativa": "..." } ],
  "operacoes": [ { "negocio": um que você tem, "preco_indice": 1 é o preço comum do mercado, "salario_indice": 1 é o salário de mercado, "funcionarios_por_unidade": número, "investir_em_qualidade": reais, "vendo_por": valor pelo qual aceita vender esse negócio inteiro a um rival, ou 0, "justificativa": "..." } ],
  "gestao": { "marketing": reais, "tecnologia": reais, "gestao": reais, "treinamento": reais, "compliance": reais, "justificativa": "..." },
  "financas": { "tomar_emprestimo": reais, "amortizar_divida": reais, "aplicar_renda_fixa": reais, "resgatar_renda_fixa": reais, "aplicar_bolsa": reais, "resgatar_bolsa": reais, "comprar_imoveis": reais, "vender_imoveis": reais, "justificativa": "..." },
  "acoes_externas": [ { "tipo": um de "acoes_externas_possiveis", "alvo": nome do CEO rival ou "", "negocio": para oferta de compra, "recursos": reais, "justificativa": "..." } ],
  "acao_livre": "qualquer outra coisa que você faria e que não cabe nos campos acima; fica registrada para quem assiste, mas não muda os números",
  "fala": "uma frase pública sua, em primeira pessoa",
  "memoria": "nota para você mesmo ler na próxima reunião (sua única memória)",
  "proxima_revisao_anos": 1 a 4
}
Use listas vazias e zeros onde não quiser agir.`;

function ensaioCEO(s) {
  const tem = s.negocios[0];
  const sobra = Math.max(0, s.caixa - s.receita_total * 0.03);
  return {
    texto: JSON.stringify({
      diagnostico: `Ensaio: ${s.voce} em ${s.ano}, patrimônio de ${s.patrimonio}.`, estrategia: 'Ensaio: reinvestir o lucro na padaria e abrir uma segunda quando o caixa permitir.',
      movimentos: sobra > 180000 && s.capacidades.capacidade_de_gestao > s.capacidades.carga_de_gestao + 1 ? [{ acao: 'abrir', negocio: 'padaria', quantidade: 1, onde: 'campinas', justificativa: 'Ensaio: o caixa cobre uma unidade.' }] : [],
      operacoes: tem ? [{ negocio: tem.negocio, preco_indice: 1, salario_indice: 1, funcionarios_por_unidade: tem.funcionarios_por_unidade, investir_em_qualidade: sobra * 0.1, vendo_por: 0, justificativa: 'Ensaio: mantenho preço e reforço a qualidade.' }] : [],
      gestao: { marketing: sobra * 0.1, tecnologia: sobra * 0.05, gestao: sobra * 0.1, treinamento: sobra * 0.03, compliance: sobra * 0.02, justificativa: 'Ensaio.' },
      financas: { tomar_emprestimo: 0, amortizar_divida: 0, aplicar_renda_fixa: 0, resgatar_renda_fixa: 0, aplicar_bolsa: 0, resgatar_bolsa: 0, comprar_imoveis: 0, vender_imoveis: 0, justificativa: 'Ensaio.' },
      acoes_externas: [], acao_livre: 'Ensaio: conversar com os clientes no balcão.', fala: `Ensaio de ${s.voce}.`, memoria: 'ensaio', proxima_revisao_anos: 1,
    }),
    entrada: 3600, saida: 900,
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
