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

// ---------- o prefeito brasileiro (2026 a 2126) ----------

const FUNCOES_BR = ['educacao', 'saude', 'seguranca', 'infraestrutura', 'saneamento', 'habitacao', 'assistencia', 'meio_ambiente', 'desenvolvimento', 'cultura', 'administracao'];
const txt = { type: 'string' }, n = { type: 'number' };
const ESQUEMA_BR = obj({
  diagnostico: txt, estrategia: txt,
  tributos: obj({ iptu: n, iss: n, itbi: n, atualizar_planta_de_valores: { type: 'boolean' }, justificativa: txt }),
  orcamento: obj({ ...Object.fromEntries(FUNCOES_BR.map((f) => [f, n])), meta_de_superavit_pct: n, justificativa: txt }),
  pessoal: obj({ reajuste_real_pct: n, concurso: { type: 'string', enum: ['nenhum', 'reposicao', 'ampliacao'] }, reforma_previdencia: { type: 'boolean' }, justificativa: txt }),
  programas: obj({ criar: { type: 'array', items: txt }, encerrar: { type: 'array', items: txt }, justificativa: txt }),
  credito: obj({ valor_milhoes: n, destino: txt, justificativa: txt }),
  rivais: obj({ guerra_fiscal_contra: txt, campanha_atrair_moradores: { type: 'boolean' }, propor_consorcio_a: txt, disputar_edital_federal: txt, justificativa: txt }),
  oficio: obj({ para: txt, texto: txt }),
  articulacao_politica: { type: 'integer' }, fala: txt, memoria: txt, proxima_revisao_anos: { type: 'integer' },
});

export const SISTEMA_BRASIL = `Você é o prefeito de uma cidade média do interior do Brasil. O jogo começa em 2026 e termina em 2126. Outras duas cidades, idênticas à sua em 2026, são governadas por outras inteligências artificiais. Vence quem construir a cidade mais próspera e imponente, no menor tempo. Pontos: metade é IDHM (educação, longevidade, renda); o resto é o tamanho da economia, a qualidade urbana e a saúde fiscal.

Você governa dentro das regras brasileiras:
- Mínimos constitucionais: 25% da receita de impostos e transferências em educação e 15% em saúde. Abaixo disso o Tribunal de Contas rejeita suas contas e sua candidatura é impugnada na eleição seguinte.
- Lei de Responsabilidade Fiscal: folha de pagamento até 54% da receita corrente líquida. Acima de 51,3% ficam vedados reajustes e contratações; acima de 54% a cidade perde transferências voluntárias.
- Dívida até 1,2 vez a receita. Crédito só com nota A ou B de capacidade de pagamento.
- ISS entre 2% e 5%; IPTU entre 0,3% e 1,5% do valor venal; ITBI até 3%. Aumentar imposto ou atualizar a planta de valores do IPTU depende de maioria na Câmara (veja "base_na_camara") e custa aprovação.
- Reforma tributária: de 2029 a 2032 o ISS e a cota de ICMS encolhem e em 2033 acabam, substituídos pelo IBS, que é repartido cada vez mais pelo local do consumo (população e renda) até 2077. Baixar o ISS para atrair empresas perde força nesse período.
- Eleições a cada quatro anos (2028, 2032, ...). Se perder, a oposição governa quatro anos com o orçamento congelado e você fica sem decidir.
- A população do país para de crescer por volta de 2041 e envelhece: a previdência dos servidores pesa cada vez mais, e as cidades passam a disputar moradores. A automação elimina empregos de rotina entre 2032 e 2060, mais onde a qualificação é baixa. Eventos climáticos extremos ficam mais frequentes; cidade sem drenagem e defesa civil paga caro.

Contra as rivais, tudo é estratégia: guerra fiscal para tirar empresas delas, campanha para atrair moradores, disputa do edital federal do ano, ou consórcio (só vale se as duas propõem no mesmo ano). Você também pode mandar um ofício.

Tokens são o seu recurso mais escasso. Os três prefeitos têm a mesma verba para o século inteiro (veja "tokens"). Tudo o que você lê, raciocina e escreve conta. Você escolhe de quantos em quantos anos revisa o governo (1 a 4); nos anos sem revisão, vale o que estava decidido.

Suas justificativas serão lidas por quem assiste ao jogo: explique em cada bloco, de forma concreta e curta, por que decidiu assim (o que viu nos números, o que espera que aconteça, o que está trocando por quê). Responda apenas com um objeto JSON, sem texto fora dele:
{
  "diagnostico": "o que você vê na cidade agora, em duas ou três frases",
  "estrategia": "seu plano para os próximos anos e o que mudou em relação ao anterior",
  "tributos": { "iptu": % sobre o valor venal, "iss": %, "itbi": %, "atualizar_planta_de_valores": true ou false, "justificativa": "..." },
  "orcamento": { ${FUNCOES_BR.map((f) => `"${f}": %`).join(', ')}, "meta_de_superavit_pct": % da receita a poupar (0 a 15), "justificativa": "..." },
  "pessoal": { "reajuste_real_pct": % acima da inflação (pode ser 0), "concurso": "nenhum" | "reposicao" | "ampliacao", "reforma_previdencia": true ou false, "justificativa": "..." },
  "programas": { "criar": [até 3 ids de "programas_disponiveis"], "encerrar": [ids de "programas_ativos"], "justificativa": "..." },
  "credito": { "valor_milhoes": número ou 0, "destino": uma função do orçamento, "justificativa": "..." },
  "rivais": { "guerra_fiscal_contra": nome de cidade ou "", "campanha_atrair_moradores": true ou false, "propor_consorcio_a": nome de cidade ou "", "disputar_edital_federal": uma função do orçamento ou "", "justificativa": "..." },
  "oficio": { "para": nome de cidade ou "", "texto": "..." },
  "articulacao_politica": 0 a 3 (esforço em Brasília e na Câmara: rende convênios e base, mas aumenta o risco de escândalo),
  "fala": "uma frase pública sua, em primeira pessoa",
  "memoria": "nota para você mesmo ler na próxima reunião (sua única memória)",
  "proxima_revisao_anos": 1 a 4
}
Os percentuais do orçamento são normalizados para somar 100.`;

function ensaioBrasil(s) {
  const o = { ...s.orcamento_atual_pct, justificativa: 'Ensaio: mantenho a distribuição e reforço a educação aos poucos.' };
  o.educacao += 0.5; o.meta_de_superavit_pct = 3;
  const cabe = s.programas_disponiveis.find((p) => p.custo_inicial_milhoes < s.indicadores.caixa * 0.5);
  return {
    texto: JSON.stringify({
      diagnostico: `Ensaio: ${s.cidade} em ${s.ano}, IDHM ${s.indicadores.idhm}.`, estrategia: 'Ensaio: educação primeiro, contas em ordem.',
      tributos: { iptu: s.tributos_atuais.iptu_pct, iss: s.tributos_atuais.iss_pct, itbi: s.tributos_atuais.itbi_pct, atualizar_planta_de_valores: false, justificativa: 'Ensaio: sem mexer em impostos.' },
      orcamento: o, pessoal: { reajuste_real_pct: 0, concurso: 'reposicao', reforma_previdencia: false, justificativa: 'Ensaio.' },
      programas: { criar: cabe ? [cabe.id] : [], encerrar: [], justificativa: cabe ? `Ensaio: cabe no caixa criar ${cabe.nome}.` : 'Ensaio: sem caixa.' },
      credito: { valor_milhoes: 0, destino: 'infraestrutura', justificativa: 'Ensaio.' },
      rivais: { guerra_fiscal_contra: '', campanha_atrair_moradores: false, propor_consorcio_a: '', disputar_edital_federal: 'saneamento', justificativa: 'Ensaio: disputo o edital.' },
      oficio: { para: '', texto: '' }, articulacao_politica: 1, fala: `Ensaio de ${s.cidade}.`, memoria: 'ensaio', proxima_revisao_anos: 1,
    }),
    entrada: 3200, saida: 900,
  };
}

// Tokens são contados como cada API os informa: entrada + saída, com o
// raciocínio incluído na saída. Uma resposta que não é JSON válido também é
// cobrada: quem erra o formato perde a reunião e os tokens.
export async function decidir(id, situacao, jogo = 'arena') {
  const cfg = PROVEDORES[id];
  const br = jogo === 'brasil';
  const r = env.ARENA_ENSAIO === '1' ? (br ? ensaioBrasil(situacao) : ensaio(situacao))
    : await CHAMAR[id](cfg, br ? SISTEMA_BRASIL : SISTEMA_ARENA, JSON.stringify(situacao), br ? ESQUEMA_BR : ESQUEMA);
  const custo = (r.entrada * cfg.precos[0] + r.saida * cfg.precos[1]) / 1e6;
  let decisao = null;
  try { decisao = extrairJSON(r.texto); } catch { /* resposta inválida */ }
  return { decisao, invalida: !decisao, custo, tokens: r.entrada + r.saida, entrada: r.entrada, saida: r.saida };
}
