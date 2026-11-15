// Motor da simulação. Estado 100% serializável (JSON) e determinístico por
// semente; não depende de DOM nem de three.js, então roda em teste e no servidor.
import { BENS, ERAS, NEGOCIOS, SERVICOS, CUSTO_CASA, SOBRENOMES, NOMES_CIDADE, CARTAS } from './dados.js';
import { gerarLotes } from './geo.js';

const lim = (v, a, b) => Math.min(b, Math.max(a, v));
const RAMOS = ['da Serra', 'do Vau', 'de Baixo', 'de Cima', 'do Rio', 'da Ponte', 'da Mata', 'do Moinho', 'Velho', 'Novo'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function rnd(w) {
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(w.rng ^ (w.rng >>> 15), w.rng | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const sorteia = (w, lista) => lista[Math.floor(rnd(w) * lista.length)];

export function dataTexto(w) {
  return `${MESES[w.mes % 12]} do ano ${Math.floor(w.mes / 12) + 1}`;
}

function registrar(w, texto, tipo = 'info') {
  w.log.push({ mes: w.mes, texto, tipo });
  if (w.log.length > 300) w.log.shift();
}

// ---------- criação ----------

// opcoes.manual: o Estado não se governa sozinho (na Arena quem decide é a IA).
// opcoes.lentidao: divide o ganho de conhecimento, esticando as eras por séculos.
export function criarMundo(semente = 1, opcoes = {}) {
  const w = {
    versao: 1, semente, rng: semente | 0, mes: 0, proxId: 1,
    nome: '', era: 0, conhecimento: 0, terra: 14, seguranca: 1,
    precos: Object.fromEntries(Object.entries(BENS).map(([k, b]) => [k, b.base])),
    familias: [], negocios: [], mods: [], log: [], hist: [],
    lotes: gerarLotes().map((l) => ({ ...l, uso: null })),
    estado: { existe: false, tesouro: 0, taxa: 0, legitimidade: 0.6, predios: [], mesesFraco: 0, exercito: 0 },
    ia: false, greve: 0, ind: {}, manual: !!opcoes.manual, lentidao: opcoes.lentidao || 1,
  };
  w.nome = sorteia(w, NOMES_CIDADE);
  if (opcoes.nome) w.nome = opcoes.nome;
  for (let i = 0; i < 5; i++) novaFamilia(w, { membros: 3 + Math.floor(rnd(w) * 3), riqueza: 30 + rnd(w) * 35 });
  registrar(w, `Cinco famílias erguem as primeiras cabanas em ${w.nome}.`, 'era');
  calcularIndicadores(w);
  return w;
}

function pegarLote(w, pref, uso) {
  const livres = w.lotes.filter((l) => !l.uso);
  if (!livres.length) return null;
  let lote = livres[Math.floor(rnd(w) * Math.min(3, livres.length))];
  if (pref === 'borda') lote = livres[Math.min(livres.length - 1, 10 + Math.floor(rnd(w) * 14))];
  lote.uso = uso;
  return { x: lote.x, z: lote.z };
}

function soltarLote(w, pos) {
  const l = w.lotes.find((q) => q.x === pos.x && q.z === pos.z);
  if (l) l.uso = null;
}

function novaFamilia(w, { membros = 4, riqueza = 25, nome } = {}) {
  // Os últimos lotes ficam reservados para negócios e prédios públicos.
  if (w.lotes.filter((l) => !l.uso).length < 40) return null;
  const id = w.proxId++;
  const pos = pegarLote(w, 'centro', 'casa');
  if (!pos) return null;
  const usados = new Set(w.familias.map((f) => f.nome));
  let livres = SOBRENOMES.filter((s) => !usados.has(s));
  // Acabaram os sobrenomes simples: surgem os ramos ("Barroso da Serra").
  if (!livres.length) livres = SOBRENOMES.flatMap((s) => RAMOS.map((r) => `${s} ${r}`)).filter((s) => !usados.has(s));
  const f = {
    id, nome: nome || (livres.length ? sorteia(w, livres) : `${sorteia(w, SOBRENOMES)} ${id}`),
    membros, riqueza, emprego: null, dono: 0, renda: 0,
    felicidade: 0.6, saude: 0.75, educacao: 0.05, nivelCasa: 0, materiais: 0,
    fome: 0, infeliz: 0, pos, chegou: w.mes,
  };
  w.familias.push(f);
  return f;
}

function removerFamilia(w, f) {
  for (const n of negociosDe(w, f)) fecharNegocio(w, n, false);
  if (f.emprego) {
    const n = negocio(w, f.emprego);
    if (n) n.funcionarios = n.funcionarios.filter((id) => id !== f.id);
  }
  soltarLote(w, f.pos);
  w.familias = w.familias.filter((q) => q !== f);
}

const familia = (w, id) => w.familias.find((f) => f.id === id);
const negocio = (w, id) => w.negocios.find((n) => n.id === id);
const negociosDe = (w, f) => w.negocios.filter((n) => n.dono === f.id);
export const temServico = (w, tipo) => w.estado.predios.some((p) => p.tipo === tipo);
export const populacao = (w) => w.familias.reduce((s, f) => s + f.membros, 0);

function abrirNegocio(w, dono, tipo) {
  const def = NEGOCIOS[tipo];
  const entrada = def.custo * entradaMinima(w);
  if (!def || def.era > w.era || dono.riqueza < entrada) return null;
  // Os últimos lotes ficam para os prédios públicos.
  if (w.lotes.filter((l) => !l.uso).length <= 12) return null;
  const pos = pegarLote(w, def.lote, 'negocio');
  if (!pos) return null;
  if (dono.emprego) {
    const ant = negocio(w, dono.emprego);
    if (ant) ant.funcionarios = ant.funcionarios.filter((id) => id !== dono.id);
    dono.emprego = null;
  }
  dono.riqueza -= entrada;
  const n = {
    id: w.proxId++, tipo, dono: dono.id, nivel: 1, capital: def.custo * 0.6 - (def.custo - entrada), divida: def.custo - entrada, salario: salarioDeMercado(w),
    funcionarios: [], estoque: 0, lucro: 0, receita: 0, prejuizo: 0, bons: 0, pos, aberto: w.mes,
  };
  dono.dono++;
  w.negocios.push(n);
  registrar(w, `Os ${dono.nome} abrem uma ${def.nome.toLowerCase()}.`, 'negocio');
  return n;
}

function fecharNegocio(w, n, avisar = true) {
  if (!n) return;
  for (const id of n.funcionarios) { const f = familia(w, id); if (f) f.emprego = null; }
  const d = familia(w, n.dono);
  if (d) { d.dono = Math.max(0, d.dono - 1); d.riqueza += Math.max(0, n.capital) * 0.5; }
  soltarLote(w, n.pos);
  w.negocios = w.negocios.filter((q) => q !== n);
  if (avisar && d) registrar(w, `A ${NEGOCIOS[n.tipo].nome.toLowerCase()} dos ${d.nome} fecha as portas.`, 'ruim');
}

// Com banco na cidade há crédito: metade do investimento pode ser financiada.
const entradaMinima = (w) => (w.negocios.some((n) => n.tipo === 'banco') ? 0.5 : 1);

function salarioDeMercado(w) {
  if (!w.negocios.length) return 5;
  const peso = (n) => n.funcionarios.length + 0.1;
  return w.negocios.reduce((s, n) => s + n.salario * peso(n), 0) / w.negocios.reduce((s, n) => s + peso(n), 0);
}

// ---------- modificadores ----------

function modProducao(w, bem) {
  let m = 1 + 0.15 * w.era + (temServico(w, 'estrada') ? 0.1 : 0) + (temServico(w, 'ferrovia') ? 0.2 : 0);
  m *= 1 + (w.ind.educacao || 0) * 0.3;
  for (const mod of w.mods) if (mod.alvo === 'tudo' || mod.alvo === bem) m *= mod.fator;
  if (w.greve > 0 && bem !== 'roca') m *= 0.5;
  return m;
}

function rendaRoca(w, f, nRoca) {
  const aperto = Math.sqrt(Math.min(1, w.terra / Math.max(1, nRoca)));
  let m = 1;
  for (const mod of w.mods) if (mod.alvo === 'tudo' || mod.alvo === 'comida') m *= mod.fator;
  return f.membros * 1.3 * aperto * m * (1 + 0.05 * w.era);
}

// ---------- o mês ----------

export function avancarMes(w) {
  w.mes++;
  const taxa = w.estado.existe ? w.estado.taxa : 0;
  let arrecadado = 0;

  // 1. Contratações e demissões voluntárias
  const roceiros = () => w.familias.filter((f) => !f.emprego && !f.dono);
  let nRoca = roceiros().length;
  for (const n of w.negocios) {
    const def = NEGOCIOS[n.tipo];
    const vagas = def.empregos * n.nivel - 1 - n.funcionarios.length;
    for (let v = 0; v < vagas; v++) {
      const cands = roceiros().sort((a, b) => a.riqueza - b.riqueza);
      const c = cands.find((f) => n.salario > rendaRoca(w, f, nRoca) * w.precos.comida * 0.9);
      if (!c) { if (n.lucro > n.folha * 0.3 && n.salario < (n.receita / (n.funcionarios.length + 1)) * 0.7) n.salario *= 1.02; break; }
      c.emprego = n.id; n.funcionarios.push(c.id); nRoca--;
    }
    if (vagas <= 0 && nRoca > w.terra) n.salario = Math.max(3, n.salario * 0.995);
  }

  // 2. Produção
  const oferta = { comida: [], materiais: [], bens: [], servicos: [] };
  nRoca = roceiros().length;
  for (const f of w.familias) {
    f.renda = 0; f.comidaPropria = 0;
    if (!f.emprego && !f.dono) {
      const prod = rendaRoca(w, f, nRoca);
      f.comidaPropria = Math.min(prod, f.membros);
      const sobra = prod - f.comidaPropria;
      if (sobra > 0.01) oferta.comida.push({ qtd: sobra, receber: (v) => { f.riqueza += v; f.renda += v; } });
    }
  }
  for (const n of w.negocios) {
    const def = NEGOCIOS[n.tipo];
    n.estoque += (n.funcionarios.length + 1) * def.prod * modProducao(w, def.produz) * (0.8 + 0.2 * n.nivel);
    n.receita = 0;
    oferta[def.produz].push({ qtd: n.estoque, neg: n, receber: (v) => { n.receita += v; } });
  }

  // 3. Salários (pagos antes das compras, com o caixa do negócio)
  // Só se paga o que há em caixa (mais um aporte do dono). Sem isso o negócio
  // criaria dinheiro do nada e a cidade entraria em hiperinflação.
  for (const n of w.negocios) {
    const devido = n.salario * n.funcionarios.length;
    if (n.capital < devido) {
      const dono = familia(w, n.dono);
      const aporte = Math.min(devido - Math.max(0, n.capital), Math.max(0, dono.riqueza) * 0.3);
      dono.riqueza -= aporte; n.capital += aporte;
    }
    const fracao = devido > 0 ? lim(Math.max(0, n.capital) / devido, 0, 1) : 1;
    n.folha = devido * fracao; n.capital -= n.folha; n.atraso = fracao < 0.999;
    for (const id of [...n.funcionarios]) {
      const f = familia(w, id);
      const bruto = n.salario * fracao, imp = bruto * taxa * 0.4;
      f.riqueza += bruto - imp; f.renda += bruto - imp; arrecadado += imp;
      if (fracao < 0.6) { f.emprego = null; n.funcionarios = n.funcionarios.filter((q) => q !== id); }
    }
  }

  // 4. Mercado
  const consumo = new Map(w.familias.map((f) => [f.id, { comida: f.comidaPropria, materiais: 0, bens: 0, servicos: 0 }]));
  const exportacao = temServico(w, 'ferrovia') ? 0.8 : 0.6;
  let pib = 0;
  for (const bem of Object.keys(BENS)) {
    const p = w.precos[bem];
    const pedidos = [];
    for (const f of w.familias) {
      let q = 0;
      if (bem === 'comida') q = Math.min(f.membros - f.comidaPropria, Math.max(0, f.riqueza) / p);
      else {
        const livre = Math.max(0, f.riqueza - f.membros * w.precos.comida) * 0.35;
        const querCasa = f.nivelCasa < Math.min(3, w.era + 1);
        const partes = { materiais: querCasa ? 0.3 : 0.04, bens: 0.4, servicos: 0.3 };
        q = (livre * partes[bem]) / p;
      }
      if (q > 0.001) pedidos.push({ f, q });
    }
    const D = pedidos.reduce((s, x) => s + x.q, 0);
    const S = oferta[bem].reduce((s, x) => s + x.qtd, 0);
    const vendido = Math.min(D, S);
    const rc = D > 0 ? vendido / D : 0;
    const rv = S > 0 ? vendido / S : 0;
    for (const { f, q } of pedidos) {
      let comprou = q * rc;
      f.riqueza -= comprou * p;
      // Falta comida na vila: quem pode compra da caravana, bem mais caro.
      if (bem === 'comida' && rc < 1) {
        const falta = Math.min(q - comprou, Math.max(0, f.riqueza) / (BENS.comida.base * 1.9));
        f.riqueza -= falta * BENS.comida.base * 1.9; comprou += falta;
      }
      consumo.get(f.id)[bem] += comprou;
    }
    for (const o of oferta[bem]) {
      const local = o.qtd * rv;
      const exporta = (o.qtd - local) * 0.8;
      const valExp = (exporta * BENS[bem].base * exportacao) / (1 + (S - vendido) / (60 * (1 + w.era)));
      o.receber(local * p + valExp);
      pib += local * p + valExp;
      if (o.neg) o.neg.estoque = (o.qtd - local - exporta) * 0.4;
    }
    const pressao = (D - S) / Math.max(D, S, 1);
    w.precos[bem] = lim(p * (1 + 0.12 * pressao), BENS[bem].base * 0.5, BENS[bem].base * 1.9);
  }

  // 5. Fechamento dos negócios
  for (const n of [...w.negocios]) {
    const def = NEGOCIOS[n.tipo];
    const dono = familia(w, n.dono);
    const roubo = w.seguranca < 0.5 ? n.receita * (0.5 - w.seguranca) * 0.3 : 0;
    n.lucro = n.receita - n.folha - def.custo * 0.01 * n.nivel - roubo;
    const imp = Math.max(0, n.lucro) * taxa;
    arrecadado += imp;
    n.capital += n.receita - def.custo * 0.01 * n.nivel - roubo - imp;
    const reserva = n.folha * 3 + def.custo * 0.2 * n.nivel;
    if (n.capital > reserva) { const div = (n.capital - reserva) * 0.5; n.capital -= div; dono.riqueza += div; dono.renda += div; }
    if (n.lucro < 0 || n.atraso) {
      n.prejuizo++; n.bons = 0;
      n.salario = Math.max(3, n.salario * 0.97);
      if (n.prejuizo >= 8) fecharNegocio(w, n);
    } else if (n.lucro > 0) {
      n.prejuizo = Math.max(0, n.prejuizo - 1); n.bons++;
      if (n.lucro > n.folha * 0.4 && n.funcionarios.length) n.salario *= 1.006;
    }
  }

  // 6. Famílias: bem-estar, casa, demografia
  const densidade = w.era >= 2 && !temServico(w, 'saneamento') ? 0.12 : 0;
  const cura = (temServico(w, 'posto') ? 0.15 : 0) + (temServico(w, 'hospital') ? 0.2 : 0);
  const alvoEduc = temServico(w, 'universidade') ? 0.9 : temServico(w, 'escola') ? 0.55 : 0.08;
  for (const f of [...w.familias]) {
    const c = consumo.get(f.id);
    const alim = lim(c.comida / f.membros, 0, 1);
    f.materiais += c.materiais;
    if (f.nivelCasa < 3 && f.nivelCasa < w.era + 1 && f.materiais >= CUSTO_CASA[f.nivelCasa + 1]) {
      f.materiais -= CUSTO_CASA[f.nivelCasa + 1]; f.nivelCasa++;
    }
    const alvoSaude = lim(0.35 + 0.4 * alim + cura - densidade + f.nivelCasa * 0.03, 0, 1);
    f.saude += (alvoSaude - f.saude) * 0.1;
    f.educacao += (alvoEduc - f.educacao) * 0.012;
    const alvoFel = 0.36 * alim + 0.18 * Math.min(1, c.bens / (f.membros * 0.25)) + 0.14 * Math.min(1, c.servicos / (f.membros * 0.2))
      + 0.14 * f.saude + 0.1 * w.seguranca + 0.08 * (f.nivelCasa / 3) + 0.06 - taxa * 0.25;
    f.felicidade = lim(f.felicidade + (alvoFel - f.felicidade) * 0.2, 0, 1);
    f.fome = alim < 0.6 ? f.fome + 1 : 0;
    f.infeliz = f.felicidade < 0.28 ? f.infeliz + 1 : 0;

    if (f.fome >= 3 && rnd(w) < 0.3) f.membros--;
    if (rnd(w) < f.membros * 0.0011 * (2 - f.saude)) f.membros--;
    if (alim > 0.9 && f.membros < 8 && rnd(w) < 0.02 * (0.5 + f.saude) * (1 - 0.65 * f.educacao)) f.membros++;
    if (f.membros <= 0) { registrar(w, `A casa dos ${f.nome} fica vazia.`, 'ruim'); removerFamilia(w, f); continue; }
    if (f.infeliz >= 10 && !f.dono) { registrar(w, `Os ${f.nome} juntam as trouxas e vão embora.`, 'ruim'); removerFamilia(w, f); continue; }
    if (f.membros >= 6 && f.riqueza > 15 && rnd(w) < 0.15) {
      const nova = novaFamilia(w, { membros: 2, riqueza: f.riqueza * 0.3 });
      if (nova) { f.membros -= 2; f.riqueza *= 0.7; nova.educacao = f.educacao; }
    }
  }

  // 7. Empresários (regras): abrir e ampliar negócios
  const confianca = confiancaEmpresarial(w);
  for (const f of w.familias) {
    if (rnd(w) > 0.12 * confianca / (1 + f.dono * 2)) continue;
    const tipo = melhorOportunidade(w, f);
    if (tipo) abrirNegocio(w, f, tipo);
  }
  for (const n of w.negocios) {
    const def = NEGOCIOS[n.tipo];
    const cheio = n.funcionarios.length >= def.empregos * n.nivel - 1;
    if (n.nivel < 4 && cheio && n.bons >= 8 && n.capital > def.custo * 0.6 * n.nivel && rnd(w) < 0.2 * confianca) {
      n.capital -= def.custo * 0.6 * n.nivel; n.nivel++; n.bons = 0;
      registrar(w, `A ${def.nome.toLowerCase()} dos ${familia(w, n.dono).nome} é ampliada.`, 'negocio');
    }
  }

  // 8. Migração, segurança, conhecimento
  calcularIndicadores(w);
  const vagas = w.negocios.reduce((s, n) => s + Math.max(0, NEGOCIOS[n.tipo].empregos * n.nivel - 1 - n.funcionarios.length), 0);
  const atracao = lim(0.015 + vagas * 0.012 + (w.ind.felicidade - 0.5) * 0.1, 0, 0.12);
  if (w.ind.felicidade > 0.4 && rnd(w) < atracao) {
    const f = novaFamilia(w, { membros: 2 + Math.floor(rnd(w) * 3), riqueza: 20 + rnd(w) * 35 });
    if (f) registrar(w, `Os ${f.nome} chegam para tentar a vida em ${w.nome}.`);
  }
  const alvoSeg = temServico(w, 'guarda') ? 0.92 : lim(1 - w.ind.populacao / 160, 0.25, 1);
  w.seguranca = lim(w.seguranca + (alvoSeg - w.seguranca) * 0.05, 0, 1);
  w.conhecimento += (0.05 + w.ind.populacao * 0.0015 + w.ind.educacao * w.ind.populacao * 0.004) / (w.lentidao || 1);

  // 9. Estado
  cicloDoEstado(w, arrecadado);

  // 10. Eras, modificadores, histórico
  const prox = ERAS[w.era + 1];
  if (prox && w.ind.populacao >= prox.pop && w.conhecimento >= prox.conhecimento
    && (!prox.requer || (prox.requer === 'estado' ? w.estado.existe : temServico(w, prox.requer)))) {
    w.era++; w.terra += 4;
    registrar(w, `${w.nome} entra em uma nova era: ${prox.nome}.`, 'era');
  }
  w.mods = w.mods.filter((m) => --m.meses > 0);
  if (w.greve > 0) w.greve--;
  w.ind.pib = pib;
  calcularIndicadores(w);
  if (w.mes % 12 === 0) {
    cicloAnual(w);
    w.hist.push({ ano: w.mes / 12, pop: w.ind.populacao, pib: Math.round(pib), fel: +w.ind.felicidade.toFixed(2), gini: +w.ind.gini.toFixed(2) });
    if (w.hist.length > 400) w.hist.shift();
  }
  return w;
}

function melhorOportunidade(w, f) {
  let melhor = null, nota = 1.05;
  for (const [tipo, def] of Object.entries(NEGOCIOS)) {
    if (def.era > w.era || f.riqueza < def.custo * entradaMinima(w) * (1.15 + f.dono * 0.6)) continue;
    const iguais = w.negocios.filter((n) => NEGOCIOS[n.tipo].produz === def.produz).length;
    const carencia = w.precos[def.produz] / BENS[def.produz].base;
    const saturacao = iguais / Math.max(1, w.familias.length / 5);
    const n = carencia * (1 + def.prod * BENS[def.produz].base * 0.02) - saturacao * 0.35 + rnd(w) * 0.1;
    if (n > nota) { nota = n; melhor = tipo; }
  }
  return melhor;
}

export function confiancaEmpresarial(w) {
  const taxa = w.estado.existe ? w.estado.taxa : 0;
  return lim(1.05 - taxa * 2.2 + (temServico(w, 'estrada') ? 0.1 : 0) + (w.seguranca - 0.5) * 0.4, 0.1, 1.3);
}

// ---------- Estado ----------

function fundarEstado(w, motivo) {
  if (w.estado.existe) return false;
  Object.assign(w.estado, { existe: true, taxa: 0.08, legitimidade: 0.6, mesesFraco: 0 });
  construir(w, 'conselho', true);
  registrar(w, motivo || `Em assembleia na praça, ${w.nome} elege seu primeiro conselho. Nascem os impostos.`, 'estado');
  return true;
}

function construir(w, tipo, gratis = false) {
  const def = SERVICOS[tipo];
  if (!def || def.era > w.era || temServico(w, tipo)) return false;
  if (!gratis && w.estado.tesouro < def.custo) return false;
  const pos = def.semPredio ? null : pegarLote(w, 'centro', 'estado');
  if (!def.semPredio && !pos) return false;
  if (!gratis) {
    w.estado.tesouro -= def.custo;
    // Obra pública vira contrato: parte do dinheiro vai para quem vende materiais.
    const forn = w.negocios.filter((n) => NEGOCIOS[n.tipo].produz === 'materiais');
    for (const n of forn) n.capital += (def.custo * 0.6) / forn.length;
  }
  w.estado.predios.push({ id: w.proxId++, tipo, pos, mes: w.mes });
  if (tipo !== 'conselho') registrar(w, `O conselho inaugura: ${def.nome}.`, 'estado');
  return true;
}

function cicloDoEstado(w, arrecadado) {
  const e = w.estado;
  if (!e.existe) {
    if (w.familias.length >= 12 && (w.seguranca < 0.75 || w.familias.length >= 18)) fundarEstado(w);
    return;
  }
  e.tesouro += arrecadado;
  e.arrecadado = arrecadado;
  // Soldado custa soldo todo mês; sem dinheiro para pagar, a tropa deserta.
  const soldo = (e.exercito || 0) * 0.5;
  if (e.tesouro < 0 && e.exercito > 0) e.exercito = Math.floor(e.exercito * 0.93);
  const gasto = e.predios.reduce((s, p) => s + SERVICOS[p.tipo].manut, 0) * (1 + w.ind.populacao / 120) + soldo;
  e.tesouro = Math.max(-60, e.tesouro - gasto); e.gasto = gasto;
  for (const f of w.familias) f.riqueza += (gasto * 0.7) / w.familias.length;
  const alvo = lim(0.2 + 0.55 * w.ind.felicidade + 0.04 * e.predios.length - e.taxa * 0.7 - (e.tesouro < 0 ? 0.1 : 0), 0, 1);
  e.legitimidade += (alvo - e.legitimidade) * 0.06;
  e.mesesFraco = e.legitimidade < 0.22 ? e.mesesFraco + 1 : 0;
  if (e.mesesFraco >= 12) {
    e.taxa = 0.05; e.tesouro = Math.max(0, e.tesouro * 0.5); e.legitimidade = 0.5; e.mesesFraco = 0;
    registrar(w, 'Revolta! O povo derruba o conselho e escolhe outro, que promete impostos leves.', 'ruim');
  }
}

export function necessidadesDoEstado(w) {
  const ordem = [];
  const quer = (t, cond) => { if (cond && !temServico(w, t) && SERVICOS[t].era <= w.era) ordem.push(t); };
  quer('guarda', w.seguranca < 0.7);
  quer('posto', w.ind.saude < 0.7);
  quer('estrada', true); quer('escola', true); quer('saneamento', true);
  quer('guarda', true); quer('posto', true);
  quer('hospital', true); quer('universidade', true); quer('ferrovia', true);
  return [...new Set(ordem)];
}

function cicloAnual(w) {
  const e = w.estado;
  if (e.existe && !w.manual) {
    if (e.tesouro < 0 && e.taxa < 0.24 && (e.arrecadado || 0) > 0) { e.taxa = lim(e.taxa + 0.02, 0, 0.4); registrar(w, `Cofres vazios: o conselho sobe os impostos para ${Math.round(e.taxa * 100)}%.`, 'estado'); }
    else if (e.tesouro >= 0) {
      const falta = necessidadesDoEstado(w);
      if (falta.length) { if (!construir(w, falta[0]) && e.legitimidade > 0.5 && e.taxa < 0.18) e.taxa += 0.01; }
      else if (e.tesouro > (e.gasto || 1) * 18) {
        if (e.taxa > 0.04) e.taxa -= 0.01;
        const auxilio = e.tesouro * 0.3;
        const pobres = [...w.familias].sort((a, b) => a.riqueza - b.riqueza).slice(0, Math.ceil(w.familias.length / 2));
        pobres.forEach((f) => { f.riqueza += auxilio / pobres.length; });
        e.tesouro -= auxilio; e.legitimidade = lim(e.legitimidade + 0.03, 0, 1);
        registrar(w, 'Cofres cheios: o conselho alivia impostos e distribui auxílio às famílias mais pobres.', 'estado');
      }
    }
  }
  // Lobby: empresários ricos e impostos altos.
  if (e.existe && w.ind.influencia > 0.45 && e.taxa > 0.12 && rnd(w) < 0.6) pressionar(w);
  // Greve: salário mal paga a comida e os patrões lucram.
  const sal = salarioDeMercado(w);
  const lucro = w.negocios.reduce((s, n) => s + n.lucro, 0);
  if (w.negocios.length >= 3 && sal < w.precos.comida * 5.2 && lucro > 0 && rnd(w) < 0.5) {
    w.greve = 2;
    for (const n of w.negocios) n.salario *= 1.12;
    registrar(w, 'Greve! Os trabalhadores cruzam os braços e arrancam aumento dos patrões.', 'ruim');
  }
}

function pressionar(w) {
  const e = w.estado;
  if (!e.existe) return;
  e.taxa = lim(e.taxa - 0.02, 0.02, 0.4); e.legitimidade = lim(e.legitimidade - 0.05, 0, 1);
  registrar(w, `Os donos de negócio pressionam o conselho, que recua: impostos em ${Math.round(e.taxa * 100)}%.`, 'negocio');
}

// ---------- indicadores ----------

export function calcularIndicadores(w) {
  const fs = w.familias;
  const pop = populacao(w) || 1;
  const media = (fn) => fs.reduce((s, f) => s + fn(f) * f.membros, 0) / pop;
  const riq = fs.map((f) => Math.max(0, f.riqueza)).sort((a, b) => a - b);
  const total = riq.reduce((s, v) => s + v, 0) || 1;
  let acum = 0, area = 0;
  for (const v of riq) { acum += v; area += acum; }
  const gini = riq.length > 1 ? lim(1 + 1 / riq.length - (2 * area) / (riq.length * total), 0, 1) : 0;
  const donos = fs.filter((f) => f.dono).reduce((s, f) => s + Math.max(0, f.riqueza), 0);
  const taxa = w.estado.existe ? w.estado.taxa : 0;
  const influencia = donos / total;
  w.ind = {
    ...w.ind,
    populacao: populacao(w), familias: fs.length, negocios: w.negocios.length,
    felicidade: media((f) => f.felicidade), saude: media((f) => f.saude), educacao: media((f) => f.educacao),
    riquezaMedia: total / Math.max(1, fs.length), gini, influencia,
    emprego: fs.length ? fs.filter((f) => f.emprego || f.dono).length / fs.length : 0,
    salario: salarioDeMercado(w), confianca: confiancaEmpresarial(w),
    tensao: w.estado.existe ? lim(taxa * 2 + (1 - confiancaEmpresarial(w)) * 0.5 + influencia * 0.3 - w.estado.legitimidade * 0.25, 0, 1) : 0,
  };
  return w.ind;
}

// ---------- eventos do narrador ----------

export function aplicarEfeito(w, e) {
  const v = Number(e.valor) || 0;
  const todos = (fn) => w.familias.forEach(fn);
  switch (e.tipo) {
    case 'producao': {
      const alvo = ['comida', 'materiais', 'bens', 'servicos'].includes(e.alvo) ? e.alvo : 'tudo';
      w.mods.push({ alvo, fator: lim(v || 1, 0.1, 3), meses: lim(Math.round(e.meses) || 6, 1, 60) });
      break;
    }
    case 'familias':
      if (v > 0) for (let i = 0; i < Math.min(12, Math.round(v)); i++) {
        const rico = e.alvo === 'ricos';
        novaFamilia(w, { membros: 2 + Math.floor(rnd(w) * 3), riqueza: rico ? 220 + rnd(w) * 120 : 15 + rnd(w) * 25 });
      } else {
        const saem = [...w.familias].filter((f) => !f.dono).sort((a, b) => a.felicidade - b.felicidade).slice(0, Math.min(8, Math.round(-v)));
        saem.forEach((f) => removerFamilia(w, f));
      }
      break;
    case 'riqueza': {
      if (e.alvo === 'estado') { w.estado.tesouro += v; break; }
      const ord = [...w.familias].sort((a, b) => a.riqueza - b.riqueza);
      const metade = Math.ceil(ord.length / 2);
      const alvos = e.alvo === 'ricos' ? ord.slice(metade) : e.alvo === 'pobres' ? ord.slice(0, metade) : ord;
      alvos.forEach((f) => { f.riqueza = Math.max(0, f.riqueza + lim(v, -500, 500)); });
      break;
    }
    case 'saude': todos((f) => { f.saude = lim(f.saude + v, 0, 1); }); break;
    case 'felicidade': todos((f) => { f.felicidade = lim(f.felicidade + v, 0, 1); }); break;
    case 'educacao': todos((f) => { f.educacao = lim(f.educacao + v, 0, 1); }); break;
    case 'seguranca': w.seguranca = lim(w.seguranca + v, 0, 1); break;
    case 'legitimidade': w.estado.legitimidade = lim(w.estado.legitimidade + v, 0, 1); break;
    case 'conhecimento': w.conhecimento = Math.max(0, w.conhecimento + lim(v, -200, 300)); break;
    case 'imposto': if (w.estado.existe) w.estado.taxa = lim(w.estado.taxa + v, 0, 0.5); break;
    case 'mortes': {
      let n = Math.round(populacao(w) * lim(v, 0, 0.5));
      while (n-- > 0 && w.familias.length) {
        const f = sorteia(w, w.familias);
        if (--f.membros <= 0) removerFamilia(w, f);
      }
      break;
    }
    case 'destruir':
      for (let i = 0; i < Math.min(8, Math.round(v)); i++) {
        if (w.negocios.length && rnd(w) < 0.4) fecharNegocio(w, sorteia(w, w.negocios), false);
        else if (w.familias.length) { const f = sorteia(w, w.familias); f.nivelCasa = 0; f.materiais = 0; f.riqueza *= 0.6; }
      }
      break;
    case 'fundar_estado': fundarEstado(w); break;
    default: return false;
  }
  return true;
}

export function aplicarEvento(w, ev) {
  registrar(w, `${ev.titulo}: ${ev.narrativa || ev.texto || ''}`.trim(), 'evento');
  for (const e of ev.efeitos || []) aplicarEfeito(w, e);
  calcularIndicadores(w);
}

// Sem IA disponível, o texto livre é casado com a carta mais parecida.
export function interpretarTexto(texto) {
  const t = texto.toLowerCase();
  let melhor = null, pontos = 0;
  for (const c of CARTAS) {
    const p = c.chaves.filter((k) => t.includes(k)).length;
    if (p > pontos) { pontos = p; melhor = c; }
  }
  if (!melhor) return { titulo: 'Rumores', narrativa: texto, efeitos: [{ tipo: 'felicidade', alvo: 'nenhum', valor: 0.02, meses: 0 }], aproximado: true };
  return { titulo: melhor.titulo, narrativa: texto, efeitos: melhor.efeitos, aproximado: true };
}

// ---------- decisões vindas dos agentes de IA ----------

export function aplicarDecisoes(w, d) {
  const e = w.estado;
  if (d.estado && e.existe) {
    const delta = lim(Number(d.estado.imposto_delta) || 0, -0.05, 0.05);
    if (delta) e.taxa = lim(e.taxa + delta, 0, 0.5);
    if (d.estado.construir && d.estado.construir !== 'nada') construir(w, d.estado.construir);
    if (d.estado.fala) registrar(w, `Conselho: “${d.estado.fala}”`, 'estado');
  }
  for (const a of d.empresarios || []) {
    const f = familia(w, a.familia);
    if (!f) continue;
    const n = negociosDe(w, f)[0] || null;
    if (a.acao === 'investir') abrirNegocio(w, f, a.negocio);
    else if (a.acao === 'expandir' && n && n.nivel < 3 && n.capital + f.riqueza > NEGOCIOS[n.tipo].custo * 0.6 * n.nivel) {
      const custo = NEGOCIOS[n.tipo].custo * 0.6 * n.nivel;
      const doCaixa = Math.min(Math.max(0, n.capital), custo);
      n.capital -= doCaixa; f.riqueza -= custo - doCaixa; n.nivel++;
    } else if (a.acao === 'aumentar_salarios' && n) n.salario *= 1.1;
    else if (a.acao === 'cortar_salarios' && n) n.salario = Math.max(3, n.salario * 0.92);
    else if (a.acao === 'pressionar') pressionar(w);
    if (a.fala) registrar(w, `${f.nome}: “${a.fala}”`, 'negocio');
  }
  calcularIndicadores(w);
}

// Resumo compacto do mundo, enviado aos agentes de IA.
// `curto` manda só o contexto geral (para interpretar eventos gasta-se menos).
export function resumoParaIA(w, curto = false) {
  const i = w.ind;
  const p2 = (v) => +v.toFixed(2);
  return {
    cidade: w.nome, data: dataTexto(w), era: ERAS[w.era].nome,
    populacao: i.populacao, familias: i.familias, felicidade: p2(i.felicidade), saude: p2(i.saude),
    educacao: p2(i.educacao), desigualdade_gini: p2(i.gini), seguranca: p2(w.seguranca),
    salario_medio: p2(i.salario), precos: Object.fromEntries(Object.entries(w.precos).map(([k, v]) => [k, p2(v)])),
    estado: !w.estado.existe ? null : curto ? { imposto: p2(w.estado.taxa), legitimidade: p2(w.estado.legitimidade) } : {
      imposto: p2(w.estado.taxa), tesouro: Math.round(w.estado.tesouro), arrecadacao_mensal: Math.round(w.estado.arrecadado || 0),
      legitimidade: p2(w.estado.legitimidade), servicos: w.estado.predios.map((p) => p.tipo),
      pode_construir: Object.entries(SERVICOS).filter(([t, s]) => s.era <= w.era && !temServico(w, t)).map(([t, s]) => ({ tipo: t, custo: s.custo })),
    },
    ...(curto ? {} : {
    negocios_possiveis: Object.entries(NEGOCIOS).filter(([, n]) => n.era <= w.era).map(([t, n]) => ({ tipo: t, custo: n.custo, produz: n.produz })),
    empresarios: [...w.familias].sort((a, b) => b.riqueza - a.riqueza).slice(0, 3).map((f) => {
      const n = negociosDe(w, f)[0] || null;
      return { familia: f.id, nome: f.nome, riqueza: Math.round(f.riqueza), negocios: f.dono,
        negocio: n ? { tipo: n.tipo, nivel: n.nivel, lucro_mensal: Math.round(n.lucro), salario: p2(n.salario), funcionarios: n.funcionarios.length } : null };
    }),
    ultimos_fatos: w.log.slice(-5).map((l) => l.texto),
    }),
  };
}

// ---------- Arena: uma mente governa o Estado ----------

export function pontos(w) {
  const i = w.ind;
  return Math.round(w.era * 150 + i.populacao * 0.4 + w.conhecimento * 0.1 + i.felicidade * 100 + i.educacao * 100);
}

// O que o governante enxerga da própria cidade.
export function resumoGoverno(w) {
  const i = w.ind, e = w.estado, p2 = (v) => +v.toFixed(2);
  const prox = ERAS[w.era + 1];
  return {
    cidade: w.nome, ano: Math.floor(w.mes / 12) + 1, era: ERAS[w.era].nome, pontos: pontos(w),
    proxima_era: prox ? { nome: prox.nome, exige_populacao: prox.pop, exige_conhecimento: prox.conhecimento, exige: prox.requer || 'nada' } : null,
    populacao: i.populacao, familias: i.familias, negocios: i.negocios, conhecimento: Math.round(w.conhecimento),
    felicidade: p2(i.felicidade), saude: p2(i.saude), educacao: p2(i.educacao), seguranca: p2(w.seguranca),
    desigualdade: p2(i.gini), emprego: p2(i.emprego), salario: p2(i.salario), confianca_empresarios: p2(i.confianca),
    precos: Object.fromEntries(Object.entries(w.precos).map(([k, v]) => [k, p2(v)])),
    imposto: p2(e.taxa), tesouro: Math.round(e.tesouro), arrecadacao_mensal: Math.round(e.arrecadado || 0), gasto_mensal: Math.round(e.gasto || 0),
    legitimidade: p2(e.legitimidade), exercito: e.exercito || 0, soldo_mensal: (e.exercito || 0) * 0.5,
    servicos: e.predios.map((p) => p.tipo),
    pode_construir: Object.entries(SERVICOS).filter(([t, v]) => v.era <= w.era && !temServico(w, t)).map(([t, v]) => ({ tipo: t, custo: v.custo, manutencao: v.manut })),
    pode_fomentar: Object.entries(NEGOCIOS).filter(([, n]) => n.era <= w.era).map(([t, n]) => ({ tipo: t, custo: n.custo, produz: n.produz })),
    fatos_recentes: w.log.slice(-5).map((l) => l.texto),
  };
}

export const CUSTO_SOLDADO = 6;

// Aplica uma decisão de governo, venha ela de uma IA ou das regras. Tudo é
// validado e limitado aqui: nenhuma resposta malformada quebra a cidade.
export function aplicarGoverno(w, d) {
  const e = w.estado, feito = [];
  if (!e.existe || !d || typeof d !== 'object') return feito;
  const num = (v) => (Number.isFinite(+v) ? +v : 0);
  if (d.imposto !== undefined && d.imposto !== null && Number.isFinite(+d.imposto)) {
    const nova = lim(+d.imposto > 1 ? +d.imposto / 100 : +d.imposto, 0, 0.45);
    if (Math.abs(nova - e.taxa) > 0.004) { e.taxa = nova; feito.push(`imposto em ${Math.round(nova * 100)}%`); }
  }
  if (typeof d.construir === 'string' && SERVICOS[d.construir] && construir(w, d.construir)) feito.push(`constrói ${SERVICOS[d.construir].nome}`);
  const dispensa = Math.min(e.exercito, Math.max(0, Math.round(num(d.dispensar))));
  if (dispensa) { e.exercito -= dispensa; feito.push(`dispensa ${dispensa} soldados`); }
  const teto = Math.floor(populacao(w) * 0.12);
  const recruta = Math.max(0, Math.min(Math.round(num(d.recrutar)), teto - e.exercito, Math.floor(Math.max(0, e.tesouro) / CUSTO_SOLDADO)));
  if (recruta > 0) { e.exercito += recruta; e.tesouro -= recruta * CUSTO_SOLDADO; feito.push(`recruta ${recruta} soldados`); }
  const pesquisa = Math.min(Math.max(0, num(d.pesquisa)), Math.max(0, e.tesouro));
  if (pesquisa >= 1) { e.tesouro -= pesquisa; w.conhecimento += (pesquisa * 0.5) / (w.lentidao || 1); feito.push(`investe ${Math.round(pesquisa)} em pesquisa`); }
  const auxilio = Math.min(Math.max(0, num(d.auxilio)), Math.max(0, e.tesouro));
  if (auxilio >= 1 && w.familias.length) {
    const pobres = [...w.familias].sort((a, b) => a.riqueza - b.riqueza).slice(0, Math.ceil(w.familias.length / 2));
    pobres.forEach((f) => { f.riqueza += auxilio / pobres.length; });
    e.tesouro -= auxilio; e.legitimidade = lim(e.legitimidade + 0.02, 0, 1);
    feito.push(`distribui ${Math.round(auxilio)} em auxílio`);
  }
  const def = NEGOCIOS[d.fomento];
  if (def && def.era <= w.era) {
    const subsidio = def.custo * 0.5;
    const f = [...w.familias].sort((a, b) => b.riqueza - a.riqueza).find((q) => q.riqueza + subsidio >= def.custo * entradaMinima(w));
    if (f && e.tesouro >= subsidio) {
      f.riqueza += subsidio; e.tesouro -= subsidio;
      if (abrirNegocio(w, f, d.fomento)) feito.push(`fomenta uma ${def.nome.toLowerCase()}`);
      else { f.riqueza -= subsidio; e.tesouro += subsidio; }
    }
  }
  if (d.fala) registrar(w, `Governo: “${String(d.fala).slice(0, 220)}”`, 'estado');
  calcularIndicadores(w);
  return feito;
}

// Governante de regras: joga quando não há chave de API, e serve de linha de base.
// O perfil dá um temperamento a cada cidade sem chave, para a disputa ter graça
// mesmo antes de as IAs entrarem.
export const PERFIS = {
  equilibrado: { tropa: 0.04, pesquisa: 0.35, valentia: 1.7, ataque: 0.35 },
  sabio: { tropa: 0.025, pesquisa: 0.6, valentia: 3, ataque: 0.1 },
  guerreiro: { tropa: 0.09, pesquisa: 0.15, valentia: 1.3, ataque: 0.6 },
  mercador: { tropa: 0.035, pesquisa: 0.3, valentia: 2.2, ataque: 0.2, fomenta: true },
};

export function governoPorRegras(w, rivais = [], perfil = 'equilibrado') {
  const P = PERFIS[perfil] || PERFIS.equilibrado;
  const e = w.estado, d = { plano: '', fala: '', construir: 'nada', recrutar: 0, dispensar: 0, pesquisa: 0, auxilio: 0, fomento: 'nenhum', atacar: 'nenhuma' };
  if (!e.existe) return d;
  d.imposto = e.tesouro < 0 ? Math.min(0.24, e.taxa + 0.03) : e.tesouro > (e.gasto || 1) * 30 ? Math.max(P.fomenta ? 0.03 : 0.04, e.taxa - 0.01) : e.taxa;
  const falta = necessidadesDoEstado(w);
  let livre = Math.max(0, e.tesouro);
  const obra = falta.find((t) => SERVICOS[t].custo <= livre);
  if (obra) { d.construir = obra; livre -= SERVICOS[obra].custo; }
  const alvoTropa = Math.floor(populacao(w) * P.tropa);
  if (e.exercito < alvoTropa && livre > 60) { d.recrutar = Math.min(alvoTropa - e.exercito, Math.floor((livre * 0.4) / CUSTO_SOLDADO)); livre -= d.recrutar * CUSTO_SOLDADO; }
  if (P.fomenta && livre > 80) {
    const melhor = Object.entries(NEGOCIOS).filter(([, n]) => n.era <= w.era && n.custo * 0.5 <= livre)
      .sort((x, y) => w.precos[y[1].produz] / BENS[y[1].produz].base - w.precos[x[1].produz] / BENS[x[1].produz].base)[0];
    if (melhor && w.precos[melhor[1].produz] > BENS[melhor[1].produz].base) { d.fomento = melhor[0]; livre -= melhor[1].custo * 0.5; }
  }
  if (!falta.length || livre > 200) { d.pesquisa = Math.round(livre * P.pesquisa); livre -= d.pesquisa; }
  if (livre > (e.gasto || 1) * 24) d.auxilio = Math.round(livre * 0.25);
  const fraco = rivais.filter((r) => r.exercito * P.valentia < e.exercito).sort((a, b) => b.pontos - a.pontos)[0];
  if (fraco && e.exercito >= 12 && rnd(w) < P.ataque) d.atacar = fraco.cidade;
  return d;
}
