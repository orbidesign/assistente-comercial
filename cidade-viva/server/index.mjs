// Ponte com a IA. Sem credencial da Anthropic o jogo continua funcionando só
// com regras: /api/status responde { ia: false } e o cliente nem tenta chamar.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { TIPOS_EFEITO, ALVOS_EFEITO, NEGOCIOS, SERVICOS } from '../src/sim/dados.js';

const PORTA = +process.env.PORT || 8787;
// Custo baixo por padrão: o modelo mais barato dá conta de traduzir um evento em
// efeitos e de escolher ações em uma lista. CIDADE_MODELO troca o modelo.
const MODELO = process.env.CIDADE_MODELO || 'claude-haiku-5-5';
// Teto de gasto por execução do servidor, em dólares. Ao atingir, a IA desliga
// e o jogo segue só com regras.
const LIMITE = +process.env.CIDADE_LIMITE_USD || 0.5;
// Dólares por milhão de tokens [entrada, saída].
const PRECOS = { 'claude-haiku-5-5': [0.1, 0.5], 'claude-sonnet-5-5': [2, 10], 'claude-opus-5-5': [4, 20], 'claude-fable-5-2': [8, 40] };
const conta = { gasto: 0, chamadas: 0, cache: 0 };
const custo = () => ({ gasto: conta.gasto, limite: LIMITE, chamadas: conta.chamadas, modelo: MODELO });
const memoria = new Map(); // narrações repetidas não pagam de novo
const temCredencial = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = temCredencial ? new Anthropic() : null;
const aqui = path.dirname(fileURLToPath(import.meta.url));

const obj = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const ESQUEMA_EVENTO = obj({
  titulo: { type: 'string' },
  narrativa: { type: 'string' },
  efeitos: { type: 'array', items: obj({
    tipo: { type: 'string', enum: TIPOS_EFEITO }, alvo: { type: 'string', enum: ALVOS_EFEITO },
    valor: { type: 'number' }, meses: { type: 'integer' },
  }) },
});
const ESQUEMA_CONSELHO = obj({
  estado: obj({
    fala: { type: 'string' }, imposto_delta: { type: 'number' },
    construir: { type: 'string', enum: ['nada', ...Object.keys(SERVICOS).filter((s) => s !== 'conselho')] },
  }),
  empresarios: { type: 'array', items: obj({
    familia: { type: 'integer' }, fala: { type: 'string' },
    acao: { type: 'string', enum: ['investir', 'expandir', 'aumentar_salarios', 'cortar_salarios', 'pressionar', 'aguardar'] },
    negocio: { type: 'string', enum: ['nenhum', ...Object.keys(NEGOCIOS)] },
  }) },
});

const SISTEMA_EVENTO = `Você é o motor de eventos de um jogo de simulação de cidade em um mundo de fantasia sem magia.
O narrador (jogador) descreve uma situação em texto livre. Traduza-a em efeitos mecânicos para a simulação.

Devolva um título curto, uma narrativa de uma ou duas frases no tom de uma crônica da cidade, e de 1 a 5 efeitos.
Cada efeito tem a forma { tipo, alvo, valor, meses }. Use alvo "nenhum" e meses 0 quando não se aplicam.

Tipos de efeito e escalas:
- producao: multiplica a produção. alvo = comida | materiais | bens | servicos | tudo. valor = fator (0.4 é desastre, 0.8 é ruim, 1.3 é bom, 1.8 é excepcional). meses = duração (1 a 36).
- familias: chegam (valor positivo, até 12) ou partem (negativo, até -8) famílias. alvo = ricos faz chegarem famílias com capital para investir; pobres ou nenhum, colonos comuns.
- riqueza: soma moedas por família. alvo = todos | ricos | pobres | estado (tesouro público). Uma família comum tem de 20 a 100 moedas; um negócio custa de 40 a 700.
- saude, felicidade, educacao, seguranca, legitimidade: somam à escala de 0 a 1. Use valores entre -0.4 e 0.4; 0.1 já é perceptível.
- conhecimento: pontos de técnica que aproximam a próxima era (10 é pouco, 100 é muito).
- imposto: soma à alíquota (0.05 = cinco pontos percentuais). Só tem efeito se houver governo.
- mortes: valor = fração da população que morre (0.02 a 0.3).
- destruir: valor = número de construções arruinadas (1 a 8).
- fundar_estado: cria o governo, se ainda não existir.

Seja fiel ao que o narrador descreveu e proporcional: um boato não muda a cidade, uma catástrofe muda. O estado atual da cidade vem junto para dar contexto.`;

const SISTEMA_CONSELHO = `Você dá voz aos atores de uma cidade simulada, uma vez por ano. Há dois lados em tensão permanente.

O ESTADO (o conselho da cidade) quer se manter legítimo: precisa de arrecadação para construir serviços e manter a ordem, mas imposto alto demais sufoca os negócios e irrita o povo. A cada ano ele pode mexer na alíquota (imposto_delta, entre -0.05 e 0.05) e construir no máximo um serviço que caiba no tesouro (campo "pode_construir"; use "nada" se não quiser ou não puder).

OS EMPRESÁRIOS são as três famílias mais ricas. Cada uma defende o próprio interesse: lucro, mão de obra barata, pouco imposto, mas também precisa de uma cidade que funcione e de clientes com dinheiro. Para cada uma escolha uma ação:
- investir: abrir um novo negócio (informe o tipo em "negocio", dentre "negocios_possiveis", que caiba na riqueza da família)
- expandir: ampliar o negócio atual
- aumentar_salarios ou cortar_salarios
- pressionar: fazer lobby para baixar impostos (custa legitimidade ao conselho)
- aguardar
Use "nenhum" em "negocio" quando a ação não for investir.

Se "estado" vier nulo, ainda não existe governo: devolva imposto_delta 0 e construir "nada", com fala vazia.
Decida com base nos números recebidos, como alguém com interesses reais decidiria, e deixe os lados discordarem quando fizer sentido. Cada "fala" é uma frase curta, em primeira pessoa, com personalidade, explicando a decisão.`;

async function pedir(sistema, usuario, esquema) {
  if (conta.gasto >= LIMITE) { const e = new Error('teto de gasto de IA atingido'); e.status = 429; throw e; }
  const corpo = {
    model: MODELO, max_tokens: 3000, system: sistema,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: esquema } },
    messages: [{ role: 'user', content: usuario }],
  };
  let r;
  if (MODELO.includes('haiku')) r = await client.messages.create(corpo);
  else {
    try {
      // Nos modelos maiores, se houver recusa por política a API refaz o pedido em um modelo reserva.
      r = await client.beta.messages.create({ ...corpo, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      r = await client.messages.create(corpo);
    }
  }
  const [pe, ps] = PRECOS[MODELO] || PRECOS['claude-opus-5-5'];
  const u = r.usage || {};
  const entrada = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  conta.gasto += (entrada * pe + (u.output_tokens || 0) * ps) / 1e6;
  conta.chamadas++;
  if (r.stop_reason === 'refusal') throw new Error('o modelo recusou o pedido');
  if (r.stop_reason === 'max_tokens') throw new Error('resposta cortada por limite de tokens');
  const texto = r.content.find((b) => b.type === 'text');
  return JSON.parse(texto.text);
}

function lerCorpo(req) {
  return new Promise((ok, erro) => {
    let dados = '';
    req.on('data', (c) => { dados += c; if (dados.length > 65536) { erro(new Error('corpo grande demais')); req.destroy(); } });
    req.on('end', () => { try { ok(JSON.parse(dados || '{}')); } catch (e) { erro(e); } });
    req.on('error', erro);
  });
}

const responder = (res, status, corpo) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
};

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

const servidor = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/status') return responder(res, 200, { ia: !!client && conta.gasto < LIMITE, ...custo() });
    if (req.method === 'POST' && (req.url === '/api/evento' || req.url === '/api/conselho')) {
      if (!client) return responder(res, 503, { erro: 'IA não configurada' });
      const corpo = await lerCorpo(req);
      if (req.url === '/api/evento') {
        const texto = String(corpo.texto || '').slice(0, 1200);
        if (!texto.trim()) return responder(res, 400, { erro: 'texto vazio' });
        const usuario = `Estado atual da cidade:\n${JSON.stringify(corpo.resumo || {})}\n\nSituação descrita pelo narrador:\n${texto}`;
        const chave = texto.trim().toLowerCase();
        if (!memoria.has(chave)) {
          if (memoria.size > 300) memoria.clear();
          memoria.set(chave, await pedir(SISTEMA_EVENTO, usuario, ESQUEMA_EVENTO));
        } else conta.cache++;
        return responder(res, 200, { ...memoria.get(chave), custo: custo() });
      }
      const d = await pedir(SISTEMA_CONSELHO, `Situação da cidade:\n${JSON.stringify(corpo.resumo || {})}`, ESQUEMA_CONSELHO);
      return responder(res, 200, { ...d, custo: custo() });
    }
    // Depois de `npm run build`, o mesmo servidor entrega o jogo pronto.
    const dist = path.join(aqui, '..', 'dist');
    const arquivo = path.normalize(path.join(dist, req.url === '/' ? 'index.html' : req.url.split('?')[0]));
    if (arquivo.startsWith(dist) && fs.existsSync(arquivo) && fs.statSync(arquivo).isFile()) {
      res.writeHead(200, { 'content-type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
      return fs.createReadStream(arquivo).pipe(res);
    }
    responder(res, 404, { erro: 'não encontrado' });
  } catch (e) {
    let status = e.status === 429 ? 429 : 500;
    if (e instanceof Anthropic.RateLimitError) status = 429;
    else if (e instanceof Anthropic.AuthenticationError) status = 401;
    else if (e instanceof Anthropic.APIError) status = 502;
    console.error('[servidor]', e.message);
    responder(res, status, { erro: e.message, custo: custo() });
  }
});

servidor.listen(PORTA, () => {
  console.log(`Cidade Viva: servidor em http://localhost:${PORTA} — IA ${client ? `ativa (${MODELO}, teto de US$ ${LIMITE.toFixed(2)})` : 'desligada (defina ANTHROPIC_API_KEY para ligar)'}`);
});
