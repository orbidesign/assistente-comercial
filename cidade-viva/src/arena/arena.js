// Arena: três cidades, cada uma governada por uma API diferente. Lógica pura
// (sem tela e sem rede): quem chama os modelos é o cliente, que entrega aqui a
// decisão já recebida.
import { criarMundo, avancarMes, aplicarGoverno, aplicarEfeito, resumoGoverno, pontos, populacao, calcularIndicadores } from '../sim/sim.js';
import { ERAS } from '../sim/dados.js';

export const MESES_POR_TURNO = 60;      // os governos se reúnem a cada 5 anos
export const MESES_MILENIO = 12000;
// A verba é em tokens, não em dinheiro: todas as APIs recebem exatamente a
// mesma quantidade, somando o que leem, o que escrevem e o que raciocinam.
export const TOKENS_TOTAL = 2_000_000;  // por API, no jogo inteiro
export const TOKENS_MILENIO = 400_000;  // por API, por milênio
export const MESES_DE_MARCHA = 12;
export const LENTIDAO = 10;

export const PROVEDORES = {
  anthropic: { nome: 'Claude', empresa: 'Anthropic', cor: '#d97757', cidade: 'Vale do Lume', perfil: 'sabio' },
  xai: { nome: 'Grok', empresa: 'xAI', cor: '#3a3a44', cidade: 'Pedra Clara', perfil: 'guerreiro' },
  gemini: { nome: 'Gemini', empresa: 'Google', cor: '#4a8fe8', cidade: 'Ribeira Mansa', perfil: 'mercador' },
};

function rnd(a) {
  a.rng = (a.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(a.rng ^ (a.rng >>> 15), a.rng | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function criarArena(semente = 1, ids = Object.keys(PROVEDORES)) {
  const a = { versao: 1, semente, rng: semente | 0, mes: 0, cidades: [], marchas: [], log: [], hist: [], marcos: [] };
  for (const id of ids) {
    const p = PROVEDORES[id];
    // Mesma semente para as três: todas partem exatamente da mesma situação.
    a.cidades.push({
      id, w: criarMundo(semente, { manual: true, lentidao: LENTIDAO, nome: p.cidade }),
      tokens: 0, tokensMilenio: 0, mediaTokens: 0, dolares: 0, chamadas: 0, invalidas: 0, turnosSemVerba: 0,
      proximoTurno: MESES_POR_TURNO, eras: { 0: 1 }, vitorias: 0, derrotas: 0, saqueada: 0, plano: '', fala: '', feito: [], caixa: [], batalhas: [],
    });
  }
  return a;
}

export const cidade = (a, id) => a.cidades.find((c) => c.id === id);

function registrar(a, texto, tipo, de) {
  a.log.push({ mes: a.mes, texto, tipo, de });
  if (a.log.length > 400) a.log.shift();
}

// Quantos tokens já podem ter sido gastos a esta altura do milênio. A verba é
// liberada aos poucos: quem gasta muito por reunião se reúne menos vezes.
export function verbaLiberada(a) {
  return 6000 + ((a.mes % MESES_MILENIO) / MESES_MILENIO) * TOKENS_MILENIO;
}

export function podePagar(a, c) {
  const estimado = c.mediaTokens || 3000;
  return c.tokens + estimado <= TOKENS_TOTAL && c.tokensMilenio + estimado <= Math.min(TOKENS_MILENIO, verbaLiberada(a));
}

export function registrarCusto(c, tokens, dolares = 0) {
  c.tokens += tokens; c.tokensMilenio += tokens; c.dolares += dolares; c.chamadas++;
  c.mediaTokens = c.mediaTokens ? c.mediaTokens * 0.7 + tokens * 0.3 : tokens;
}

// Cada governo marca a própria próxima reunião (de 5 a 50 anos).
export const naVez = (a, c) => a.mes >= c.proximoTurno;

export const turnoDevido = (a) => a.mes > 0 && a.mes % MESES_POR_TURNO === 0;

// O que cada governante recebe para decidir.
export function situacao(a, c) {
  return {
    voce: resumoGoverno(c.w),
    seu_plano_anterior: c.plano || '(nenhum)',
    suas_ultimas_acoes: c.feito,
    rivais: a.cidades.filter((r) => r !== c).map((r) => ({
      cidade: r.w.nome, era: ERAS[r.w.era].nome, pontos: pontos(r.w), populacao: r.w.ind.populacao,
      exercito: r.w.estado.exercito || 0, tesouro: Math.round(r.w.estado.tesouro), ultima_fala: r.fala || '',
    })),
    mensagens_recebidas: c.caixa.splice(0),
    guerras_recentes: c.batalhas.slice(-3),
    exercitos_a_caminho: a.marchas.filter((m) => m.para === c.id || m.de === c.id).map((m) => ({
      de: cidade(a, m.de).w.nome, para: cidade(a, m.para).w.nome, soldados: m.forca, chega_em_meses: m.chega - a.mes,
    })),
    tokens: {
      restantes_no_milenio: Math.max(0, Math.round(TOKENS_MILENIO - c.tokensMilenio)),
      restantes_no_jogo: Math.max(0, Math.round(TOKENS_TOTAL - c.tokens)),
      media_gasta_por_reuniao: Math.round(c.mediaTokens || 0),
      anos_restantes_no_milenio: Math.round((MESES_MILENIO - (a.mes % MESES_MILENIO)) / 12),
    },
  };
}

export function rivaisPublicos(a, c) {
  return a.cidades.filter((r) => r !== c).map((r) => ({ cidade: r.w.nome, exercito: r.w.estado.exercito || 0, pontos: pontos(r.w) }));
}

export function aplicarTurno(a, c, d) {
  if (!d || typeof d !== 'object') return;
  c.feito = aplicarGoverno(c.w, d);
  c.plano = String(d.plano || '').slice(0, 300);
  c.fala = String(d.fala || '').slice(0, 220);
  const anos = Math.min(50, Math.max(5, Math.round((Number(d.proxima_reuniao_anos) || 5) / 5) * 5));
  c.proximoTurno = a.mes + anos * 12;
  if (c.fala) registrar(a, `${c.w.nome}: “${c.fala}”`, 'fala', c.id);
  if (d.mensagem && d.mensagem.texto) {
    const alvo = a.cidades.find((r) => r !== c && r.w.nome === d.mensagem.para);
    if (alvo) {
      const texto = String(d.mensagem.texto).slice(0, 240);
      alvo.caixa.push({ de: c.w.nome, texto });
      if (alvo.caixa.length > 4) alvo.caixa.shift();
      registrar(a, `${c.w.nome} envia mensageiro a ${alvo.w.nome}: “${texto}”`, 'diplomacia', c.id);
    }
  }
  const alvo = a.cidades.find((r) => r !== c && r.w.nome === d.atacar);
  const e = c.w.estado;
  if (alvo && e.exercito >= 10 && !a.marchas.some((m) => m.de === c.id)) {
    const forca = Math.floor(e.exercito * 0.7);
    e.exercito -= forca;
    a.marchas.push({ de: c.id, para: alvo.id, forca, chega: a.mes + MESES_DE_MARCHA });
    c.feito.push(`envia ${forca} soldados contra ${alvo.w.nome}`);
    registrar(a, `${c.w.nome} marcha com ${forca} soldados contra ${alvo.w.nome}!`, 'guerra', c.id);
  }
}

function batalha(a, m) {
  const at = cidade(a, m.de), df = cidade(a, m.para);
  const ea = at.w.estado, ed = df.w.estado;
  const muralha = df.w.estado.predios.some((p) => p.tipo === 'guarda') ? 1.25 : 1;
  const ataque = m.forca * (0.75 + rnd(a) * 0.5) * (1 + at.w.era * 0.15);
  const defesa = ((ed.exercito || 0) * 1.3 + populacao(df.w) * 0.015) * (0.75 + rnd(a) * 0.5) * (1 + df.w.era * 0.15) * muralha;
  let relato;
  if (ataque > defesa) {
    const saque = Math.max(0, ed.tesouro) * 0.4 + df.w.familias.reduce((s, f) => s + Math.max(0, f.riqueza) * 0.15, 0);
    df.w.familias.forEach((f) => { f.riqueza = Math.max(0, f.riqueza) * 0.85; });
    ed.tesouro -= Math.max(0, ed.tesouro) * 0.4;
    ed.exercito = Math.floor((ed.exercito || 0) * 0.4);
    aplicarEfeito(df.w, { tipo: 'destruir', valor: 4 });
    aplicarEfeito(df.w, { tipo: 'felicidade', valor: -0.15 });
    aplicarEfeito(df.w, { tipo: 'legitimidade', valor: -0.12 });
    ea.tesouro += saque; ea.exercito += Math.floor(m.forca * 0.7);
    aplicarEfeito(at.w, { tipo: 'legitimidade', valor: 0.05 });
    relato = `${at.w.nome} vence ${df.w.nome} e leva ${Math.round(saque)} moedas de saque.`;
    df.w.log.push({ mes: df.w.mes, texto: `A cidade foi saqueada pelas tropas de ${at.w.nome}.`, tipo: 'ruim' });
    m.resultado = 'vitoria'; at.vitorias++; df.saqueada++;
  } else {
    ea.exercito += Math.floor(m.forca * 0.3);
    ed.exercito = Math.floor((ed.exercito || 0) * 0.75);
    aplicarEfeito(at.w, { tipo: 'legitimidade', valor: -0.1 });
    aplicarEfeito(df.w, { tipo: 'legitimidade', valor: 0.06 });
    relato = `${df.w.nome} repele o ataque de ${at.w.nome}.`;
    df.w.log.push({ mes: df.w.mes, texto: `As muralhas resistiram ao ataque de ${at.w.nome}.`, tipo: 'estado' });
    m.resultado = 'derrota'; at.derrotas++;
  }
  calcularIndicadores(at.w); calcularIndicadores(df.w);
  const ano = Math.floor(a.mes / 12) + 1;
  at.batalhas.push({ ano, texto: relato }); df.batalhas.push({ ano, texto: relato });
  registrar(a, relato, 'guerra', m.de);
  return m;
}

// Avança um mês em todas as cidades. Devolve as batalhas travadas neste mês.
export function avancarArena(a) {
  a.mes++;
  for (const c of a.cidades) {
    const era = c.w.era;
    avancarMes(c.w);
    if (c.w.era !== era) {
      const primeiro = !a.marcos.some((x) => x.era === c.w.era);
      a.marcos.push({ era: c.w.era, id: c.id, ano: Math.floor(a.mes / 12) + 1 });
      c.eras[c.w.era] = Math.floor(a.mes / 12) + 1;
      registrar(a, `${c.w.nome} chega à era ${ERAS[c.w.era].nome}${primeiro ? ' — a primeira!' : '.'}`, 'era', c.id);
    }
  }
  if (a.mes % MESES_MILENIO === 0) {
    for (const c of a.cidades) c.tokensMilenio = 0;
    registrar(a, `Começa o ${a.mes / MESES_MILENIO + 1}º milênio.`, 'era');
  }
  const travadas = [];
  for (const m of [...a.marchas]) if (a.mes >= m.chega) { a.marchas.splice(a.marchas.indexOf(m), 1); travadas.push(batalha(a, m)); }
  if (a.mes % 120 === 0) {
    a.hist.push({ ano: a.mes / 12, p: a.cidades.map((c) => pontos(c.w)) });
    if (a.hist.length > 600) a.hist = a.hist.filter((_, i) => i % 2 === 0);
  }
  return travadas;
}

export function classificacao(a) {
  return [...a.cidades].sort((x, y) => pontos(y.w) - pontos(x.w));
}
