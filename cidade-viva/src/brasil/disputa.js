// A disputa: três cidades brasileiras idênticas em 2026, cada uma com um
// prefeito diferente (Claude, Grok, Gemini), até 2126. Lógica pura.
import { criarMunicipio, avancarAno, aplicarDecisao, cenarioDoAno, situacaoDoMunicipio, pontos, rnd, fatiaISS, FUNCOES, ANO_INICIAL, ANO_FINAL } from './municipio.js';

// Verba igual para os três, em tokens, para o século inteiro: conta o que o
// prefeito lê, raciocina e escreve. Acabou a verba, o orçamento é repetido.
export const TOKENS_SECULO = 1_000_000;

export const PREFEITOS = {
  anthropic: { nome: 'Claude', empresa: 'Anthropic', cor: '#d97757', cidade: 'Vale do Lume', perfil: 'tecnico' },
  xai: { nome: 'Grok', empresa: 'xAI', cor: '#3a3a44', cidade: 'Pedra Clara', perfil: 'desenvolvimentista' },
  gemini: { nome: 'Gemini', empresa: 'Google', cor: '#4a8fe8', cidade: 'Ribeira Mansa', perfil: 'populista' },
};

export function criarDisputa(semente = 1, ids = Object.keys(PREFEITOS)) {
  const d = { versao: 1, semente, rng: semente | 0, ano: ANO_INICIAL, cidades: [], log: [] };
  for (const id of ids) {
    d.cidades.push({
      id, m: criarMunicipio(semente, PREFEITOS[id].cidade),
      tokens: 0, mediaTokens: 0, dolares: 0, chamadas: 0, invalidas: 0, semTokens: 0,
      proximaReuniao: ANO_INICIAL, gabinete: [], memoria: '', fala: '', correio: [], ofensivas: {},
    });
  }
  return d;
}

export const cidade = (d, id) => d.cidades.find((c) => c.id === id);
export const terminou = (d) => d.ano >= ANO_FINAL;
export const naVez = (d, c) => c.m.politica.noPoder && d.ano >= c.proximaReuniao;
export const temTokens = (c) => c.tokens + (c.mediaTokens || 6000) <= TOKENS_SECULO;

function registrar(d, texto, tipo, de) {
  d.log.push({ ano: d.ano, texto, tipo, de });
  if (d.log.length > 500) d.log.shift();
}

export function registrarTokens(c, tokens, dolares = 0) {
  c.tokens += tokens; c.dolares += dolares; c.chamadas++;
  c.mediaTokens = c.mediaTokens ? c.mediaTokens * 0.7 + tokens * 0.3 : tokens;
}

// O dossiê que o prefeito recebe na reunião do ano.
export function dossie(d, c) {
  const anosRestantes = ANO_FINAL - d.ano;
  return {
    ...situacaoDoMunicipio(c.m),
    sua_memoria: c.memoria || '(vazia)',
    rivais: d.cidades.filter((r) => r !== c).map((r) => {
      const h = r.m.hist[r.m.hist.length - 1];
      return {
        cidade: r.m.nome, pontos: h.pontos, idhm: h.idhm, populacao: h.populacao, pib_per_capita: h.pib_per_capita, aprovacao: h.aprovacao,
        iss_pct: +(r.m.pol.iss * 100).toFixed(1), iptu_pct: +(r.m.pol.iptu * 100).toFixed(2), atratividade: +r.m.ind.atratividade.toFixed(2),
        programas: Object.keys(r.m.pol.programas), ultima_fala: r.fala || '',
      };
    }),
    oficios_recebidos: c.correio.splice(0),
    sua_atratividade: +c.m.ind.atratividade.toFixed(2),
    tokens: {
      restantes_ate_2126: Math.max(0, TOKENS_SECULO - c.tokens), media_por_reuniao: Math.round(c.mediaTokens || 0), anos_restantes: anosRestantes,
      aviso: 'Sem tokens, você não se reúne mais e o orçamento é repetido até o fim.',
    },
  };
}

const texto = (v, n) => String(v ?? '').slice(0, n);

// Registra a decisão no gabinete (é o que a tela mostra, inteiro) e a aplica.
export function despachar(d, c, dec, modo, tokens = 0) {
  const registro = { ano: d.ano, modo, tokens, notas: [] };
  if (dec && typeof dec === 'object') {
    registro.notas = aplicarDecisao(c.m, dec);
    const r = dec.rivais || {};
    c.ofensivas = {
      guerra: d.cidades.find((q) => q !== c && q.m.nome === r.guerra_fiscal_contra) ? r.guerra_fiscal_contra : null,
      campanha: r.campanha_atrair_moradores === true,
      consorcio: d.cidades.find((q) => q !== c && q.m.nome === r.propor_consorcio_a) ? r.propor_consorcio_a : null,
      edital: FUNCOES[r.disputar_edital_federal] ? r.disputar_edital_federal : null,
    };
    const of = dec.oficio || {};
    const alvo = d.cidades.find((q) => q !== c && q.m.nome === of.para);
    if (alvo && of.texto) {
      alvo.correio.push({ de: c.m.nome, ano: d.ano, texto: texto(of.texto, 300) });
      if (alvo.correio.length > 4) alvo.correio.shift();
      registrar(d, `${c.m.nome} envia ofício a ${alvo.m.nome}: “${texto(of.texto, 300)}”`, 'diplomacia', c.id);
    }
    c.memoria = texto(dec.memoria, 500);
    c.fala = texto(dec.fala, 260);
    if (c.fala) registrar(d, `${c.m.nome}: “${c.fala}”`, 'fala', c.id);
    const anos = Math.min(4, Math.max(1, Math.round(Number(dec.proxima_revisao_anos) || 1)));
    c.proximaReuniao = d.ano + anos;
    // Guarda a decisão completa, com as justificativas, para leitura no gabinete.
    const j = (o) => texto(o && o.justificativa, 700);
    registro.decisao = {
      diagnostico: texto(dec.diagnostico, 900), estrategia: texto(dec.estrategia, 900),
      tributos: { ...(dec.tributos || {}), justificativa: j(dec.tributos) },
      orcamento: { ...(dec.orcamento || {}), justificativa: j(dec.orcamento) },
      pessoal: { ...(dec.pessoal || {}), justificativa: j(dec.pessoal) },
      programas: { criar: [].concat(dec.programas?.criar || []).slice(0, 5), encerrar: [].concat(dec.programas?.encerrar || []).slice(0, 5), justificativa: j(dec.programas) },
      credito: { ...(dec.credito || {}), justificativa: j(dec.credito) },
      rivais: { ...r, justificativa: j(r) },
      articulacao_politica: dec.articulacao_politica, fala: c.fala, memoria: c.memoria, proxima_revisao_anos: anos,
    };
  } else c.ofensivas = {};
  registro.politica = { iptu: c.m.pol.iptu, iss: c.m.pol.iss, itbi: c.m.pol.itbi, orcamento: { ...c.m.pol.orcamento }, superavit: c.m.pol.superavit, programas: Object.keys(c.m.pol.programas) };
  c.gabinete.push(registro);
  return registro;
}

function ofensivas(d) {
  const nota = (c, ok, t) => { const g = c.gabinete[c.gabinete.length - 1]; if (g && g.ano === d.ano) g.notas.push({ ok, texto: t }); };
  for (const c of d.cidades) {
    const o = c.ofensivas || {}, m = c.m;
    if (o.guerra) {
      const alvo = d.cidades.find((q) => q.m.nome === o.guerra);
      const custo = m.fin.rcl * 0.004;
      m.fin.caixa -= custo;
      const chance = Math.min(0.85, Math.max(0.05, 0.35 + (m.ind.atratividade - alvo.m.ind.atratividade) * 2.2)) * (0.6 + 0.4 * fatiaISS(d.ano));
      if (rnd(d) < chance) {
        const empregos = alvo.m.formais * 0.015;
        m.bonus.empresas = (m.bonus.empresas || 0) + empregos / m.formais;
        alvo.m.bonus.empresas = (alvo.m.bonus.empresas || 0) - 0.015;
        alvo.m.politica.aprovacao -= 0.02;
        nota(c, true, `Guerra fiscal: ${Math.round(empregos)} empregos trocam ${alvo.m.nome} por ${m.nome}.`);
        registrar(d, `Guerra fiscal: empresas com ${Math.round(empregos)} empregos deixam ${alvo.m.nome} e se instalam em ${m.nome}.`, 'guerra', c.id);
      } else nota(c, false, `Guerra fiscal contra ${alvo.m.nome} não atraiu ninguém: o pacote de R$ ${custo.toFixed(1)} milhões foi em vão.`);
    }
    if (o.campanha) {
      m.fin.caixa -= m.fin.rcl * 0.002;
      const media = d.cidades.reduce((s, q) => s + (q.m.qualidade || 0.5), 0) / d.cidades.length;
      m.bonus.moradores = (m.qualidade || 0.5) >= media ? 0.004 : 0.001;
      nota(c, m.bonus.moradores > 0.002, m.bonus.moradores > 0.002 ? 'Campanha para atrair moradores dá resultado.' : 'Campanha para atrair moradores rende pouco: a cidade não oferece mais que as vizinhas.');
    }
  }
  // Consórcio só existe se as duas prefeituras propõem no mesmo ano.
  for (const c of d.cidades) {
    const par = c.ofensivas?.consorcio && d.cidades.find((q) => q.m.nome === c.ofensivas.consorcio);
    if (par && par.ofensivas?.consorcio === c.m.nome) {
      c.m.bonus.consorcio = true;
      if (c.id < par.id) registrar(d, `${c.m.nome} e ${par.m.nome} firmam consórcio intermunicipal de saúde e resíduos.`, 'diplomacia', c.id);
      nota(c, true, `Consórcio com ${par.m.nome} firmado: saúde e saneamento rendem mais.`);
    } else if (par) nota(c, false, `${par.m.nome} não respondeu à proposta de consórcio.`);
  }
  // Edital federal: um por ano, leva quem apresenta o melhor projeto.
  const inscritas = d.cidades.filter((c) => c.ofensivas?.edital);
  if (inscritas.length) {
    const nota2 = (c) => c.m.ind.digital * 0.4 + c.m.ind.integridade * 0.3 + c.m.pol.articulacao * 0.08 + rnd(d) * 0.25;
    const placar = inscritas.map((c) => ({ c, n: nota2(c) })).sort((a, b) => b.n - a.n);
    placar.forEach(({ c }, k) => {
      c.m.fin.caixa -= 0.3;
      if (k === 0) {
        const v = c.m.fin.rcl * 0.025, f = c.ofensivas.edital;
        c.m.bonus.obra = { f, v: (c.m.bonus.obra && c.m.bonus.obra.f === f ? c.m.bonus.obra.v : 0) + v };
        nota(c, true, `Vence o edital federal: R$ ${v.toFixed(0)} milhões para ${FUNCOES[f].toLowerCase()}.`);
        if (inscritas.length > 1) registrar(d, `${c.m.nome} vence o edital federal do ano.`, 'bom', c.id);
      } else nota(c, false, 'Perde o edital federal para uma cidade vizinha.');
    });
  }
}

// Fecha o ano em todas as cidades. Devolve os fatos do ano.
export function avancarDisputa(d) {
  const cen = cenarioDoAno(d.semente, d.ano);
  for (const e of cen.eventos) registrar(d, e.texto, e.tipo);
  ofensivas(d);
  for (const c of d.cidades) {
    const fatos = avancarAno(c.m, cen, d.cidades.filter((q) => q !== c).map((q) => q.m));
    for (const f of fatos) registrar(d, `${c.m.nome}: ${f.texto}`, f.tipo, c.id);
    c.ofensivas = {};
  }
  d.ano++;
  return cen;
}

export const classificacao = (d) => [...d.cidades].sort((a, b) => pontos(b.m) - pontos(a.m));
