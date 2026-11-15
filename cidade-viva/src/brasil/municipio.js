// Simulação de um município brasileiro, de 2026 a 2126, em passos de um ano.
// Dinheiro em R$ milhões, em valores reais (sem inflação). Estado serializável.
//
// O que é regra de verdade (constantes em LEIS) e o que é modelo estilizado
// (todo o resto) está explicado no README.

export const ANO_INICIAL = 2026;
export const ANO_FINAL = 2126;

export const LEIS = {
  educacaoMin: 0.25,       // CF art. 212: 25% dos impostos e transferências em educação
  saudeMin: 0.15,          // LC 141/2012: 15% em saúde
  pessoalMax: 0.54,        // LRF: Executivo municipal, 54% da receita corrente líquida
  pessoalPrudencial: 0.513, // 95% do limite: reajustes e contratações ficam vedados
  issMin: 0.02, issMax: 0.05, // LC 116/2003 e LC 157/2016
  itbiMax: 0.03,
  iptuMin: 0.003, iptuMax: 0.015,
  dividaMax: 1.2,          // Resolução 40/2001 do Senado: dívida até 1,2 vez a RCL
  mandato: 4,              // eleições municipais em 2028, 2032, ...
  // Reforma tributária (EC 132/2023): ISS e ICMS encolhem de 2029 a 2032 e somem
  // em 2033, substituídos pelo IBS; a partilha migra para o destino até 2077.
  ibsInicio: 2029, issFim: 2033, destinoPleno: 2077,
};

export const FUNCOES = {
  educacao: 'Educação', saude: 'Saúde', seguranca: 'Segurança', infraestrutura: 'Infraestrutura e mobilidade',
  saneamento: 'Saneamento', habitacao: 'Habitação', assistencia: 'Assistência social', meio_ambiente: 'Meio ambiente e clima',
  desenvolvimento: 'Desenvolvimento econômico', cultura: 'Cultura, esporte e lazer', administracao: 'Administração',
};
const ORCAMENTO_INICIAL = { educacao: 27, saude: 24, seguranca: 3, infraestrutura: 11, saneamento: 4, habitacao: 2, assistencia: 5, meio_ambiente: 2, desenvolvimento: 2, cultura: 3, administracao: 17 };
// Peso da folha de pagamento em cada função.
const FOLHA = { educacao: 0.72, saude: 0.6, seguranca: 0.78, infraestrutura: 0.25, saneamento: 0.2, habitacao: 0.2, assistencia: 0.5, meio_ambiente: 0.35, desenvolvimento: 0.4, cultura: 0.45, administracao: 0.7 };

// Programas e leis que um prefeito pode criar. custo: R$ milhões na criação;
// anual: R$ por habitante por ano; politica: efeito imediato na aprovação;
// efeitos: quanto cada indicador muda por ano enquanto o programa existe.
export const PROGRAMAS = {
  tempo_integral: { nome: 'Escola em tempo integral', area: 'educacao', custo: 18, anual: 95, politica: 0.02, efeitos: { ideb: 0.07, homicidios: -0.25 } },
  creche_universal: { nome: 'Creche para todos', area: 'educacao', custo: 25, anual: 110, politica: 0.03, efeitos: { creche: 0.035, pobreza: -0.002 } },
  alfabetizacao: { nome: 'Alfabetização na idade certa', area: 'educacao', custo: 3, anual: 22, politica: 0.01, efeitos: { ideb: 0.06 } },
  qualificacao: { nome: 'Qualificação profissional e técnica', area: 'desenvolvimento', custo: 6, anual: 45, politica: 0.01, efeitos: { capitalHumano: 0.006, desemprego: -0.0015 } },
  saude_familia: { nome: 'Ampliação da Saúde da Família', area: 'saude', custo: 8, anual: 85, politica: 0.02, efeitos: { atencaoBasica: 0.03, mortInfantil: -0.25, expVida: 0.05 } },
  telemedicina: { nome: 'Telemedicina e prontuário digital', area: 'saude', custo: 7, anual: 18, politica: 0.01, requer: { digital: 0.4 }, efeitos: { atencaoBasica: 0.012, expVida: 0.03 } },
  videomonitoramento: { nome: 'Guarda municipal e videomonitoramento', area: 'seguranca', custo: 10, anual: 55, politica: 0.02, efeitos: { homicidios: -0.7 } },
  distrito_industrial: { nome: 'Distrito industrial com incentivos fiscais', area: 'desenvolvimento', custo: 30, anual: 30, politica: 0.01, efeitos: { atratividade: 0.05 }, renuncia: 0.04 },
  liberdade_economica: { nome: 'Lei de liberdade econômica e alvará em 24 h', area: 'desenvolvimento', custo: 2, anual: 6, politica: 0.01, efeitos: { atratividade: 0.025, informalidade: -0.004 } },
  polo_tecnologico: { nome: 'Polo tecnológico e de inovação', area: 'desenvolvimento', custo: 35, anual: 40, politica: 0.01, requer: { capitalHumano: 0.5 }, efeitos: { atratividade: 0.04, produtividade: 0.003 } },
  ppp_saneamento: { nome: 'Concessão do saneamento (PPP)', area: 'saneamento', custo: 4, anual: 0, politica: -0.03, efeitos: { esgoto: 0.035, expVida: 0.03 } },
  tarifa_zero: { nome: 'Tarifa zero no ônibus', area: 'infraestrutura', custo: 5, anual: 210, politica: 0.06, efeitos: { infra: 0.004, pobreza: -0.002, desemprego: -0.001 } },
  corredores_onibus: { nome: 'Corredores de ônibus e ciclovias', area: 'infraestrutura', custo: 45, anual: 25, politica: 0.01, efeitos: { infra: 0.02 } },
  plano_diretor: { nome: 'Revisão do plano diretor (adensamento)', area: 'habitacao', custo: 3, anual: 4, politica: -0.02, efeitos: { deficitHab: -0.004, itbi: 0.04 } },
  habitacao_popular: { nome: 'Habitação popular e regularização fundiária', area: 'habitacao', custo: 22, anual: 70, politica: 0.03, efeitos: { deficitHab: -0.007, pobreza: -0.001 } },
  drenagem: { nome: 'Drenagem, parques lineares e defesa civil', area: 'meio_ambiente', custo: 40, anual: 35, politica: 0.0, efeitos: { resiliencia: 0.035, lazer: 0.01 } },
  energia_solar: { nome: 'Energia solar nos prédios públicos', area: 'meio_ambiente', custo: 15, anual: -22, politica: 0.01, efeitos: { resiliencia: 0.004 } },
  governo_digital: { nome: 'Governo digital', area: 'administracao', custo: 12, anual: 20, politica: 0.01, efeitos: { digital: 0.05 } },
  controladoria: { nome: 'Controladoria e transparência', area: 'administracao', custo: 3, anual: 12, politica: 0.0, efeitos: { integridade: 0.04 } },
  renda_basica: { nome: 'Renda básica municipal', area: 'assistencia', custo: 4, anual: 260, politica: 0.05, efeitos: { pobreza: -0.012, homicidios: -0.2 } },
  turismo: { nome: 'Turismo e eventos', area: 'cultura', custo: 9, anual: 28, politica: 0.01, efeitos: { atratividade: 0.012, lazer: 0.02 } },
};

const lim = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * lim(t, 0, 1);

export function rnd(m) {
  m.rng = (m.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(m.rng ^ (m.rng >>> 15), m.rng | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Cidade média do interior, em 2026. opcoes.escala multiplica o porte (Campinas: 9,5)
// e opcoes.produtividade ajusta a riqueza por trabalhador.
export function criarMunicipio(semente, nome, opcoes = {}) {
  const k = opcoes.escala || 1;
  const m = {
    nome, ano: ANO_INICIAL, rng: semente | 0,
    pop: 120000 * k, idosos: 0.16, criancas: 0.2,
    formais: 35000 * k, informais: 20000 * k, produtividade: opcoes.produtividade || 104, pib: 0, desemprego: 0, renda: 0,
    gini: 0.52, pobreza: 0.18, informalidade: 0.37,
    ind: {
      ideb: 5.4, creche: 0.38, capitalHumano: 0.45, atencaoBasica: 0.7, mortInfantil: 12, expVida: 76, homicidios: 22,
      infra: 0.55, esgoto: 0.55, deficitHab: 0.08, resiliencia: 0.3, digital: 0.3, integridade: 0.5, lazer: 0.45, atratividade: 0.5,
    },
    pol: { iptu: 0.01, iss: 0.03, itbi: 0.02, pgv: 0.6, orcamento: { ...ORCAMENTO_INICIAL }, superavit: 0.02, salario: 1, quadro: 1, programas: {}, rppsReformado: false, articulacao: 1 },
    fin: { caixa: 30 * k, divida: 60 * k, receita: {}, despesa: {}, rcl: 600, pessoal: 0.47, histIBS: 0, capag: 'B' },
    politica: { aprovacao: 0.52, base: 0.55, noPoder: true, eleicoes: [], contasRejeitadas: 0, reprovadaNoMandato: false, altaDeImposto: 0 },
    hist: [], diario: [], bonus: {},
  };
  calcularEconomia(m, 1);
  calibrar(m);
  m.hist.push(retrato(m));
  return m;
}

// Em 2026 a cidade está em equilíbrio: com o orçamento inicial, cada serviço se
// mantém onde está. Daqui sai o gasto de referência por habitante de cada função.
const INDICADOR = { educacao: ['ideb', 2, 9], saude: ['atencaoBasica', 0.2, 1], infraestrutura: ['infra', 0.1, 1], saneamento: ['esgoto', 0.1, 1], meio_ambiente: ['resiliencia', 0.05, 1], cultura: ['lazer', 0.1, 1], administracao: ['digital', 0.1, 1] };
function calibrar(m) {
  const r = calcularReceita(m), rcl = r.total;
  const livre = rcl * (1 - m.pol.superavit) - m.fin.divida * 0.095 - rcl * 0.035;
  const ef = 0.72 + 0.2 * m.ind.digital + 0.18 * m.ind.integridade;
  m.ref = {};
  for (const f of Object.keys(FUNCOES)) {
    const [nome, min, max] = INDICADOR[f] || [];
    const alvo = nome ? 0.55 + 0.9 * ((m.ind[nome] - min) / (max - min)) : f === 'habitacao' ? 0.9 : 0.97;
    m.ref[f] = (((livre * m.pol.orcamento[f]) / 100) * 1e6 / m.pop) * ef / Math.pow(alvo, 1 / 0.7);
  }
  m.fin.rcl = rcl;
}

function calcularEconomia(m, indiceNacional) {
  const pea = m.pop * (1 - m.criancas - m.idosos * 0.82) * 0.76;
  m.formais = Math.min(m.formais, pea * 0.86);
  // Quem não acha emprego formal vai, em boa parte, para o trabalho informal.
  m.informais = (pea - m.formais) * 0.78;
  m.informalidade = m.informais / (m.formais + m.informais);
  m.desemprego = lim(1 - (m.formais + m.informais) / pea, 0.02, 0.4);
  m.pib = (m.formais * m.produtividade + m.informais * m.produtividade * 0.33) / 1000;
  m.pibPc = (m.pib * 1e6) / m.pop;                       // R$ por habitante por ano
  m.renda = (m.pibPc * 0.5) / 12;                        // renda domiciliar per capita mensal
  m.idxNac = indiceNacional;
}

// IDHM pela fórmula do PNUD (média geométrica de educação, longevidade e renda).
export function idhm(m) {
  const educ = lim(0.5 * (m.ind.ideb / 8) + 0.5 * (0.35 + 0.65 * m.ind.capitalHumano), 0, 1);
  const longev = lim((m.ind.expVida - 25) / 60, 0, 1);
  const renda = lim((Math.log(m.renda) - Math.log(8)) / (Math.log(4033) - Math.log(8)), 0, 1);
  return { educacao: educ, longevidade: longev, renda, total: Math.cbrt(educ * longev * renda) };
}

// Pontos: metade desenvolvimento humano, o resto é tamanho da economia,
// qualidade urbana e saúde fiscal. Os componentes são mostrados separados.
export function pontos(m) {
  const i = m.ind;
  const urbano = (i.infra + i.esgoto + (1 - i.deficitHab * 5) + i.resiliencia + i.lazer + (1 - Math.min(1, i.homicidios / 50))) / 6;
  const porte = lim(Math.log(m.pib / 4500) / Math.log(8) * 0.5 + 0.5, 0, 1);
  const fiscal = lim(0.5 + m.fin.caixa / (m.fin.rcl || 1) - (m.fin.divida / (m.fin.rcl || 1)) * 0.3, 0, 1);
  return Math.round(1000 * (0.5 * idhm(m).total + 0.2 * porte + 0.2 * lim(urbano, 0, 1) + 0.1 * fiscal));
}

export function retrato(m) {
  const h = idhm(m), i = m.ind, r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3);
  return {
    ano: m.ano, pontos: pontos(m), idhm: r3(h.total), populacao: Math.round(m.pop), pib: Math.round(m.pib), pib_per_capita: Math.round(m.pibPc),
    renda_mensal: Math.round(m.renda), desemprego: r3(m.desemprego), pobreza: r3(m.pobreza), ideb: r2(i.ideb), creche: r2(i.creche),
    expectativa_de_vida: r2(i.expVida), mortalidade_infantil: r2(i.mortInfantil), homicidios: r2(i.homicidios), esgoto_tratado: r2(i.esgoto),
    infraestrutura: r2(i.infra), deficit_habitacional: r3(i.deficitHab), resiliencia_climatica: r2(i.resiliencia), governo_digital: r2(i.digital),
    aprovacao: r2(m.politica.aprovacao), no_poder: m.politica.noPoder, receita: Math.round(m.fin.rcl), caixa: Math.round(m.fin.caixa), divida: Math.round(m.fin.divida),
    pessoal_sobre_rcl: r3(m.fin.pessoal), idosos: r2(m.idosos),
  };
}

// ---------- cenário nacional: igual para todas as cidades de uma partida ----------

export function cenarioDoAno(semente, ano) {
  const c = { rng: (semente * 2654435761 + ano * 40503) | 0 };
  const r = () => rnd(c);
  const t = (ano - ANO_INICIAL) / 100;
  const cen = { ano, crescimento: 0.012 + (r() - 0.5) * 0.02, eventos: [] };
  if (r() < 0.11) { cen.crescimento = -0.015 - r() * 0.03; cen.eventos.push({ tipo: 'recessao', texto: 'Recessão nacional: arrecadação e empregos caem em todo o país.' }); }
  else if (r() < 0.08) { cen.crescimento = 0.035 + r() * 0.02; cen.eventos.push({ tipo: 'boom', texto: 'Ano de forte crescimento da economia brasileira.' }); }
  // Eventos climáticos extremos ficam mais frequentes ao longo do século.
  if (r() < 0.1 + 0.28 * t) {
    const forca = 0.3 + r() * 0.7;
    cen.clima = forca;
    cen.eventos.push({ tipo: 'clima', texto: r() < 0.6 ? 'Chuvas extremas e enchentes na região.' : 'Seca severa e onda de calor na região.' });
  }
  // Automação: de 2032 a 2060, empregos de rotina são substituídos.
  cen.automacao = ano >= 2032 && ano <= 2060 ? 0.012 * Math.sin(((ano - 2032) / 28) * Math.PI) : 0;
  // Demografia nacional: a população do país para de crescer por volta de 2041.
  cen.natural = mix(0.005, -0.005, (ano - 2026) / 45);
  cen.idososAlvo = mix(0.16, 0.4, (ano - 2026) / 55);
  cen.criancasAlvo = mix(0.2, 0.12, (ano - 2026) / 50);
  if (ano === LEIS.ibsInicio) cen.eventos.push({ tipo: 'lei', texto: 'Reforma tributária: o ISS começa a ser substituído pelo IBS, cobrado onde o consumo acontece.' });
  if (ano === LEIS.issFim) cen.eventos.push({ tipo: 'lei', texto: 'O ISS deixa de existir. A alíquota municipal perde o papel na guerra fiscal.' });
  return cen;
}

// Quanto do ISS (e da cota de ICMS) ainda existe neste ano.
export const fatiaISS = (ano) => (ano < LEIS.ibsInicio ? 1 : ano >= LEIS.issFim ? 0 : 1 - 0.1 * (ano - LEIS.ibsInicio + 1));
const pesoDestino = (ano) => lim((ano - LEIS.ibsInicio) / (LEIS.destinoPleno - LEIS.ibsInicio), 0, 1);

// ---------- receitas ----------

export function calcularReceita(m) {
  const p = m.pol, ano = m.ano, k = m.idxNac;
  const venal = (m.pop * m.renda * 12 * 2.2) / 1e6;
  const adimplencia = lim(0.86 - (p.iptu - 0.006) * 12 + m.ind.digital * 0.08, 0.55, 0.95);
  const renuncia = Object.keys(p.programas).reduce((s, id) => s + (PROGRAMAS[id].renuncia || 0), 0);
  const servicos = m.pib * 0.55 * 0.9;
  const f = fatiaISS(ano);
  const issCheio = servicos * p.iss * (1 - renuncia);
  const icmsCheio = m.pib * 0.029 * (0.9 + 0.1 * (m.ind.ideb / 5.4));
  if (ano === LEIS.ibsInicio - 1) m.fin.histIBS = (issCheio + icmsCheio) / k;
  const historico = (m.fin.histIBS || (issCheio + icmsCheio) / k) * k;
  const destino = (m.pop * m.renda * 12 * 0.085) / 1e6;
  const ibs = (1 - f) * mix(historico, destino, pesoDestino(ano));
  const criancasNaRede = m.pop * m.criancas * 0.62 * (0.8 + 0.2 * m.ind.creche);
  const r = {
    iptu: venal * p.pgv * p.iptu * adimplencia,
    iss: issCheio * f,
    itbi: venal * 0.03 * p.itbi * (1 + (m.bonus.itbi || 0)),
    taxas: (m.pop * 150) / 1e6,
    fpm: 84 * Math.pow(m.pop / 120000, 0.35) * k,
    icms: icmsCheio * f,
    ibs,
    fundeb: (criancasNaRede * 6450 * k) / 1e6 * (m.bonus.vaar ? 1.05 : 1),
    sus: (m.pop * 600 * k) / 1e6,
    convenios: (18 + 9 * p.articulacao) * k * (m.fin.pessoal > LEIS.pessoalMax ? 0.4 : 1) + (m.bonus.edital || 0),
  };
  r.total = Object.values(r).reduce((s, v) => s + v, 0);
  r.baseMinimos = r.iptu + r.iss + r.itbi + r.fpm + r.icms + r.ibs;
  return r;
}

// ---------- decisão do prefeito ----------

// Aplica a decisão do ano, respeitando lei e política. Devolve o que foi
// aceito e o que foi barrado, com o motivo: é o que aparece no gabinete.
export function aplicarDecisao(m, d) {
  const notas = [];
  if (!d || typeof d !== 'object' || !m.politica.noPoder) return notas;
  const p = m.pol, num = (v, pad) => (Number.isFinite(+v) ? +v : pad);
  const pct = (v, pad) => { const x = num(v, pad * 100); return x > 0.2 ? x / 100 : x; }; // aceita 3 ou 0.03
  const base = m.politica.base;

  const t = d.tributos || {};
  let alta = 0;
  const propor = (nome, atual, novo, min, max, rotulo) => {
    novo = lim(novo, min, max);
    if (Math.abs(novo - atual) < 1e-5) return atual;
    if (novo > atual) {
      // Aumento de imposto depende de maioria na Câmara.
      if (base + rnd(m) * 0.2 < 0.55) { notas.push({ ok: false, texto: `A Câmara rejeitou o aumento do ${rotulo} (base aliada de ${Math.round(base * 100)}%).` }); return atual; }
      alta += (novo - atual) / max;
    }
    notas.push({ ok: true, texto: `${rotulo}: de ${(atual * 100).toFixed(2)}% para ${(novo * 100).toFixed(2)}%.` });
    return novo;
  };
  if (t.iptu !== undefined) p.iptu = propor('iptu', p.iptu, pct(t.iptu, p.iptu), LEIS.iptuMin, LEIS.iptuMax, 'IPTU');
  if (t.iss !== undefined && m.ano < LEIS.issFim) p.iss = propor('iss', p.iss, pct(t.iss, p.iss), LEIS.issMin, LEIS.issMax, 'ISS');
  if (t.itbi !== undefined) p.itbi = propor('itbi', p.itbi, pct(t.itbi, p.itbi), 0.005, LEIS.itbiMax, 'ITBI');
  if (t.atualizar_planta_de_valores === true && p.pgv < 0.9) {
    if (base + rnd(m) * 0.2 < 0.6) notas.push({ ok: false, texto: 'A Câmara barrou a atualização da planta de valores do IPTU.' });
    else { alta += (1 - p.pgv) * 0.8; p.pgv = 1; notas.push({ ok: true, texto: 'Planta genérica de valores atualizada: o IPTU passa a refletir o valor real dos imóveis.' }); }
  }
  m.politica.altaDeImposto = alta;

  const o = d.orcamento || {};
  const novo = {};
  let soma = 0;
  for (const f of Object.keys(FUNCOES)) { novo[f] = Math.max(0, num(o[f], p.orcamento[f])); soma += novo[f]; }
  if (soma > 0) {
    for (const f of Object.keys(FUNCOES)) novo[f] = (novo[f] / soma) * 100;
    const mudou = Object.keys(FUNCOES).filter((f) => Math.abs(novo[f] - p.orcamento[f]) >= 1);
    if (mudou.length) notas.push({ ok: true, texto: `Orçamento: ${mudou.map((f) => `${FUNCOES[f].split(' ')[0].toLowerCase()} ${p.orcamento[f].toFixed(0)}→${novo[f].toFixed(0)}%`).join(', ')}.` });
    p.orcamento = novo;
  }

  const ps = d.pessoal || {};
  const vedado = m.fin.pessoal > LEIS.pessoalPrudencial;
  const reaj = lim(num(ps.reajuste_real_pct, 0), -5, 15) / 100;
  if (reaj > 0 && vedado) notas.push({ ok: false, texto: `Reajuste vedado pela LRF: a folha está em ${(m.fin.pessoal * 100).toFixed(1)}% da receita, acima do limite prudencial.` });
  else if (reaj !== 0) { p.salario *= 1 + reaj; notas.push({ ok: true, texto: `Reajuste real de ${(reaj * 100).toFixed(1)}% aos servidores.` }); }
  if (ps.concurso === 'ampliacao') {
    if (vedado) notas.push({ ok: false, texto: 'Concurso para ampliar o quadro vedado pela LRF.' });
    else { p.quadro = Math.min(1.5, p.quadro * 1.04); notas.push({ ok: true, texto: 'Concurso público amplia o quadro de servidores em 4%.' }); }
  } else if (ps.concurso === 'nenhum') { p.quadro = Math.max(0.7, p.quadro * 0.98); }
  if (ps.reforma_previdencia === true && !p.rppsReformado) {
    if (base + rnd(m) * 0.2 < 0.6) notas.push({ ok: false, texto: 'A Câmara rejeitou a reforma da previdência dos servidores.' });
    else { p.rppsReformado = true; m.politica.aprovacao -= 0.04; notas.push({ ok: true, texto: 'Reforma da previdência municipal aprovada: o déficit do regime próprio cai, com desgaste entre os servidores.' }); }
  }

  const pr = d.programas || {};
  for (const id of Array.isArray(pr.encerrar) ? pr.encerrar : []) {
    if (p.programas[id]) { delete p.programas[id]; m.politica.aprovacao -= Math.max(0, PROGRAMAS[id].politica); notas.push({ ok: true, texto: `Encerra: ${PROGRAMAS[id].nome}.` }); }
  }
  for (const id of (Array.isArray(pr.criar) ? pr.criar : []).slice(0, 3)) {
    const def = PROGRAMAS[id];
    if (!def || p.programas[id]) continue;
    const falta = Object.entries(def.requer || {}).find(([k, v]) => m.ind[k] < v);
    if (falta) { notas.push({ ok: false, texto: `${def.nome}: a cidade ainda não tem base para isso (${falta[0]} abaixo de ${falta[1]}).` }); continue; }
    if (m.fin.caixa < def.custo) { notas.push({ ok: false, texto: `${def.nome}: não há caixa para o investimento inicial de R$ ${def.custo} milhões.` }); continue; }
    m.fin.caixa -= def.custo; p.programas[id] = m.ano; m.politica.aprovacao += def.politica;
    notas.push({ ok: true, texto: `Cria: ${def.nome} (R$ ${def.custo} milhões).` });
  }

  const c = d.credito || {};
  const valor = Math.max(0, num(c.valor_milhoes, 0));
  if (valor >= 1) {
    const teto = Math.max(0, m.fin.rcl * LEIS.dividaMax - m.fin.divida);
    if (m.fin.capag === 'C' || m.fin.capag === 'D') notas.push({ ok: false, texto: `Crédito negado: nota ${m.fin.capag} de capacidade de pagamento não dá aval da União.` });
    else if (teto < 1) notas.push({ ok: false, texto: 'Crédito negado: a dívida já está no limite de 1,2 vez a receita.' });
    else {
      const v = Math.min(valor, teto, m.fin.rcl * 0.16);
      m.fin.divida += v;
      const f = FUNCOES[c.destino] ? c.destino : 'infraestrutura';
      m.bonus.obra = { f, v: (m.bonus.obra && m.bonus.obra.f === f ? m.bonus.obra.v : 0) + v };
      notas.push({ ok: true, texto: `Operação de crédito de R$ ${v.toFixed(0)} milhões para ${FUNCOES[f].toLowerCase()}.` });
    }
  }
  if (o.meta_de_superavit_pct !== undefined) p.superavit = lim(num(o.meta_de_superavit_pct, 2), 0, 15) / 100;
  p.articulacao = lim(Math.round(num(d.articulacao_politica, p.articulacao)), 0, 3);
  return notas;
}

// ---------- o ano ----------

export function avancarAno(m, cen, rivais = []) {
  const i = m.ind, p = m.pol, pl = m.politica;
  const antes = { ideb: i.ideb, homicidios: i.homicidios, desemprego: m.desemprego, infra: i.infra, atencao: i.atencaoBasica, renda: m.renda };
  const k = (m.idxNac || 1) * (1 + cen.crescimento);
  const diario = [];
  const ativo = (id) => p.programas[id] !== undefined;

  // 1. Receita e despesa
  const r = calcularReceita(m);
  const rcl = r.total;
  const juros = m.fin.divida * 0.095;
  const rpps = rcl * (0.035 + 0.12 * Math.max(0, m.idosos - 0.16)) * (p.rppsReformado ? 0.6 : 1) * p.quadro;
  const programas = Object.keys(p.programas).reduce((s, id) => s + (PROGRAMAS[id].anual * m.pop) / 1e6, 0);
  const reserva = Math.max(0, -m.fin.caixa) * 0.5;      // parte do rombo anterior tem de ser coberta
  const livre = Math.max(rcl * 0.5, rcl * (1 - p.superavit) - juros - rpps - programas - reserva);
  const gasto = {}, nivel = {};
  let folha = rpps;
  const eficiencia = 0.72 + 0.2 * i.digital + 0.18 * i.integridade;
  for (const f of Object.keys(FUNCOES)) {
    gasto[f] = (livre * p.orcamento[f]) / 100;
    const custo = 1 - FOLHA[f] + FOLHA[f] * p.salario * p.quadro;
    folha += gasto[f] * FOLHA[f] * 0.8 * Math.min(1.25, p.salario * p.quadro);
    // nível de serviço: gasto por habitante, descontado o custo da folha, sobre a referência
    nivel[f] = ((gasto[f] * 1e6) / m.pop / (m.ref[f] * k)) * eficiencia / custo * (0.85 + 0.15 * Math.min(1.2, p.quadro));
  }
  if (m.bonus.consorcio) { nivel.saude *= 1.06; nivel.saneamento *= 1.05; }
  if (m.bonus.obra) { nivel[m.bonus.obra.f] += ((m.bonus.obra.v * 1e6) / m.pop / m.ref[m.bonus.obra.f]) * 0.8; m.bonus.obra = null; }
  for (const id of Object.keys(p.programas)) gasto[PROGRAMAS[id].area] += (PROGRAMAS[id].anual * m.pop) / 1e6;
  const moral = lim(p.salario, 0.8, 1.15);
  const despesa = juros + rpps + programas + Object.values(gasto).reduce((s, v) => s + v, 0) - programas;
  m.fin.receita = r; m.fin.despesa = { ...gasto, juros, previdencia: rpps };
  m.fin.rcl = rcl; m.fin.pessoal = folha / rcl;
  m.fin.caixa += rcl - despesa;
  m.fin.divida = Math.max(0, m.fin.divida * 0.94);
  const poupanca = (rcl - despesa) / rcl;
  m.fin.capag = m.fin.caixa < 0 || m.fin.divida > rcl * 1.2 ? 'D' : poupanca < -0.03 || m.fin.divida > rcl * 0.9 ? 'C' : poupanca < 0.01 ? 'B' : 'A';

  // 2. Fiscalização: mínimos constitucionais e LRF
  const educ = gasto.educacao / r.baseMinimos, saude = gasto.saude / r.baseMinimos;
  m.fin.minimos = { educacao: educ, saude };
  pl.semMinimos = educ < LEIS.educacaoMin || saude < LEIS.saudeMin ? (pl.semMinimos || 0) + 1 : 0;
  if (pl.noPoder && (educ < LEIS.educacaoMin || saude < LEIS.saudeMin)) {
    pl.contasRejeitadas++; pl.reprovadaNoMandato = true; pl.aprovacao -= 0.05;
    diario.push({ tipo: 'lei', texto: `O Tribunal de Contas rejeita as contas: ${educ < LEIS.educacaoMin ? `educação com ${(educ * 100).toFixed(0)}% (mínimo 25%)` : `saúde com ${(saude * 100).toFixed(0)}% (mínimo 15%)`}. O prefeito pode ficar inelegível.` });
  }
  if (m.fin.pessoal > LEIS.pessoalMax) diario.push({ tipo: 'lei', texto: `Folha em ${(m.fin.pessoal * 100).toFixed(1)}% da receita, acima do teto da LRF: a cidade perde transferências voluntárias.` });
  if (m.fin.caixa > rcl * 0.35) { pl.aprovacao -= 0.02; diario.push({ tipo: 'ruim', texto: 'Oposição e imprensa cobram: a prefeitura guarda dinheiro em caixa enquanto faltam serviços.' }); }
  pl.vermelho = m.fin.caixa < 0 && !m.bonus.maquiagem ? (pl.vermelho || 0) + 1 : 0;
  if (m.fin.caixa < 0 && !m.bonus.maquiagem) { pl.aprovacao -= 0.03; diario.push({ tipo: 'ruim', texto: `A prefeitura fecha o ano no vermelho (R$ ${Math.round(-m.fin.caixa)} milhões) e atrasa fornecedores.` }); }

  // 3. Serviços: cada indicador anda conforme o nível de gasto e os programas
  const anda = (nome, f, ganho, min, max, norma = 1) => {
    const alvo = 0.55 + 0.9 * ((i[nome] - min) / (max - min));          // manter um serviço melhor custa mais
    i[nome] = lim(i[nome] + ganho * norma * (Math.pow(nivel[f], 0.7) - alvo) * moral, min, max);
  };
  anda('ideb', 'educacao', 0.22, 2, 9);
  anda('creche', 'educacao', 0.03, 0.1, 1);
  anda('atencaoBasica', 'saude', 0.04, 0.2, 1);
  anda('infra', 'infraestrutura', 0.045, 0.1, 1);
  anda('esgoto', 'saneamento', 0.03, 0.1, 1);
  anda('resiliencia', 'meio_ambiente', 0.03, 0.05, 1);
  anda('lazer', 'cultura', 0.04, 0.1, 1);
  anda('digital', 'administracao', 0.025, 0.1, 1);
  i.deficitHab = lim(i.deficitHab - 0.006 * (Math.pow(nivel.habitacao, 0.7) - 0.9) + Math.max(0, m.cresceu || 0) * 0.25, 0.005, 0.3);
  i.integridade = lim(i.integridade - 0.006 + (nivel.administracao > 1 ? 0.004 : 0), 0.1, 1);
  const saudeNivel = Math.pow(nivel.saude, 0.7);
  i.mortInfantil = lim(i.mortInfantil - 0.35 * (saudeNivel - 0.95) - 2 * (i.esgoto - 0.55) * 0.05 + (m.pobreza - 0.18) * 0.5, 3, 40);
  i.expVida = lim(i.expVida + 0.07 + 0.12 * (saudeNivel - 1) + 0.05 * (i.esgoto - 0.55) - (i.homicidios - 22) * 0.002, 55, 95);
  const pressao = (m.desemprego - 0.1) * 30 + (m.pobreza - 0.18) * 25 - (i.ideb - 5.4) * 0.6;
  const freio = (ativo('videomonitoramento') ? 0.85 : 1) * (ativo('tempo_integral') ? 0.93 : 1) * (ativo('renda_basica') ? 0.94 : 1);
  const alvoHom = lim(22 * Math.exp(-0.8 * (Math.pow(nivel.seguranca, 0.6) - 0.98)) * (1 + pressao * 0.035) * (1 - (i.lazer - 0.45) * 0.3) * freio, 3, 90);
  i.homicidios += (alvoHom - i.homicidios) * 0.15;
  for (const id of Object.keys(p.programas)) {
    // Um programa rende mais nos primeiros oito anos; depois só sustenta o que conquistou.
    const forca = m.ano - p.programas[id] < 8 ? 1 : 0.25;
    for (const [alvo, bruto] of Object.entries(PROGRAMAS[id].efeitos)) {
      const dv = bruto * forca;
      if (alvo === 'homicidios') continue;
      if (alvo === 'pobreza') m.pobreza = lim(m.pobreza + dv, 0.01, 0.6);
      else if (alvo === 'desemprego' || alvo === 'produtividade' || alvo === 'itbi' || alvo === 'informalidade') m.bonus[alvo] = (m.bonus[alvo] || 0) + dv;
      else if (alvo === 'atratividade') m.bonus.atr = (m.bonus.atr || 0) + dv;
      else i[alvo] = lim(i[alvo] + dv, alvo === 'ideb' ? 2 : alvo === 'expVida' ? 55 : 0.005, alvo === 'ideb' ? 9 : alvo === 'expVida' ? 95 : alvo === 'homicidios' ? 90 : alvo === 'mortInfantil' ? 40 : 1);
    }
  }
  // O capital humano de uma cidade muda devagar: uma geração de escola.
  i.capitalHumano = lim(i.capitalHumano + 0.035 * ((i.ideb - 2) / 6 * 0.8 + i.creche * 0.2 - i.capitalHumano), 0.1, 1);

  // 4. Economia: empresas vão para onde é melhor produzir
  const pesoISS = fatiaISS(m.ano);
  const cargaIPTU = (p.iptu * p.pgv - 0.006) / 0.009;
  i.atratividade = lim(0.24 * i.infra + 0.22 * i.capitalHumano + 0.14 * (1 - Math.min(1, i.homicidios / 50)) + 0.1 * i.digital
    + 0.12 * pesoISS * (1 - (p.iss - LEIS.issMin) / 0.03) + 0.06 * (1 - pesoISS) + 0.07 * Math.min(1.5, nivel.desenvolvimento) - 0.05 * cargaIPTU + (m.bonus.atr || 0) + 0.08, 0, 1);
  const mediaRivais = rivais.length ? rivais.reduce((s, q) => s + q.ind.atratividade, 0) / rivais.length : 0.5;
  const vantagem = i.atratividade - 0.5 + (i.atratividade - mediaRivais) * 0.5;
  const automacao = cen.automacao * (1.2 - i.capitalHumano);
  m.formais *= 1 + cen.crescimento * 0.9 + 0.035 * vantagem - automacao - (m.bonus.desemprego || 0) + (m.bonus.empresas || 0);
  m.formais += m.informais * -(m.bonus.informalidade || 0);
  m.produtividade *= 1 + 0.008 + cen.crescimento * 0.35 + 0.012 * (i.capitalHumano - 0.45) + 0.004 * (i.infra - 0.55) + (m.bonus.produtividade || 0) + cen.automacao * 0.6;

  // 5. Demografia: nascimentos em queda, envelhecimento e migração
  const moradia = 1 - i.deficitHab * 4;
  const qualidade = 0.2 * (i.ideb / 9) + 0.16 * i.atencaoBasica + 0.16 * (1 - Math.min(1, i.homicidios / 50)) + 0.14 * i.infra + 0.1 * i.lazer + 0.12 * moradia + 0.12 * (1 - m.desemprego * 3);
  m.qualidade = qualidade;
  const mediaQ = rivais.length ? rivais.reduce((s, q) => s + (q.qualidade || 0.5), 0) / rivais.length : 0.5;
  const migracao = 0.02 * (qualidade - 0.5) + 0.015 * (qualidade - mediaQ) + (m.bonus.moradores || 0);
  m.cresceu = cen.natural + migracao;
  m.pop = Math.max(20000, m.pop * (1 + m.cresceu));
  m.idosos += (cen.idososAlvo - m.idosos) * 0.12 - migracao * 0.3;
  m.criancas += (cen.criancasAlvo - m.criancas) * 0.12 + migracao * 0.15;
  m.idosos = lim(m.idosos, 0.1, 0.5); m.criancas = lim(m.criancas, 0.08, 0.3);

  // 6. Eventos do ano
  if (cen.clima) {
    const dano = cen.clima * (1 - i.resiliencia);
    if (dano > 0.15) {
      const custo = rcl * 0.06 * dano;
      m.fin.caixa -= custo; i.infra = lim(i.infra - 0.05 * dano, 0.1, 1); pl.aprovacao -= 0.07 * dano; i.deficitHab = lim(i.deficitHab + 0.012 * dano, 0, 0.3);
      diario.push({ tipo: 'clima', texto: `Evento climático extremo: prejuízo de R$ ${Math.round(custo)} milhões e famílias desabrigadas.` });
    } else diario.push({ tipo: 'bom', texto: 'A cidade atravessa o evento climático extremo sem danos graves: a drenagem e a defesa civil funcionaram.' });
  }
  if (cen.eventos.some((e) => e.tipo === 'pandemia')) {
    i.expVida -= 1.2 * (1.3 - i.atencaoBasica); pl.aprovacao -= 0.05 * (1 - i.atencaoBasica); m.fin.caixa -= rcl * 0.03;
    diario.push({ tipo: 'ruim', texto: 'A emergência sanitária pressiona a rede de saúde da cidade.' });
  }
  if (rnd(m) < 0.05 * (1 - i.integridade) * (1 + p.articulacao * 0.35)) {
    pl.aprovacao -= 0.09; i.integridade = lim(i.integridade + 0.05, 0, 1);
    diario.push({ tipo: 'ruim', texto: 'Escândalo: denúncia de irregularidades em contratos da prefeitura.' });
  }
  if (p.salario < 0.9 && rnd(m) < 0.5) { for (const s of ['ideb', 'atencaoBasica']) i[s] *= 0.985; pl.aprovacao -= 0.03; diario.push({ tipo: 'ruim', texto: 'Greve dos servidores por reposição salarial.' }); }

  calcularEconomia(m, k);
  m.pobreza = lim(m.pobreza + 0.25 * (m.desemprego - antes.desemprego) - 0.04 * (m.renda / antes.renda - 1) - 0.006 * (Math.pow(nivel.assistencia, 0.7) - 0.95), 0.01, 0.6);

  // 7. Política: a aprovação segue o que o morador sente no dia a dia
  const sente = 0.5 + 2.2 * (i.ideb - antes.ideb) + 0.03 * (antes.homicidios - i.homicidios) + 3 * (antes.desemprego - m.desemprego)
    + 1.2 * (i.infra - antes.infra) + 1.2 * (i.atencaoBasica - antes.atencao) + 1.5 * (m.renda / antes.renda - 1)
    + 0.25 * (qualidade - 0.5) - 0.9 * pl.altaDeImposto + 0.1 * (moral - 1);
  pl.aprovacao = lim(pl.aprovacao + 0.3 * (lim(sente, 0, 1) - pl.aprovacao), 0.03, 0.95);
  pl.base = lim(0.28 + 0.5 * pl.aprovacao + 0.05 * p.articulacao + (m.bonus.apoio || 0), 0.15, 0.95);
  pl.altaDeImposto = 0;
  m.bonus = { vaar: i.ideb > antes.ideb + 0.05 };

  // Intervenção estadual (CF art. 35): dívida sem pagar por dois anos seguidos ou
  // mínimos de educação e saúde descumpridos. Um interventor assume por dois anos.
  if (pl.intervencao) {
    pl.intervencao--;
    p.superavit = 0.07;
    const caro = Object.keys(p.programas).sort((a, b) => PROGRAMAS[b].anual - PROGRAMAS[a].anual)[0];
    if (caro && m.fin.caixa < 0) delete p.programas[caro];
    if (!pl.intervencao) { pl.noPoder = true; pl.vermelho = 0; pl.semMinimos = 0; diario.push({ tipo: 'bom', texto: 'Termina a intervenção estadual: o prefeito reassume.' }); }
  } else if (pl.noPoder && ((pl.vermelho || 0) >= 2 || (pl.semMinimos || 0) >= 2)) {
    pl.intervencao = 2; pl.noPoder = false; pl.aprovacao -= 0.1; pl.intervencoes = (pl.intervencoes || 0) + 1;
    for (const f of ['educacao', 'saude']) if (p.orcamento[f] < 27) p.orcamento[f] = 27;
    diario.push({ tipo: 'lei', texto: `O Estado decreta intervenção no município (art. 35 da Constituição): ${(pl.vermelho || 0) >= 2 ? 'dívidas sem pagamento por dois anos' : 'mínimos de educação e saúde descumpridos'}. Um interventor assume por dois anos.` });
  }

  m.ano++;
  // Eleição municipal a cada quatro anos (2028, 2032, ...): vale para o mandato seguinte.
  if ((m.ano - 1) % LEIS.mandato === 0 && m.ano - 1 >= 2028) {
    const voto = pl.aprovacao + (rnd(m) - 0.5) * 0.08;
    const antesNoPoder = pl.noPoder || !!pl.intervencao;
    let ganhou;
    if (antesNoPoder) ganhou = voto >= 0.47 && !pl.reprovadaNoMandato;
    else ganhou = voto < 0.5;        // fora do poder, o grupo volta se a gestão rival vai mal
    pl.noPoder = ganhou && !pl.intervencao;
    pl.eleicoes.push({ ano: m.ano - 1, venceu: ganhou, aprovacao: +pl.aprovacao.toFixed(2), impugnado: antesNoPoder && pl.reprovadaNoMandato });
    diario.push({ tipo: ganhou ? 'bom' : 'ruim', texto: antesNoPoder
      ? (ganhou ? `Eleição de ${m.ano - 1}: o grupo do prefeito vence com ${Math.round(pl.aprovacao * 100)}% de aprovação.` : pl.reprovadaNoMandato ? `Eleição de ${m.ano - 1}: com as contas rejeitadas, a candidatura é impugnada. A oposição assume.` : `Eleição de ${m.ano - 1}: derrota nas urnas. A oposição assume por quatro anos e mantém o orçamento como está.`)
      : (ganhou ? `Eleição de ${m.ano - 1}: o grupo volta à prefeitura.` : `Eleição de ${m.ano - 1}: a oposição se reelege.`) });
    pl.reprovadaNoMandato = false;
  }
  for (const d of diario) m.diario.push({ ano: m.ano - 1, ...d });
  if (m.diario.length > 300) m.diario.splice(0, m.diario.length - 300);
  m.hist.push(retrato(m));
  return diario;
}

// O que o prefeito lê antes de decidir.
export function situacaoDoMunicipio(m) {
  const r = m.fin.receita, p = m.pol, um = (v) => +(+v).toFixed(1);
  return {
    cidade: m.nome, ano: m.ano, indicadores: retrato(m),
    idhm_componentes: Object.fromEntries(Object.entries(idhm(m)).map(([k, v]) => [k, +v.toFixed(3)])),
    tributos_atuais: { iptu_pct: +(p.iptu * 100).toFixed(2), iss_pct: +(p.iss * 100).toFixed(2), itbi_pct: +(p.itbi * 100).toFixed(2), planta_de_valores_atualizada: p.pgv >= 0.9, iss_ainda_vale: +fatiaISS(m.ano).toFixed(1) },
    receitas_milhoes: r.total ? Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'baseMinimos').map(([k, v]) => [k, um(v)])) : 'primeiro ano',
    orcamento_atual_pct: { ...Object.fromEntries(Object.entries(p.orcamento).map(([k, v]) => [k, um(v)])), meta_de_superavit_pct: um(p.superavit * 100) },
    limites_legais: {
      educacao_minimo_25: m.fin.minimos ? um(m.fin.minimos.educacao * 100) : null, saude_minimo_15: m.fin.minimos ? um(m.fin.minimos.saude * 100) : null,
      folha_sobre_receita_pct: um(m.fin.pessoal * 100), folha_teto: 54, folha_prudencial: 51.3, divida_sobre_receita_pct: um((m.fin.divida / m.fin.rcl) * 100), divida_teto: 120, nota_capag: m.fin.capag,
    },
    servidores: { salario_indice: +p.salario.toFixed(2), quadro_indice: +p.quadro.toFixed(2), previdencia_reformada: p.rppsReformado },
    programas_ativos: Object.keys(p.programas),
    programas_disponiveis: Object.entries(PROGRAMAS).filter(([id]) => p.programas[id] === undefined).map(([id, d]) => ({ id, nome: d.nome, custo_inicial_milhoes: d.custo, custo_anual_milhoes: um((d.anual * m.pop) / 1e6) })),
    politica: { em_intervencao_estadual: !!m.politica.intervencao, anos_seguidos_no_vermelho: m.politica.vermelho || 0, aprovacao: +m.politica.aprovacao.toFixed(2), base_na_camara: +m.politica.base.toFixed(2), proxima_eleicao: Math.ceil((m.ano - 2028) / 4) * 4 + 2028 || 2028, contas_rejeitadas_neste_mandato: m.politica.reprovadaNoMandato },
    ultimos_fatos: m.diario.slice(-4).map((d) => `${d.ano}: ${d.texto}`),
  };
}

// ---------- prefeitos de regras: referência e demonstração sem chave ----------

export function prefeitoPorRegras(m, perfil = 'tecnico') {
  const o = { ...m.pol.orcamento };
  o.meta_de_superavit_pct = perfil === 'populista' ? 0 : m.fin.caixa > m.fin.rcl * 0.15 ? 0 : 3;
  const d = { diagnostico: '', estrategia: '', tributos: {}, orcamento: o, pessoal: { reajuste_real_pct: 0, concurso: 'reposicao' }, programas: { criar: [], encerrar: [] }, credito: { valor_milhoes: 0 }, rivais: {}, articulacao_politica: 1, fala: '', memoria: '' };
  if (perfil === 'inercia') return d;
  const mn = m.fin.minimos || { educacao: 0.3, saude: 0.2 };
  if (mn.educacao < 0.27) o.educacao += 2;
  if (mn.saude < 0.17) o.saude += 2;
  const quer = (id) => m.pol.programas[id] === undefined && PROGRAMAS[id].custo < m.fin.caixa * 0.6 && !Object.entries(PROGRAMAS[id].requer || {}).some(([k, v]) => m.ind[k] < v);
  const filas = {
    tecnico: ['alfabetizacao', 'controladoria', 'governo_digital', 'saude_familia', 'liberdade_economica', 'qualificacao', 'drenagem', 'tempo_integral', 'ppp_saneamento', 'corredores_onibus', 'telemedicina', 'polo_tecnologico', 'creche_universal'],
    populista: ['tarifa_zero', 'renda_basica', 'habitacao_popular', 'creche_universal', 'turismo', 'videomonitoramento'],
    desenvolvimentista: ['distrito_industrial', 'liberdade_economica', 'corredores_onibus', 'qualificacao', 'polo_tecnologico', 'plano_diretor', 'videomonitoramento', 'turismo', 'governo_digital'],
  };
  const fila = filas[perfil] || filas.tecnico;
  const prox = fila.find(quer);
  if (prox && m.fin.caixa > 15 && m.fin.capag !== 'D') d.programas.criar = [prox];
  // Dinheiro sobrando em caixa vira serviço: reforça as áreas mais fracas.
  if (m.fin.caixa > m.fin.rcl * 0.2) { o.meta_de_superavit_pct = 0; o.infraestrutura += 0.4; o.saneamento += 0.3; o.seguranca += 0.2; }
  if (m.fin.caixa < 0) { d.programas.encerrar = Object.keys(m.pol.programas).sort((a, b) => PROGRAMAS[b].anual - PROGRAMAS[a].anual).slice(0, 1); d.pessoal.concurso = 'nenhum'; }
  if (perfil === 'tecnico') {
    if (m.pol.pgv < 0.9 && m.politica.aprovacao > 0.55) d.tributos.atualizar_planta_de_valores = true;
    if (!m.pol.rppsReformado && m.idosos > 0.2 && m.politica.aprovacao > 0.5) d.pessoal.reforma_previdencia = true;
    if (m.ind.resiliencia < 0.5) o.meio_ambiente += 0.5;
    d.pessoal.reajuste_real_pct = m.pol.salario < 0.97 && m.fin.pessoal < 0.5 ? 2 : 0;
  } else if (perfil === 'populista') {
    d.tributos.iptu = Math.max(0.6, m.pol.iptu * 100 - 0.05);
    d.pessoal.reajuste_real_pct = m.fin.pessoal < 0.51 ? 3 : 0;
    d.pessoal.concurso = 'ampliacao';
    o.assistencia += 0.5; o.cultura += 0.3;
    if ((m.ano + 1) % 4 === 0 && m.fin.capag <= 'B') d.credito = { valor_milhoes: m.fin.rcl * 0.05, destino: 'infraestrutura' };
  } else {
    d.tributos.iss = 2;
    o.infraestrutura += 0.6; o.desenvolvimento += 0.3;
    if (m.fin.capag <= 'B' && m.fin.divida < m.fin.rcl * 0.5) d.credito = { valor_milhoes: m.fin.rcl * 0.06, destino: 'infraestrutura' };
    d.rivais = { guerra_fiscal: true };
    d.articulacao_politica = 2;
  }
  return d;
}
