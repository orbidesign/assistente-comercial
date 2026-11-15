// Três CEOs, uma padaria: a tela. Ranking de patrimônio sempre à vista, a sala de
// cada CEO em visão macro (movimentos grandes) e micro (cada decisão e o porquê),
// e Campinas em 3D com as unidades de cada marca.
import {
  criarJogo, avancarMes, despachar, dossie, ceoPorRegras, naVez, temTokens, registrarTokens, terminou, vencedor, classificacao, composicao, bensPessoais, valorDaEmpresa, salarioMensal, locaisDe, dataDe, ceo as ceoDe, reais,
  CEOS, NEGOCIOS, ACOES, VALENCIAS, EVENTOS, GOVERNO, CANAIS, TOKENS_JOGO, CAIXA_INICIAL, MESES,
} from './empresas/jogo.js';
import { LOCAIS } from './empresas/campinas.js';
import { criarMapa } from './mapa.js';
import { desenharLinhas, desenharMini } from './graficos.js';

const CHAVE = 'cidade-viva-ceo-v3';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mil = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} mi` : `${Math.round(n / 1000)} mil`);
const NOMES_NEGOCIO = Object.fromEntries(Object.entries(NEGOCIOS).map(([k, v]) => [k, v.nome]));
const ROTULO = { pro_labore: 'Pró-labore (por mês)', distribuir_lucros: 'Distribuir lucros ao dono', aporte_do_dono: 'Aporte do dono na empresa', tomar_emprestimo: 'Tomar empréstimo', amortizar_divida: 'Amortizar dívida', aplicar_renda_fixa: 'Aplicar em renda fixa', resgatar_renda_fixa: 'Resgatar renda fixa', aplicar_bolsa: 'Aplicar na bolsa', resgatar_bolsa: 'Resgatar da bolsa', comprar_imoveis: 'Comprar imóveis', vender_imoveis: 'Vender imóveis', pagar_divida_pessoal: 'Pagar dívida pessoal' };

// ---------- estado ----------
function carregar() { try { const s = JSON.parse(localStorage.getItem(CHAVE)); return s && s.versao === 2 ? s : null; } catch { return null; } }
function novo() { const j = criarJogo((Math.random() * 1e9) | 0); j.jogo = `${j.semente}-${Date.now().toString(36)}`; return j; }
let j = carregar() || novo();
let vista = j.ceos[0].id, velocidade = 0.5, pensando = false, aba = 'painel', mesMicro = null, fim = false;
let mapa = null, metrica = 'p', janela = 0, foco = null, escalaGrafico = null;
let servidor = { provedores: {} };
let ultimoLog = j.log[j.log.length - 1] || null;
// O navegador guarda poucos megabytes: os meses mais antigos ficam só com o
// diário, os números e os movimentos grandes. O registro completo sai em "Exportar".
function salvar() {
  try {
    const leve = { ...j, ceos: j.ceos.map((c) => ({ ...c, sala: c.sala.map((s, i) => (i >= c.sala.length - 60 ? s : { t: s.t, modo: s.modo, tokens: s.tokens, diario: s.diario, notas: s.notas.filter((n) => n.macro), eventos: s.eventos.slice(0, 3), numeros: s.numeros, resumido: true })) })) };
    localStorage.setItem(CHAVE, JSON.stringify(leve));
  } catch { /* sem armazenamento ou sem espaço: segue sem salvar */ }
}

// O mapa mostra onde está cada unidade de cada empresário.
function espelhar() {
  if (!mapa) return;
  mapa.atualizar({ ceos: j.ceos.map((c) => ({ id: c.id, nome: c.nome, cor: CEOS[c.id].cor, fora: !!c.quebrou, unidades: locaisDe(c), pulsos: (c.pulsos || []).filter((p) => j.t - p.t <= 2) })) }, vista, NOMES_NEGOCIO);
}

// ---------- ranking ----------
function estadoDoCEO(c) {
  const p = servidor.provedores[c.id];
  if (c.quebrou) return `fora do jogo desde ${c.quebrou}`;
  if (pensando && c.pensando) return 'despachando…';
  if (c.afastado) return `afastado por ${c.afastado} meses`;
  if (c.recuperacao) return 'empresa em recuperação judicial';
  if (!p || !p.ativo) return `sem chave: regras (${CEOS[c.id].perfil})`;
  if (c.modo === 'semtokens') return 'sem tokens';
  if (c.modo === 'invalida') return 'resposta inválida';
  if (c.modo === 'erro') return `erro: ${c.erro || ''}`;
  return p.modelo;
}

function pintarRanking() {
  const ordem = classificacao(j);
  const alturaLinha = window.innerHeight < 480 ? 34 : window.innerWidth <= 700 ? 40 : 54;
  $('linhas').style.height = `${alturaLinha * j.ceos.length - 4}px`;
  const medalha = ['🥇', '🥈', '🥉'];
  for (const c of j.ceos) {
    let el = document.querySelector(`.lin[data-ceo="${c.id}"]`);
    if (!el) {
      el = document.createElement('button');
      el.className = 'lin'; el.dataset.ceo = c.id;
      el.innerHTML = '<span class="pos"></span><span class="quem"><b></b><small></small></span><canvas></canvas><span class="val"><b></b><small></small></span>';
      $('linhas').appendChild(el);
    }
    const pos = ordem.indexOf(c), h = c.hist, antes = h.length > 12 ? h[h.length - 13].p : h[0].p;
    const delta = antes > 0 ? (c.patrimonio - antes) / antes : 0;
    el.style.transform = `translateY(${pos * alturaLinha}px)`;
    el.classList.toggle('vista', c.id === vista); el.classList.toggle('fora', !!c.quebrou); el.classList.toggle('pensa', pensando && !!c.pensando);
    el.querySelector('.pos').textContent = c.quebrou ? '✖' : medalha[pos];
    el.querySelector('.quem b').textContent = c.nome;
    el.querySelector('.quem small').textContent = estadoDoCEO(c);
    // Minigráfico: o patrimônio nos últimos cinco anos.
    desenharMini(el.querySelector('canvas'), h.slice(-60).map((x) => x.p), CEOS[c.id].cor);
    el.querySelector('.val b').textContent = c.quebrou ? 'R$ 0' : reais(c.patrimonio);
    const s = el.querySelector('.val small');
    s.textContent = c.quebrou ? '' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta * 100).toFixed(0)}% em 12 meses`;
    s.className = delta >= 0 ? 'sobe' : 'desce';
  }
}

// ---------- abas ----------
const porque = (t) => (t ? `<div class="porque">${esc(t)}</div>` : '');
const notas = (l) => l.map((n) => `<div class="nota ${n.ok ? '' : 'nao'}">${esc(n.texto)}</div>`).join('');
const eventos = (l) => l.map((e) => `<div class="ev">${esc(e)}</div>`).join('');
const modoTexto = (m) => ({ ia: 'IA', regras: 'regras (sem chave)', semtokens: 'sem tokens', invalida: 'resposta inválida', erro: 'falha na API', 'sem despacho': 'sem despacho neste mês', afastado: 'afastado', teste: 'teste' }[m] || m);
const numeros = (n) => (n ? `<div class="nums"><span><i>Caixa da empresa</i> <b>${reais(n.caixa_empresa)}</b></span><span><i>Pró-labore</i> <b>${reais(n.pro_labore)}</b></span><span><i>Salário pago</i> <b>${Math.round(n.salario_pago * 100)}% do mercado</b></span><span><i>Equipe</i> <b>${n.funcionarios}</b></span><span><i>Bolso do dono</i> <b>${reais(n.bolso)}</b></span><span><i>Patrimônio</i> <b>${reais(n.patrimonio)}</b></span></div>` : '');
const agendaHtml = (ag) => ag.filter((a) => a.acao || a.aplicado).map((a) => `<tr><td>dia ${a.dia}</td><td style="text-align:left;white-space:normal"><b>${esc(VALENCIAS[a.area].nome.split(' (')[0])}</b>${a.acao ? `: ${esc(a.acao)}` : ''}</td><td>${a.aplicado ? reais(a.aplicado) : a.investimento > 0 ? 'sem caixa' : '—'}</td></tr>`).join('');

// Diário: a leitura do mês. Um cartão por mês, do mais recente para trás.
function abaDiario(c) {
  const cab = `<h3 style="color:${CEOS[c.id].cor}">Diário de ${c.nome} <span class="rot">· ${c.marcaNome}</span></h3>
    <div class="rot" style="margin-bottom:6px">Um cartão por mês: o que o empresário contou, os números e o que aconteceu. Toque em um mês para ver os dias e cada decisão.</div>`;
  const cartoes = c.sala.slice(-36).reverse().map((s) => `<div class="dia" style="border-color:${CEOS[c.id].cor}" data-ir="${s.t}">
    <div class="cab"><b>${dataDe(s.t)}</b><span class="tag">${esc(modoTexto(s.modo))}</span>${s.agenda?.length ? `<span class="rot">${s.agenda.filter((a) => a.acao).length} ações no mês</span>` : ''}</div>
    ${s.diario ? `<div class="fala">${esc(s.diario)}</div>` : ''}${numeros(s.numeros)}${eventos(s.eventos)}${notas(s.notas.filter((n) => n.macro))}</div>`).join('');
  return cab + (cartoes || '<div class="rot">O primeiro mês ainda não fechou.</div>');
}

function abaMacro(c) {
  const cab = `<h3 style="color:${CEOS[c.id].cor}">${c.nome}: os movimentos grandes</h3>
    <div class="rot">Só o que muda o rumo: abrir, fechar, comprar, vender, crédito grande, escândalos, mudança de regime, falência.</div>
    <h4>${c.quebrou ? `Fora do jogo desde ${c.quebrou}` : `Patrimônio hoje: ${reais(c.patrimonio)}`}</h4>
    <div>${c.quebrou ? esc(c.fim) : Object.entries(composicao(j, c)).map(([k, v]) => `${esc(k)}: <b>${reais(v)}</b>`).join(' · ') || '—'}</div>
    <h4>Estratégia declarada</h4><div>${esc(c.estrategia) || '—'}</div>
    <h4>Valências</h4><div>${Object.entries(VALENCIAS).map(([, v]) => `${esc(v.nome.split(' (')[0].split(' e ')[0])} <b>${c[v.campo].toFixed(2)}</b>`).join(' · ')}</div>
    <h4>Linha do tempo</h4>`;
  const blocos = c.sala.filter((s) => s.notas.some((n) => n.macro)).slice(-80).reverse().map((s) => `<div class="anoBloco" style="border-color:${CEOS[c.id].cor}"><b class="a">${dataDe(s.t)}</b> <span class="rot">patrimônio ${s.numeros ? reais(s.numeros.patrimonio) : '—'}</span>
    ${notas(s.notas.filter((n) => n.macro))}${(s.decisao?.movimentos || []).filter((m) => m.justificativa).map((m) => `<div class="rot">Por quê: ${esc(m.justificativa)}</div>`).join('')}
    <button data-ir="${s.t}" style="margin-top:4px;padding:2px 9px">ver o mês inteiro</button></div>`).join('');
  return cab + (blocos || '<div class="rot">Nenhum movimento grande ainda. Tudo começa com uma padaria e R$ 20 mil.</div>');
}

// Micro: um mês inteiro, com a agenda dia a dia e a justificativa de cada decisão.
function abaMicro(c) {
  if (!c.sala.length) return '<div class="rot">O primeiro mês ainda não fechou.</div>';
  let idx = c.sala.findIndex((x) => x.t === mesMicro);
  if (idx < 0) { idx = c.sala.length - 1; mesMicro = c.sala[idx].t; }
  const s = c.sala[idx], d = s.decisao, r = s.resultado;
  const tabela = (titulo, o) => { if (!o) return ''; const ls = Object.entries(o).filter(([k, v]) => ROTULO[k] && Number.isFinite(+v) && v > 0).map(([k, v]) => `<tr><td>${ROTULO[k]}</td><td>${reais(v)}</td></tr>`).join(''); return ls || o.justificativa ? `<h4>${titulo}</h4>${ls ? `<table>${ls}</table>` : ''}${porque(o.justificativa)}` : ''; };
  let h = `<div class="nav"><button data-nav="-1">◀</button><b>${dataDe(s.t)}</b><button data-nav="1">▶</button>
    <input type="range" min="0" max="${c.sala.length - 1}" value="${idx}" id="regua" aria-label="Mês"><button data-nav="fim">hoje</button></div>
    <h3 style="color:${CEOS[c.id].cor}">${c.nome} em ${dataDe(s.t)} <span class="tag">${esc(modoTexto(s.modo))}</span></h3>`;
  if (s.diario) h += `<div class="fala" style="font-size:15px;margin:4px 0">${esc(s.diario)}</div>`;
  h += numeros(s.numeros);
  if (s.eventos.length) h += `<h4>O que aconteceu no mês</h4>${eventos(s.eventos)}`;
  if (s.resumido) h += '<div class="rot" style="margin:6px 0">Mês antigo: o navegador guardou só o resumo. O registro completo fica no arquivo exportado.</div>';
  if (s.agenda?.length) h += `<h4>Agenda: o dia a dia</h4><table>${agendaHtml(s.agenda)}</table>`;
  if (d) {
    if (d.estrategia) h += `<h4>Mudança de estratégia</h4><div>${esc(d.estrategia)}</div>`;
    if (d.respostas.length) h += `<h4>Respostas às pendências</h4>${d.respostas.map((x) => `<div><b>${esc(x.opcao.replace(/_/g, ' '))}</b></div>${porque(x.justificativa)}`).join('')}`;
    const ops = Object.entries(d.operacoes);
    if (ops.length) h += `<h4>Operação de cada negócio</h4>${ops.map(([t, o]) => `<div><b>${esc(NEGOCIOS[t].nome)}</b>: ${[Number.isFinite(+o.preco) && `preço ${(+o.preco).toFixed(2)}`, Number.isFinite(+o.salario) && `salário ${Math.round(o.salario * 100)}% do mercado`, Number.isFinite(+o.func) && `${(+o.func).toFixed(1)} pessoas por unidade`, o.contratar > 0 && `contratar ${o.contratar}`, o.demitir > 0 && `demitir ${o.demitir}`, o.qualidade > 0 && `${reais(o.qualidade)} em qualidade`, o.vendoPor > 0 && `aceita vender por ${reais(o.vendoPor)}`].filter(Boolean).join(' · ') || 'sem mudança'}</div>${porque(o.justificativa)}`).join('')}`;
    if (d.apostas?.length) h += `<h4>Apostas de crescimento (tentativa e erro)</h4>${d.apostas.map((a) => `<div><b>${esc(CANAIS[a.canal])}</b>, mensagem “${esc(a.abordagem)}”, ${reais(a.investimento)}${a.resultado ? ` → ${a.resultado.alcance.toLocaleString('pt-BR')} alcançados, <b>${a.resultado.clientes_novos} clientes novos</b>` : ''}</div>${a.justificativa ? `<div class="porque">${esc(a.justificativa)}</div>` : ''}`).join('')}`;
    if (d.movimentos.length) h += `<h4>Movimentos</h4>${d.movimentos.map((m) => `<div><b>${esc(m.acao.replace(/_/g, ' '))}</b> ${['comprar_anuncio', 'auditar_anuncio'].includes(m.acao) ? `nº ${m.anuncio}${m.oferta ? `, oferta de ${reais(m.oferta)}` : ''}` : ['lancar_franquia', 'vender_empresa'].includes(m.acao) ? '' : `${m.quantidade} × ${esc(NEGOCIOS[m.negocio].nome.toLowerCase())}${m.onde === 'fora' ? ' fora de Campinas' : ''}`}</div>${porque(m.justificativa)}`).join('')}`;
    if (d.gestao.justificativa || d.gestao.seguro !== null) h += `<h4>Seguro e reposição de pessoal</h4><div>${d.gestao.seguro === null ? '' : d.gestao.seguro ? 'Com seguro. ' : 'Sem seguro. '}${d.gestao.reposicao_de_pessoal ? `Reposição ${esc(d.gestao.reposicao_de_pessoal)}.` : ''}</div>${porque(d.gestao.justificativa)}`;
    h += tabela('Finanças da empresa', d.financas) + tabela('O bolso do dono', d.bolso);
    if (d.acoes_externas.length) h += `<h4>Contra os rivais e o Estado</h4>${d.acoes_externas.map((a) => `<div><b>${esc(ACOES[a.tipo].nome)}</b>${a.alvo ? ` → ${esc(a.alvo)}` : ''}${a.recursos ? ` · ${reais(a.recursos)}` : ''} <span class="rot">(${esc(ACOES[a.tipo].lei)})</span></div>${porque(a.justificativa)}`).join('')}`;
    if (d.acao_livre) h += `<h4>Ação livre (registrada, sem efeito nos números)</h4><div>${esc(d.acao_livre)}</div>`;
    if (d.fala) h += `<h4>Fala pública</h4><div>“${esc(d.fala)}”</div>`;
    if (d.memoria) h += `<h4>Nota para si mesmo</h4><div>${esc(d.memoria)}</div>`;
  } else if (!s.resumido) h += '<div class="rot" style="margin:6px 0">Sem despacho neste mês: preço, salários e equipe ficaram como estavam, nada novo foi investido e as pendências foram resolvidas pela primeira opção.</div>';
  if (s.notas.length) h += `<h4>Resultado das decisões</h4>${notas(s.notas)}`;
  if (r) h += `<h4>Contas do mês (${esc(r.regime)})</h4><table>${[['Receita', r.receita], ['Insumos', -r.insumos], ['Salários', -r.salarios], ['Encargos', -r.encargos], ['Aluguéis', -r.alugueis], ['Custos fixos e seguro', -r.custos_fixos], ['Tributos sobre vendas', -r.tributos_sobre_vendas], ['Juros', -r.juros], ['Pró-labore do dono', -r.pro_labore], ['Imposto sobre o lucro', -r.imposto_sobre_lucro]].filter(([, v]) => Math.abs(v) >= 1).map(([k, v]) => `<tr><td>${k}</td><td>${reais(v)}</td></tr>`).join('')}
    <tr><th>Lucro do mês</th><th>${reais(r.lucro_liquido)}</th></tr></table>
    <h4>O bolso no mês</h4><table><tr><td>Pró-labore líquido</td><td>${reais(r.bolso.pro_labore_liquido)}</td></tr><tr><td>Custo de vida</td><td>${reais(-r.bolso.custo_de_vida)}</td></tr><tr><td>Rendimentos</td><td>${reais(r.bolso.rendimentos)}</td></tr></table>`;
  if (s.tokens) h += `<div class="rot" style="margin-top:6px">Este despacho custou ${s.tokens.toLocaleString('pt-BR')} tokens.</div>`;
  return h;
}

function abaComparar() {
  const cs = j.ceos, f = (fn) => cs.map((c) => `<td>${c.quebrou ? '—' : fn(c)}</td>`).join('');
  const op = (c, t) => { const o = c.ops[t]; return o && o.unidades + o.fora ? `${o.unidades}${o.fora ? `+${o.fora}` : ''}` : '·'; };
  const pri = (c) => Object.values(c.ops).filter((o) => o.unidades + o.fora > 0).sort((a, b) => b.receita - a.receita)[0];
  const linhas = [
    ['Patrimônio', (c) => `<b>${reais(c.patrimonio)}</b>`], ['Bolso do dono', (c) => reais(bensPessoais(c))], ['Empresa vale', (c) => reais(valorDaEmpresa(j, c))],
    ['Caixa da empresa', (c) => reais(c.caixa)], ['Dívida da empresa', (c) => reais(c.divida)], ['Pró-labore', (c) => reais(c.proLabore)],
    ['Receita no mês', (c) => reais(c.receita)], ['Lucro no mês', (c) => reais(c.lucro)], ['Regime', (c) => c.regime], ['Funcionários', (c) => Math.round(c.funcionarios).toLocaleString('pt-BR')],
    ...Object.entries(NEGOCIOS).filter(([t]) => cs.some((c) => c.ops[t] && c.ops[t].unidades + c.ops[t].fora)).map(([t, d]) => [`${d.nome} (em Campinas + fora)`, (c) => op(c, t)]),
    ['Franqueados', (c) => c.franqueados || '·'], ['Preço (negócio principal)', (c) => pri(c)?.preco.toFixed(2) ?? '·'], ['Salário pago', (c) => (pri(c) ? `${Math.round(pri(c).salario * 100)}%` : '·')], ['Seguro', (c) => (c.seguro ? 'sim' : 'não')],
    ...Object.entries(VALENCIAS).map(([, v]) => [v.nome, (c) => c[v.campo].toFixed(2)]),
    ['Reputação', (c) => c.reputacao.toFixed(2)], ['Falências da empresa', (c) => c.falencias], ['Ilícitos tentados / descobertos', (c) => `${c.ilicitos} / ${c.flagrantes}`],
  ];
  return `<table><tr><th></th>${cs.map((c) => `<th style="color:${CEOS[c.id].cor}">${c.nome}</th>`).join('')}</tr>
    ${linhas.map(([k, fn]) => `<tr><td>${k}</td>${f(fn)}</tr>`).join('')}
    <tr><td>Tokens usados (de ${mil(TOKENS_JOGO)})</td>${cs.map((c) => `<td>${mil(c.tokens)}</td>`).join('')}</tr>
    <tr><td>Despachos pagos / respostas inválidas</td>${cs.map((c) => `<td>${c.chamadas} / ${c.invalidas}</td>`).join('')}</tr></table>
    <div class="rot" style="margin-top:6px">Governo federal: ${j.politica.federal.lado} · Prefeitura: ${j.politica.municipal.lado} · Campinas: ${Math.round(j.cidade.pop).toLocaleString('pt-BR')} habitantes · salário de mercado ${reais(salarioMensal(j))} · trigo ${j.trigo.toFixed(2)} · juros ${(j.juros * 100).toFixed(1)}% ao ano</div>`;
}

// ---------- painel: a evolução de cada um, em gráficos que se leem com o dedo ----------
const METRICAS = {
  p: { nome: 'Patrimônio', log: true }, cx: { nome: 'Caixa da empresa' }, bol: { nome: 'Bolso do dono', log: true }, emp: { nome: 'Valor da empresa', log: true },
  rec: { nome: 'Receita do mês', log: true }, luc: { nome: 'Lucro do mês' }, dv: { nome: 'Dívida da empresa' }, pl: { nome: 'Pró-labore' },
  un: { nome: 'Unidades', moeda: false }, fun: { nome: 'Funcionários', moeda: false },
};
const JANELAS = [[12, '1 ano'], [60, '5 anos'], [240, '20 anos'], [0, 'tudo']];
const valor = (k, v) => (METRICAS[k].moeda === false ? Math.round(v).toLocaleString('pt-BR') : reais(v));
const variacao = (h, k, meses = 12) => { const a = h[Math.max(0, h.length - 1 - meses)][k], b = h[h.length - 1][k]; return Math.abs(a) > 1 ? (b - a) / Math.abs(a) : 0; };

function abaPainel(c) {
  const h = c.hist, ult = h[h.length - 1];
  const cartao = (k) => { const d = variacao(h, k); return `<button class="cartao ${k === metrica ? 'ativo' : ''}" data-metrica="${k}"><small>${METRICAS[k].nome}</small><b>${valor(k, ult[k])}</b><em class="${d >= 0 ? 'sobe' : 'desce'}">${d >= 0 ? '▲' : '▼'}${Math.abs(d * 100).toFixed(0)}%</em><canvas data-mini="${k}"></canvas></button>`; };
  return `<div class="fichas">${Object.entries(METRICAS).map(([k, m]) => `<button data-metrica="${k}" class="${k === metrica ? 'ativo' : ''}">${m.nome}</button>`).join('')}</div>
    <canvas id="grafico"></canvas>
    <div id="leitura"></div>
    <div class="fichas" style="margin-top:2px">${JANELAS.map(([n, t]) => `<button data-janela="${n}" class="${n === janela ? 'ativo' : ''}">${t}</button>`).join('')}<button data-ir-foco style="margin-left:auto">abrir este mês</button></div>
    <h4 style="color:${CEOS[c.id].cor}">${c.nome} agora <span class="rot" style="text-transform:none;letter-spacing:0">· toque em um cartão para ver no gráfico · variação em 12 meses</span></h4>
    <div class="cartoes">${Object.keys(METRICAS).map(cartao).join('')}</div>
    <h4>Valências: onde cada um ficou forte</h4>
    <div class="barras">${Object.values(VALENCIAS).map((v) => `<span>${esc(v.nome.split(' (')[0].split(' e ')[0])}</span><span class="tr">${j.ceos.map((x) => `<i style="width:${x[v.campo] * 100}%;background:${CEOS[x.id].cor}" title="${x.nome}: ${x[v.campo].toFixed(2)}"></i>`).join('')}</span>`).join('')}</div>
    <h4>De onde vem o patrimônio de ${c.nome}</h4>
    <div>${c.quebrou ? esc(c.fim) : Object.entries(composicao(j, c)).map(([k, v]) => `${esc(k)}: <b>${reais(v)}</b>`).join(' · ') || '—'}</div>`;
}

function desenharPainel() {
  const cv = $('grafico');
  if (!cv) return;
  const ateT = j.t, deT = janela ? Math.max(0, ateT - janela) : 0;
  const series = j.ceos.map((c) => ({ cor: CEOS[c.id].cor, fino: c.id !== vista, pontos: c.hist.map((x) => ({ t: x.t, v: x[metrica] })) }));
  escalaGrafico = desenharLinhas(cv, series, { log: METRICAS[metrica].log, foco, moeda: METRICAS[metrica].moeda, deT, ateT });
  const t = foco ?? ateT;
  $('leitura').innerHTML = `<span class="quando">${dataDe(t)}</span>` + j.ceos.map((c) => { const x = c.hist.find((q) => q.t === t) || c.hist[c.hist.length - 1]; return `<span><i style="background:${CEOS[c.id].cor}"></i>${c.nome} <b>${valor(metrica, x[metrica])}</b></span>`; }).join('') + (escalaGrafico?.log ? '<span class="rot">escala logarítmica</span>' : '');
  const c = ceoDe(j, vista);
  document.querySelectorAll('[data-mini]').forEach((el) => desenharMini(el, c.hist.slice(-36).map((x) => x[el.dataset.mini]), CEOS[c.id].cor));
}

function abaRegras() {
  return `<h3>Como funciona</h3>
    Claude, Grok e Gemini começam <b>exatamente iguais</b> em janeiro de 2026: uma padaria de bairro em Campinas, 8 funcionários e ${reais(CAIXA_INICIAL)} no caixa da empresa. O jogo anda <b>mês a mês</b> por <b>50 anos</b>, até dezembro de 2075, e sempre vai até o fim. Vence o <b>maior patrimônio pessoal</b>: o que está no nome do dono mais o valor da empresa. Fracassar ou estagnar são desfechos possíveis.<br><br>
    <b>Sem manual.</b> As IAs não recebem as fórmulas nem dicas do que funciona. Recebem as leis, os preços de mercado, os números do mês e o retorno do que tentaram. O que rende em cada canal de divulgação, o que há por trás de cada negócio anunciado e quanto um comprador paga pela empresa só se descobre tentando.<br><br>
    <b>Todo mês</b> cada empresário recebe um relatório e despacha: conta como foi o mês, entrega a <b>agenda dia a dia</b> (cada ação com data, área e dinheiro), responde ao que aconteceu e decide preço, salários, contratações, pró-labore, crédito, expansão e o que faz com o próprio dinheiro. Tudo fica registrado com a justificativa.<br><br>
    <b>Empresa e bolso são separados.</b> O dono vive do pró-labore; pode distribuir lucro ou pôr dinheiro seu na empresa. Se a empresa quebra, ele fica com o que tem no nome e pode recomeçar.<br><br>
    <b>Batalha justa.</b> Mesma cidade, mesmos eventos e <b>os mesmos sorteios</b> para os três: o que muda é o quanto cada um se preparou. Mesmo texto de regras, mesmo tipo de relatório, despachos simultâneos e a mesma verba de <b>${mil(TOKENS_JOGO)} de tokens</b>.
    <h4>Canais de divulgação (o efeito é oculto e muda com o negócio, a mensagem e a época)</h4><div>${Object.values(CANAIS).map(esc).join(' · ')}</div>
    <h4>Negócios à venda agora</h4>${(j.anuncios || []).map((a) => `<div>nº ${a.id}: <b>${esc(NEGOCIOS[a.tipo].nome)}</b> em ${esc(LOCAIS[a.local].nome)}, pedem ${reais(a.pede)}, dizem faturar ${reais(a.declarada)} por mês (${esc(a.motivo)}). <span class="rot">Só você vê: fatura de verdade ${reais(a.receitaReal)}, aceita ${reais(a.minimo)}, conta escondida ${reais(a.passivo)}.</span></div>`).join('') || '<div class="rot">nenhum anúncio no momento</div>'}
    <h4>Valências da empresa (todas começam iguais; isto as IAs não leem)</h4>${Object.values(VALENCIAS).map((v) => `<div><b>${esc(v.nome)}</b>: ${esc(v.efeito)}.</div>`).join('')}
    <h4>O acaso do dia a dia</h4><table>${Object.values(EVENTOS).map((e) => `<tr><td><b>${esc(e.nome)}</b><br>${esc(e.texto)}</td><td>${e.chance < 1 ? `${(e.chance * 100).toFixed(1).replace('.0', '')}% ao mês<br>por ${esc(e.base)}` : esc(e.base)}</td></tr>`).join('')}</table>
    <h4>Quem governa muda o jogo</h4>
    <div><b>Federal, esquerda:</b> ${esc(GOVERNO.federal.esquerda.texto)}.</div><div><b>Federal, direita:</b> ${esc(GOVERNO.federal.direita.texto)}.</div>
    <div><b>Prefeitura, esquerda:</b> ${esc(GOVERNO.municipal.esquerda.texto)}.</div><div><b>Prefeitura, direita:</b> ${esc(GOVERNO.municipal.direita.texto)}.</div>
    <h4>Sem chave de API</h4>O empresário é tocado por regras com um perfil fixo (padeiro, expansionista, diversificador). Serve de demonstração e não diz nada sobre o modelo de verdade.<br><br>
    <button id="exportar">⬇ Exportar o registro completo</button> <button id="novo">🌱 Novo jogo</button> &nbsp; <a href="./">Modo narrador</a> · <a href="arena.html">Arena medieval</a>`;
}

function pintarAba() {
  const c = ceoDe(j, vista), el = $('conteudo');
  const rolagem = el.scrollTop;
  if (aba === 'painel') { el.innerHTML = abaPainel(c); desenharPainel(); }
  else if (aba === 'diario') el.innerHTML = abaDiario(c);
  else if (aba === 'macro') el.innerHTML = abaMacro(c);
  else if (aba === 'micro') el.innerHTML = abaMicro(c);
  else if (aba === 'comparar') el.innerHTML = abaComparar();
  else if (aba === 'cronica') el.innerHTML = j.log.slice(-120).reverse().map((l) => `<div class="anoBloco" style="border-color:${l.de ? CEOS[l.de].cor : '#d9a13a'};margin-bottom:6px"><span class="rot">${dataDe(l.t)}</span> ${esc(l.texto)}</div>`).join('') || '<div class="rot">Nada ainda.</div>';
  else {
    el.innerHTML = abaRegras();
    $('novo').onclick = () => { if (confirm('Encerrar este jogo e começar outro do zero?')) { localStorage.removeItem(CHAVE); window.removeEventListener('pagehide', salvar); location.reload(); } };
    $('exportar').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(j)], { type: 'application/json' })); a.download = `tres-ceos-${dataDe(j.t).replace('/', '-')}.json`; a.click(); };
  }
  el.scrollTop = rolagem;
}

function pintar(tudo = true) {
  $('ano').textContent = dataDe(j.t);
  $('quando').textContent = `Campinas · federal: ${j.politica.federal.lado} · prefeitura: ${j.politica.municipal.lado} · faltam ${Math.ceil((MESES - j.t) / 12)} anos`;
  document.querySelectorAll('#velocidade button').forEach((b) => b.classList.toggle('ativo', +b.dataset.v === velocidade));
  document.querySelectorAll('#abas [data-aba]').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
  pintarRanking();
  // A aba Micro só é redesenhada quando o usuário pede, para não atrapalhar a leitura.
  if (tudo && !$('baixo').classList.contains('recolhido') && aba !== 'micro' && aba !== 'regras') { if (aba === 'painel' && $('grafico') && foco === null) atualizarPainel(); else if (aba !== 'painel') pintarAba(); }
}

// No painel, a cada mês só os números e o desenho mudam; a estrutura fica, para não perder a rolagem nem o toque.
function atualizarPainel() {
  const c = ceoDe(j, vista), ult = c.hist[c.hist.length - 1];
  document.querySelectorAll('.cartao').forEach((el) => { const k = el.dataset.metrica, d = variacao(c.hist, k); el.querySelector('b').textContent = valor(k, ult[k]); const em = el.querySelector('em'); em.textContent = `${d >= 0 ? '▲' : '▼'}${Math.abs(d * 100).toFixed(0)}%`; em.className = d >= 0 ? 'sobe' : 'desce'; });
  desenharPainel();
}
function verCEO(id) { vista = id; pintar(false); pintarAba(); espelhar(); }
$('linhas').addEventListener('click', (e) => { const b = e.target.closest('[data-ceo]'); if (b) verCEO(b.dataset.ceo); });
$('vistas').addEventListener('click', (e) => { const b = e.target.closest('[data-vista]'); if (!b || !mapa) return; if (b.dataset.vista === 'enquadrar') mapa.enquadrar(locaisDe(ceoDe(j, vista)).map((u) => u.local)); else mapa.ver(b.dataset.vista); });
$('velocidade').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { velocidade = +b.dataset.v; pintar(false); } });
$('abas').addEventListener('click', (e) => { const b = e.target.closest('[data-aba]'); if (b) { aba = b.dataset.aba; if (aba === 'micro') mesMicro = null; $('baixo').classList.remove('recolhido'); document.body.classList.remove('recolhido'); $('recolher').textContent = '▾'; $('conteudo').scrollTop = 0; pintar(false); pintarAba(); } });
$('recolher').addEventListener('click', () => { const r = $('baixo').classList.toggle('recolhido'); document.body.classList.toggle('recolhido', r); $('recolher').textContent = r ? '▴' : '▾'; if (!r) pintarAba(); });
// Leitura do gráfico: passar o dedo ou o mouse mostra os três valores daquele mês.
function lerGrafico(e) {
  if (e.target.id !== 'grafico' || !escalaGrafico) return;
  const r = e.target.getBoundingClientRect();
  foco = Math.min(j.t, escalaGrafico.mesEm(e.clientX - r.left));
  desenharPainel();
}
$('conteudo').addEventListener('pointerdown', lerGrafico);
$('conteudo').addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) lerGrafico(e); });
$('conteudo').addEventListener('pointerleave', () => { if (foco !== null && aba === 'painel') { foco = null; desenharPainel(); } });
$('conteudo').addEventListener('click', (e) => {
  const met = e.target.closest('[data-metrica]'), jan = e.target.closest('[data-janela]');
  if (met) { metrica = met.dataset.metrica; foco = null; pintarAba(); return; }
  if (jan) { janela = +jan.dataset.janela; foco = null; pintarAba(); return; }
  if (e.target.closest('[data-ir-foco]')) { const sala = ceoDe(j, vista).sala; if (!sala.length) return; aba = 'micro'; mesMicro = Math.min(sala[sala.length - 1].t, Math.max(0, (foco ?? j.t) - 1)); foco = null; $('conteudo').scrollTop = 0; pintar(false); pintarAba(); return; }
  const ir = e.target.closest('[data-ir]'), nav = e.target.closest('[data-nav]');
  const sala = ceoDe(j, vista).sala;
  if (nav) { const i = sala.findIndex((s) => s.t === mesMicro); mesMicro = nav.dataset.nav === 'fim' ? sala[sala.length - 1].t : sala[Math.min(sala.length - 1, Math.max(0, i + +nav.dataset.nav))].t; pintarAba(); }
  else if (ir) { aba = 'micro'; mesMicro = +ir.dataset.ir; $('conteudo').scrollTop = 0; pintar(false); pintarAba(); }
});
$('conteudo').addEventListener('input', (e) => { if (e.target.id === 'regua') { mesMicro = ceoDe(j, vista).sala[+e.target.value].t; pintarAba(); } });
if (window.innerHeight < 480) $('recolher').click();

function toast(texto, cor) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = texto;
  if (cor) el.style.borderColor = cor;
  $('toasts').appendChild(el);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => el.remove(), 6800);
}
function faixa(topo, texto) { $('faixa-topo').textContent = topo; $('faixa-texto').textContent = texto; $('faixa').classList.add('visivel'); setTimeout(() => $('faixa').classList.remove('visivel'), 5200); }

function novidades() {
  const ultimo = j.log[j.log.length - 1] || null;
  if (ultimo === ultimoLog) return;
  const novos = j.log.slice(j.log.indexOf(ultimoLog) + 1);
  ultimoLog = ultimo;
  for (const l of novos.filter((x) => x.tipo !== 'fala' || velocidade <= 0.5).slice(-3)) {
    toast(`${dataDe(l.t)}: ${l.texto}`, l.de ? CEOS[l.de].cor : '#d9a13a');
    if (l.tipo === 'era' && l.de) faixa(CEOS[l.de].nome, l.texto.replace(/^\S+ /, ''));
    if (l.tipo === 'lei' && l.texto.startsWith('Eleição')) faixa('Eleições', l.texto.replace(/^Eleição /, ''));
  }
}

// ---------- o mês: os três despacham ao mesmo tempo, depois o mês fecha ----------
async function pedir(c) {
  const r = await fetch('/api/arena/decidir-ceo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jogo: j.jogo, provedor: c.id, situacao: dossie(j, c) }) });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro || `erro ${r.status}`);
  return dados;
}

async function mes() {
  pensando = true;
  const respostas = await Promise.all(j.ceos.map(async (c) => {
    c.pensando = false; c.erro = '';
    if (!naVez(j, c)) return null;
    if (!servidor.provedores[c.id]?.ativo) return { modo: 'regras', d: ceoPorRegras(j, c, CEOS[c.id].perfil) };
    if (!temTokens(c)) return { modo: 'semtokens' };
    c.pensando = true;
    $('pensando').classList.add('visivel');
    pintarRanking();
    try {
      const r = await pedir(c);
      registrarTokens(c, r.tokens, r.custo);
      if (r.invalida) { c.invalidas++; return { modo: 'invalida', tokens: r.tokens }; }
      return { modo: 'ia', d: r.decisao, tokens: r.tokens };
    } catch (e) { c.erro = e.message.slice(0, 80); return { modo: 'erro' }; }
  }));
  respostas.forEach((r, i) => { const c = j.ceos[i]; c.pensando = false; if (r) { c.modo = r.modo; despachar(j, c, r.d || null, r.modo, r.tokens || 0); } });
  avancarMes(j);
  pensando = false;
  $('pensando').classList.remove('visivel');
  if (j.t % 12 === 0 || velocidade < 2) salvar();
  espelhar();
  novidades();
  pintar(velocidade < 12 || j.t % 3 === 0);
  if (terminou(j) && !fim) {
    fim = true; salvar();
    const v = vencedor(j);
    faixa(v.ceo ? 'Maior patrimônio em dezembro de 2075' : 'Fim', v.ceo ? `${v.ceo.nome} vence com ${reais(v.ceo.patrimonio)}` : 'Todos quebraram');
  }
}

// ---------- relógio ----------
let acumulado = 0, antes = performance.now();
function tique() {
  const agora = performance.now(), dt = Math.min(0.25, (agora - antes) / 1000);
  antes = agora;
  if (velocidade > 0 && !pensando && !terminou(j)) {
    acumulado += dt * velocidade;
    if (acumulado >= 1) { acumulado = Math.min(acumulado - 1, 1); mes(); }
  }
  requestAnimationFrame(tique);
}

window.jogoCEO = {
  estado: () => j,
  avancar(meses) { for (let i = 0; i < meses && !terminou(j); i++) { for (const c of j.ceos) if (naVez(j, c)) despachar(j, c, ceoPorRegras(j, c, CEOS[c.id].perfil), 'regras'); avancarMes(j); } espelhar(); pintar(); pintarAba(); },
  pensando: () => pensando,
};

fim = terminou(j);
pintar();
pintarAba();
fetch('/api/arena/status').then((r) => r.json()).catch(() => servidor).then(async (s) => {
  servidor = s;
  mapa = await criarMapa($('mapa'), s.googleMaps, verCEO);
  $('fonte').textContent = `mapa: ${mapa.tipo}`;
  espelhar();
  pintar();
});
window.addEventListener('resize', () => { if (mapa) mapa.redimensionar(); if (aba === 'painel') desenharPainel(); pintarRanking(); });
window.addEventListener('pagehide', salvar);
document.addEventListener('visibilitychange', () => { if (document.hidden) salvar(); });
tique();
