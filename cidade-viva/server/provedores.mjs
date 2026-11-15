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
  recrutar: { type: 'integer' }, dispensar: { type: 'integer' }, pesquisa: { type: 'number' }, auxilio: { type: 'number' },
  fomento: { type: 'string' }, atacar: { type: 'string' }, mensagem: obj({ para: { type: 'string' }, texto: { type: 'string' } }),
});

let clienteAnthropic = null;
async function anthropic(cfg, sistema, usuario) {
  clienteAnthropic ||= new Anthropic({ apiKey: cfg.chave });
  const corpo = {
    model: cfg.modelo, max_tokens: 4000, system: sistema,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
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
      fomento: 'nenhum', atacar: 'nenhuma', mensagem: { para: '', texto: '' },
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

export async function decidir(id, sistema, situacao) {
  const cfg = PROVEDORES[id];
  const r = env.ARENA_ENSAIO === '1' ? ensaio(situacao) : await CHAMAR[id](cfg, sistema, JSON.stringify(situacao));
  const custo = (r.entrada * cfg.precos[0] + r.saida * cfg.precos[1]) / 1e6;
  return { decisao: extrairJSON(r.texto), custo, tokens: { entrada: r.entrada, saida: r.saida } };
}
