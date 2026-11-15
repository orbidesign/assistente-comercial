// Três CEOs, uma padaria: a tela. Ranking de patrimônio sempre à vista, a sala de
// cada CEO em visão macro (movimentos grandes) e micro (cada decisão e o porquê),
// e Campinas em 3D com as unidades de cada marca.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { altura, NIVEL_AGUA } from './sim/geo.js';
import {
  criarJogo, avancarJogo, despachar, dossie, ceoPorRegras, naVez, temTokens, registrarTokens, terminou, vencedor, classificacao, composicao, ceo as ceoDe, reais,
  CEOS, NEGOCIOS, ACOES, TOKENS_SECULO, CAIXA_INICIAL,
} from './empresas/jogo.js';
import { ANO_FINAL } from './brasil/municipio.js';
import { cidadeDosCEOs } from './brasil/visual.js';
import { criarMundo3D } from './render/mundo.js';
import { criarCidade, criarMoradores } from './render/cidade.js';
import { criarPredioBR, criarPracaBR } from './render/predios-br.js';
import { criarFX } from './render/fx.js';

const CHAVE = 'cidade-viva-ceo-v1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mil = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} mi` : `${Math.round(n / 1000)} mil`);
const CORES3D = Object.fromEntries(Object.entries(CEOS).map(([id, c]) => [id, parseInt(c.cor.slice(1), 16)]));
const ROTULO = { marketing: 'Marketing', tecnologia: 'Tecnologia', gestao: 'Gestão', treinamento: 'Treinamento', compliance: 'Compliance', tomar_emprestimo: 'Tomar empréstimo', amortizar_divida: 'Amortizar dívida', aplicar_renda_fixa: 'Aplicar em renda fixa', resgatar_renda_fixa: 'Resgatar renda fixa', aplicar_bolsa: 'Aplicar na bolsa', resgatar_bolsa: 'Resgatar da bolsa', comprar_imoveis: 'Comprar imóveis', vender_imoveis: 'Vender imóveis' };

// ---------- cena ----------
const toque = matchMedia('(pointer: coarse)').matches;
const leve = toque || Math.min(window.innerWidth, window.innerHeight) < 700;
const qualidade = { ...(leve ? { arvores: 1000, tufos: 2500, sombra: 1024, particulas: 600 } : { arvores: 1600, tufos: 6000, sombra: 2048, particulas: 1200 }), semNeve: true };
const pixelBase = Math.min(window.devicePixelRatio || 1, leve ? 1.75 : 2);
let escala = 1;
const canvas = $('cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !leve || pixelBase < 1.5, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelBase);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = leve ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 1400);
camera.position.set(42, 40, 58);
const controles = new OrbitControls(camera, canvas);
Object.assign(controles, { enableDamping: true, dampingFactor: 0.08, minDistance: 7, maxDistance: 185, maxPolarAngle: 1.5, autoRotate: true, autoRotateSpeed: 0.3 });
controles.target.set(0, 2, 0);
function ajustar() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 0.8 ? 62 : 48;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', ajustar);
window.addEventListener('orientationchange', () => setTimeout(ajustar, 200));
ajustar();
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());
canvas.addEventListener('pointerdown', () => { controles.autoRotate = false; });

const mundo3d = criarMundo3D(scene, qualidade);
const cidade3d = criarCidade(scene, mundo3d, { listar: (v) => v.specs, fabricar: criarPredioBR, praca: criarPracaBR });
const moradores = criarMoradores(scene);
const fx = criarFX(scene);

// ---------- estado ----------
function carregar() { try { const s = JSON.parse(localStorage.getItem(CHAVE)); return s && s.versao === 1 ? s : null; } catch { return null; } }
function novo() { const j = criarJogo((Math.random() * 1e9) | 0); j.jogo = `${j.semente}-${Date.now().toString(36)}`; return j; }
let j = carregar() || novo();
let vista = j.ceos[0].id, velocidade = 0.3, acumulado = 0, tempo = 0, pensando = false, aba = 'macro', anoMicro = null, fim = false;
let servidor = { provedores: {} };
let ultimoLog = j.log[j.log.length - 1] || null;
const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(j)); } catch { /* sem armazenamento */ } };

function espelhar(imediato = false) {
  const v = cidadeDosCEOs(j, CORES3D);
  const novos = cidade3d.sincronizar(v, tempo, imediato);
  moradores.sincronizar(v.mundo, cidade3d.posicoes());
  fx.sincronizarLampioes({ era: 2 }, cidade3d.posicoes());
  if (!imediato) for (const s of novos.filter((x) => x.dono).slice(0, 5)) fx.poeira(s.pos.x, s.pos.z);
}

// ---------- ranking ----------
function estadoDoCEO(c) {
  const p = servidor.provedores[c.id];
  if (c.quebrou) return `quebrou em ${c.quebrou}`;
  if (pensando && c.pensando) return 'decidindo…';
  if (c.afastado) return `afastado por ${c.afastado} anos`;
  if (c.recuperacao) return 'em recuperação judicial';
  if (!p || !p.ativo) return `sem chave: regras (${CEOS[c.id].perfil})`;
  if (c.modo === 'semtokens') return 'sem tokens';
  if (c.modo === 'invalida') return 'resposta inválida';
  if (c.modo === 'erro') return `erro: ${c.erro || ''}`;
  return p.modelo;
}

function pintarRanking() {
  const ordem = classificacao(j);
  const maior = Math.max(...j.ceos.map((c) => c.patrimonio), 1);
  const alturaLinha = window.innerHeight < 480 ? 34 : 50;
  $('linhas').style.height = `${alturaLinha * j.ceos.length - 4}px`;
  const medalha = ['🥇', '🥈', '🥉'];
  for (const c of j.ceos) {
    let el = document.querySelector(`.lin[data-ceo="${c.id}"]`);
    if (!el) {
      el = document.createElement('button');
      el.className = 'lin'; el.dataset.ceo = c.id;
      el.innerHTML = '<span class="pos"></span><span class="quem"><b></b><small></small></span><span class="barra"><i></i></span><span class="val"><b></b><small></small></span>';
      el.querySelector('.barra i').style.background = CEOS[c.id].cor;
      $('linhas').appendChild(el);
    }
    const pos = ordem.indexOf(c), h = c.hist, antes = h.length > 1 ? h[h.length - 2].patrimonio : c.patrimonio;
    const delta = antes > 0 ? (c.patrimonio - antes) / antes : 0;
    el.style.transform = `translateY(${pos * alturaLinha}px)`;
    el.classList.toggle('vista', c.id === vista); el.classList.toggle('fora', !!c.quebrou); el.classList.toggle('pensa', pensando && !!c.pensando);
    el.querySelector('.pos').textContent = c.quebrou ? '✖' : medalha[pos];
    el.querySelector('.quem b').textContent = c.nome;
    el.querySelector('.quem small').textContent = estadoDoCEO(c);
    // Barra em escala logarítmica: de R$ 100 mil até o maior patrimônio do jogo.
    const fr = c.quebrou ? 0 : Math.max(0.03, Math.log10(Math.max(1e5, c.patrimonio) / 1e5) / Math.max(1, Math.log10(Math.max(1e6, maior) / 1e5)));
    el.querySelector('.barra i').style.width = `${Math.min(100, fr * 100)}%`;
    el.querySelector('.val b').textContent = c.quebrou ? 'R$ 0' : reais(c.patrimonio);
    const s = el.querySelector('.val small');
    s.textContent = c.quebrou ? '' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta * 100).toFixed(0)}% no ano`;
    s.className = delta >= 0 ? 'sobe' : 'desce';
  }
}

// ---------- abas ----------
const porque = (t) => (t ? `<div class="porque">${esc(t)}</div>` : '');
const notas = (l) => l.map((n) => `<div class="nota ${n.ok ? '' : 'nao'}">${esc(n.texto)}</div>`).join('');
const modoTexto = (m) => ({ ia: 'decisão da IA', regras: 'regras (sem chave)', semtokens: 'sem tokens: nada mudou', invalida: 'resposta inválida: nada mudou', erro: 'falha na API: nada mudou', 'sem reunião': 'ano sem reunião', afastado: 'afastado', teste: 'teste' }[m] || m);

function abaMacro(c) {
  const cab = `<h3 style="color:${CEOS[c.id].cor}">${c.nome}: os movimentos grandes</h3>
    <div class="rot">Só o que muda o rumo: abrir, fechar, comprar, vender, crédito grande, escândalos, mudança de regime. O detalhe de cada ano está em Micro.</div>
    <h4>${c.quebrou ? `Quebrou em ${c.quebrou}` : `Patrimônio hoje: ${reais(c.patrimonio)}`}</h4>
    <div>${c.quebrou ? esc(c.fim) : Object.entries(composicao(j, c)).map(([k, v]) => `${esc((NEGOCIOS[k]?.nome || k).replace(/_/g, ' '))}: <b>${reais(v)}</b>`).join(' · ') || '—'}</div>
    <h4>Linha do tempo</h4>`;
  let ultimaEstrategia = '';
  const blocos = [];
  for (const s of c.sala) {
    const grandes = s.notas.filter((n) => n.macro);
    const estrategia = s.decisao?.estrategia || '';
    const mudou = estrategia && estrategia !== ultimaEstrategia;
    if (!grandes.length && !(mudou && s.decisao?.movimentos?.length)) { if (estrategia) ultimaEstrategia = estrategia; continue; }
    blocos.push(`<div class="anoBloco" style="border-color:${CEOS[c.id].cor}"><b class="a">${s.ano}</b> <span class="rot">patrimônio ${s.resultado ? reais(s.resultado.patrimonio) : '—'}</span>
      ${mudou ? porque(estrategia) : ''}${notas(grandes)}
      ${(s.decisao?.movimentos || []).filter((m) => m.justificativa).map((m) => `<div class="rot">Por que ${esc(m.acao)} ${esc((NEGOCIOS[m.negocio]?.nome || '').toLowerCase())}: ${esc(m.justificativa)}</div>`).join('')}
      <button data-ir="${s.ano}" style="margin-top:4px;padding:2px 9px">ver o ano inteiro</button></div>`);
    if (estrategia) ultimaEstrategia = estrategia;
  }
  return cab + (blocos.reverse().join('') || '<div class="rot">Nenhum movimento grande ainda. Tudo começa com uma padaria e R$ 20 mil.</div>');
}

function abaMicro(c) {
  const anos = c.sala.map((s) => s.ano);
  if (!anos.length) return '<div class="rot">O primeiro ano ainda não fechou.</div>';
  if (anoMicro === null || !anos.includes(anoMicro)) anoMicro = anos[anos.length - 1];
  const s = c.sala.find((x) => x.ano === anoMicro), d = s.decisao, r = s.resultado;
  const linha = (rot, v) => (v ? `<tr><td>${rot}</td><td>${reais(v)}</td></tr>` : '');
  let h = `<div class="nav"><button data-nav="-1">◀</button><b>${s.ano}</b><button data-nav="1">▶</button>
    <input type="range" min="0" max="${anos.length - 1}" value="${anos.indexOf(anoMicro)}" id="regua" aria-label="Ano"><button data-nav="fim">hoje</button></div>
    <h3 style="color:${CEOS[c.id].cor}">${c.nome} em ${s.ano} <span class="tag">${esc(modoTexto(s.modo))}</span></h3>`;
  if (d) {
    h += `<h4>Diagnóstico</h4><div>${esc(d.diagnostico) || '—'}</div><h4>Estratégia</h4><div>${esc(d.estrategia) || '—'}</div>`;
    if (d.movimentos.length) h += `<h4>Movimentos</h4>${d.movimentos.map((m) => `<div><b>${esc(m.acao.replace(/_/g, ' '))}</b> ${m.acao === 'lancar_franquia' ? '' : `${m.quantidade} × ${esc(NEGOCIOS[m.negocio].nome.toLowerCase())}${m.onde === 'fora' ? ' fora de Campinas' : ''}`}</div>${porque(m.justificativa)}`).join('')}`;
    const ops = Object.entries(d.operacoes);
    if (ops.length) h += `<h4>Operação de cada negócio</h4>${ops.map(([t, o]) => `<div><b>${esc(NEGOCIOS[t].nome)}</b>: ${[Number.isFinite(+o.preco) && `preço ${(+o.preco).toFixed(2)}`, Number.isFinite(+o.salario) && `salário ${Math.round(o.salario * 100)}% do mercado`, Number.isFinite(+o.func) && `${(+o.func).toFixed(1)} pessoas por unidade`, o.qualidade > 0 && `${reais(o.qualidade)} em qualidade`, o.vendoPor > 0 && `aceita vender por ${reais(o.vendoPor)}`].filter(Boolean).join(' · ') || 'sem mudança'}</div>${porque(o.justificativa)}`).join('')}`;
    const tab = (titulo, o) => { const ls = Object.entries(o).filter(([k, v]) => k !== 'justificativa' && v > 0).map(([k, v]) => linha(ROTULO[k] || k, v)).join(''); return ls || o.justificativa ? `<h4>${titulo}</h4>${ls ? `<table>${ls}</table>` : ''}${porque(o.justificativa)}` : ''; };
    h += tab('Investimentos na empresa', d.gestao) + tab('Finanças', d.financas);
    if (d.acoes_externas.length) h += `<h4>Contra os rivais e o Estado</h4>${d.acoes_externas.map((a) => `<div><b>${esc(ACOES[a.tipo].nome)}</b>${a.alvo ? ` → ${esc(a.alvo)}` : ''}${a.recursos ? ` · ${reais(a.recursos)}` : ''} <span class="rot">(${esc(ACOES[a.tipo].lei)})</span></div>${porque(a.justificativa)}`).join('')}`;
    if (d.acao_livre) h += `<h4>Ação livre (registrada, sem efeito nos números)</h4><div>${esc(d.acao_livre)}</div>`;
    if (d.fala) h += `<h4>Fala pública</h4><div>“${esc(d.fala)}”</div>`;
    if (d.memoria) h += `<h4>Nota para si mesmo</h4><div>${esc(d.memoria)}</div>`;
  } else h += `<div class="rot" style="margin:6px 0">Neste ano não houve decisão nova: preço, salários e equipe ficaram como estavam e nada novo foi investido.</div>`;
  h += `<h4>O que aconteceu</h4>${notas(s.notas) || '<div class="rot">Nada fora do previsto.</div>'}`;
  if (s.negocios?.length) h += `<h4>Negócios no fim do ano</h4><table><tr><th>Negócio</th><th>Unid.</th><th>Preço</th><th>Salário</th><th>Qualid.</th><th>Receita</th><th>Lucro</th></tr>${s.negocios.map((n) => `<tr><td>${esc(NEGOCIOS[n.negocio].nome)}</td><td>${n.unidades}${n.fora ? `+${n.fora}` : ''}</td><td>${n.preco}</td><td>${Math.round(n.salario * 100)}%</td><td>${n.qualidade}</td><td>${reais(n.receita)}</td><td>${reais(n.lucro)}</td></tr>`).join('')}</table>`;
  if (r) h += `<h4>Resultado do ano (${esc(r.regime)})</h4><table>${[['Receita', r.receita], ['Royalties de franquia', r.royalties_de_franquia], ['Insumos', -r.insumos], ['Salários', -r.salarios], ['Encargos', -r.encargos], ['Aluguéis', -r.alugueis], ['Custos fixos', -r.custos_fixos], ['Tributos sobre vendas', -r.tributos_sobre_vendas], ['Juros', -r.juros], ['Imposto sobre o lucro', -r.imposto_sobre_lucro], ['Ganho em renda fixa', r.ganho_renda_fixa], ['Ganho na bolsa', r.ganho_bolsa], ['Renda de imóveis', r.renda_de_imoveis]].filter(([, v]) => Math.abs(v) >= 1).map(([k, v]) => `<tr><td>${k}</td><td>${reais(v)}</td></tr>`).join('')}
    <tr><th>Lucro líquido</th><th>${reais(r.lucro_liquido)}</th></tr><tr><th>Patrimônio</th><th>${reais(r.patrimonio)}</th></tr><tr><td>Caixa</td><td>${reais(r.caixa)}</td></tr><tr><td>Dívida</td><td>${reais(r.divida)}</td></tr></table>`;
  if (s.tokens) h += `<div class="rot" style="margin-top:6px">Esta reunião custou ${s.tokens.toLocaleString('pt-BR')} tokens.</div>`;
  return h;
}

function abaComparar() {
  const cs = j.ceos, f = (fn) => cs.map((c) => `<td>${c.quebrou ? '—' : fn(c)}</td>`).join('');
  const op = (c, t) => { const o = c.ops[t]; return o && o.unidades + o.fora ? `${o.unidades}${o.fora ? `+${o.fora}` : ''}` : '·'; };
  const pad = (c) => c.ops.padaria;
  const linhas = [
    ['Patrimônio', (c) => `<b>${reais(c.patrimonio)}</b>`], ['Caixa', (c) => reais(c.caixa)], ['Dívida', (c) => reais(c.divida)], ['Aplicações', (c) => reais(c.rendaFixa + c.bolsa)], ['Imóveis', (c) => reais(c.imoveis)],
    ['Receita no ano', (c) => reais(c.receita)], ['Lucro no ano', (c) => reais(c.lucro)], ['Regime', (c) => c.regime], ['Funcionários', (c) => Math.round(c.funcionarios).toLocaleString('pt-BR')],
    ...Object.entries(NEGOCIOS).filter(([t]) => cs.some((c) => c.ops[t] && c.ops[t].unidades + c.ops[t].fora)).map(([t, d]) => [`${d.nome} (em Campinas + fora)`, (c) => op(c, t)]),
    ['Franqueados', (c) => c.franqueados || '·'], ['Preço da padaria', (c) => (pad(c).unidades + pad(c).fora ? pad(c).preco.toFixed(2) : '·')], ['Salário (padaria)', (c) => `${Math.round(pad(c).salario * 100)}%`],
    ['Marca', (c) => c.marca.toFixed(2)], ['Gestão', (c) => c.gestao.toFixed(2)], ['Tecnologia', (c) => c.tecnologia.toFixed(2)], ['Reputação', (c) => c.reputacao.toFixed(2)],
    ['Ilícitos tentados / descobertos', (c) => `${c.ilicitos} / ${c.flagrantes}`],
  ];
  return `<table><tr><th></th>${cs.map((c) => `<th style="color:${CEOS[c.id].cor}">${c.nome}</th>`).join('')}</tr>
    ${linhas.map(([k, fn]) => `<tr><td>${k}</td>${f(fn)}</tr>`).join('')}
    <tr><td>Tokens usados (de ${mil(TOKENS_SECULO)})</td>${cs.map((c) => `<td>${mil(c.tokens)}</td>`).join('')}</tr>
    <tr><td>Reuniões pagas / respostas inválidas</td>${cs.map((c) => `<td>${c.chamadas} / ${c.invalidas}</td>`).join('')}</tr>
    <tr><td>Última fala</td>${cs.map((c) => `<td style="white-space:normal;text-align:left">${esc(c.fala) || '—'}</td>`).join('')}</tr></table>
    <div class="rot" style="margin-top:6px">Campinas hoje: ${Math.round(j.cidade.pop).toLocaleString('pt-BR')} habitantes · renda mensal por pessoa R$ ${Math.round(j.cidade.renda).toLocaleString('pt-BR')} · desemprego ${(j.cidade.desemprego * 100).toFixed(1)}%</div>`;
}

function abaGrafico() {
  setTimeout(() => {
    const cv = $('grafico');
    if (!cv) return;
    cv.width = cv.offsetWidth * 2; cv.height = 340;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const lg = (v) => Math.log10(Math.max(1e4, v));
    const max = Math.max(6.5, ...j.ceos.flatMap((c) => c.hist.map((h) => lg(h.patrimonio)))) + 0.1, min = 4.5;
    g.font = '20px Georgia'; g.fillStyle = '#7a6248'; g.strokeStyle = '#d8c9a2'; g.lineWidth = 1;
    for (let e = 5; e <= max; e++) { const y = H - 24 - ((e - min) / (max - min)) * (H - 40); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.fillText(reais(10 ** e), 4, y - 4); }
    const total = Math.max(1, j.ano - 2026);
    for (const c of j.ceos) {
      g.beginPath();
      c.hist.forEach((h) => g.lineTo(((h.ano - 2026) / total) * W, H - 24 - ((lg(h.patrimonio) - min) / (max - min)) * (H - 40)));
      g.strokeStyle = CEOS[c.id].cor; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
    }
    g.fillText('2026', 4, H - 4); g.fillText(String(j.ano), W - 54, H - 4);
  }, 0);
  return `<canvas id="grafico"></canvas><div class="legenda">${j.ceos.map((c) => `<span><i style="background:${CEOS[c.id].cor}"></i>${c.nome}: ${c.quebrou ? `quebrou em ${c.quebrou}` : reais(c.patrimonio)}</span>`).join('')}</div>
    <div class="rot">Escala logarítmica: cada linha horizontal é dez vezes a de baixo.</div>
    <h4>Marcos</h4>${j.ceos.map((c) => `<div><b style="color:${CEOS[c.id].cor}">${c.nome}</b>: ${c.marcos.map((m) => `${m.ano} ${esc(m.texto.toLowerCase())}`).join(' · ') || '—'}</div>`).join('')}`;
}

function abaRegras() {
  return `<h3>Como funciona</h3>
    Claude, Grok e Gemini começam <b>exatamente iguais</b>: uma padaria de bairro em Campinas e ${reais(CAIXA_INICIAL)} em caixa, em 2026. Vence quem chegar a ${ANO_FINAL} com o <b>maior patrimônio</b> (caixa, aplicações, imóveis e valor dos negócios, menos dívidas), ou quem for o único que não quebrou.<br><br>
    <b>Batalha justa.</b> Mesma cidade, mesma economia, mesmos eventos, mesmo texto de regras e mesmo dossiê para os três. As decisões do ano são tomadas ao mesmo tempo, com o relógio parado. Cada um tem <b>${mil(TOKENS_SECULO)} de tokens</b> para o século: o que lê, raciocina e escreve conta, e quem gasta tudo fica sem decidir.<br><br>
    <b>Mundo aberto.</b> Cada CEO pode abrir e fechar unidades, sair de Campinas, franquear, montar padaria industrial, entrar em ${Object.keys(NEGOCIOS).length} tipos de negócio, aplicar em renda fixa, bolsa e imóveis, tomar crédito, comprar negócios dos rivais, e agir contra eles por vias legais ou ilícitas. As ilícitas rendem mais e podem ser descobertas, com a punição da lei brasileira.<br><br>
    <b>Leis na conta:</b> Simples Nacional até R$ 4,8 milhões de faturamento (alíquotas do Anexo I); fora dele, tributos sobre vendas, 34% sobre o lucro e encargos de 70% sobre salários; reforma tributária em 2033; rescisões; recuperação judicial e falência (Lei 11.101/2005); cartel e leniência (Lei 12.529/2011); Lei de Franquias (13.966/2019); LGPD; Código de Defesa do Consumidor; Lei Anticorrupção.<br><br>
    Sem chave de API, o CEO é tocado por regras com um perfil fixo (padeiro, expansionista, diversificador): serve de demonstração e não diz nada sobre o modelo de verdade.<br><br>
    <button id="novo">🌱 Novo jogo</button> &nbsp; <a href="./">Modo narrador</a> · <a href="arena.html">Arena medieval</a>`;
}

function pintarAba() {
  const c = ceoDe(j, vista), el = $('conteudo');
  const rolagem = el.scrollTop;
  if (aba === 'macro') el.innerHTML = abaMacro(c);
  else if (aba === 'micro') el.innerHTML = abaMicro(c);
  else if (aba === 'comparar') el.innerHTML = abaComparar();
  else if (aba === 'grafico') el.innerHTML = abaGrafico();
  else if (aba === 'cronica') el.innerHTML = j.log.slice(-90).reverse().map((l) => `<div class="anoBloco" style="border-color:${l.de ? CEOS[l.de].cor : '#d9a13a'};margin-bottom:6px"><span class="rot">${l.ano}</span> ${esc(l.texto)}</div>`).join('') || '<div class="rot">Nada ainda.</div>';
  else {
    el.innerHTML = abaRegras();
    $('novo').onclick = () => { if (confirm('Encerrar este jogo e começar outro do zero?')) { localStorage.removeItem(CHAVE); window.removeEventListener('pagehide', salvar); location.reload(); } };
  }
  el.scrollTop = rolagem;
}

function pintar(tudo = true) {
  $('ano').textContent = j.ano;
  $('quando').textContent = `Campinas · ${Math.round(j.cidade.pop / 1000).toLocaleString('pt-BR')} mil habitantes · faltam ${ANO_FINAL - j.ano} anos`;
  document.querySelectorAll('#velocidade button').forEach((b) => b.classList.toggle('ativo', +b.dataset.v === velocidade));
  document.querySelectorAll('#abas [data-aba]').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
  pintarRanking();
  // A aba Micro só é redesenhada quando o usuário pede, para não atrapalhar a leitura.
  if (tudo && !$('baixo').classList.contains('recolhido') && (aba !== 'micro' || anoMicro === null)) pintarAba();
}

$('linhas').addEventListener('click', (e) => { const b = e.target.closest('[data-ceo]'); if (b) { vista = b.dataset.ceo; anoMicro = null; pintar(); pintarAba(); } });
$('velocidade').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { velocidade = +b.dataset.v; pintar(false); } });
$('abas').addEventListener('click', (e) => { const b = e.target.closest('[data-aba]'); if (b) { aba = b.dataset.aba; $('baixo').classList.remove('recolhido'); $('recolher').textContent = '▾'; $('conteudo').scrollTop = 0; pintar(false); pintarAba(); } });
$('recolher').addEventListener('click', () => { const r = $('baixo').classList.toggle('recolhido'); $('recolher').textContent = r ? '▴' : '▾'; if (!r) pintarAba(); });
$('conteudo').addEventListener('click', (e) => {
  const ir = e.target.closest('[data-ir]'), nav = e.target.closest('[data-nav]');
  const anos = ceoDe(j, vista).sala.map((s) => s.ano);
  if (ir) { aba = 'micro'; anoMicro = +ir.dataset.ir; $('conteudo').scrollTop = 0; pintar(false); pintarAba(); }
  else if (nav) { anoMicro = nav.dataset.nav === 'fim' ? anos[anos.length - 1] : anos[Math.min(anos.length - 1, Math.max(0, anos.indexOf(anoMicro) + +nav.dataset.nav))]; pintarAba(); }
});
$('conteudo').addEventListener('input', (e) => { if (e.target.id === 'regua') { anoMicro = ceoDe(j, vista).sala[+e.target.value].ano; pintarAba(); } });
if (window.innerHeight < 480 || window.innerWidth < 700) $('recolher').click();

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
  for (const l of novos.filter((x) => x.tipo !== 'fala' || velocidade <= 0.3).slice(-3)) {
    toast(`${l.ano}: ${l.texto}`, l.de ? CEOS[l.de].cor : '#d9a13a');
    if (l.tipo === 'era' && l.de) { faixa(CEOS[l.de].nome, l.texto.replace(/^\S+ /, '')); fx.fogos(8); }
    if (l.tipo === 'guerra' && /quebra/.test(l.texto)) faixa('Fim de jogo', l.texto);
  }
}

// ---------- o ano: os três decidem ao mesmo tempo, depois o ano fecha ----------
async function pedir(c) {
  const r = await fetch('/api/arena/decidir-ceo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jogo: j.jogo, provedor: c.id, situacao: dossie(j, c) }) });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro || `erro ${r.status}`);
  return dados;
}

async function ano() {
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
  avancarJogo(j);
  pensando = false;
  $('pensando').classList.remove('visivel');
  if (j.ano % 5 === 0 || velocidade < 2) salvar();
  espelhar();
  novidades();
  pintar();
  if (terminou(j) && !fim) {
    fim = true; salvar();
    const v = vencedor(j);
    faixa(v.motivo === 'unico' ? 'O único que não quebrou' : v.ceo ? `Maior patrimônio em ${ANO_FINAL}` : 'Fim', v.ceo ? `${v.ceo.nome} vence com ${reais(v.ceo.patrimonio)}` : 'Todos quebraram');
    fx.fogos(14);
  }
}

// ---------- laço ----------
const relogio = new THREE.Clock();
let somaDt = 0, quadros = 0;
function quadro() {
  const dt = Math.min(relogio.getDelta(), 0.1);
  tempo += dt;
  somaDt += dt; quadros++;
  if (quadros >= 50) {
    const medio = somaDt / quadros;
    const nova = medio > 1 / 30 ? Math.max(0.6, escala - 0.1) : medio < 1 / 52 ? Math.min(1, escala + 0.06) : escala;
    if (nova !== escala) { escala = nova; renderer.setPixelRatio(pixelBase * escala); }
    somaDt = quadros = 0;
  }
  if (velocidade > 0 && !pensando && !terminou(j)) {
    acumulado += dt * velocidade;
    if (acumulado >= 1) { acumulado = 0; ano(); }
  }
  controles.update();
  const t = controles.target;
  if (Math.hypot(t.x, t.z) > 95) { const k = 95 / Math.hypot(t.x, t.z); t.x *= k; t.z *= k; }
  const chao = Math.max(altura(camera.position.x, camera.position.z), NIVEL_AGUA) + 1.2;
  if (camera.position.y < chao) camera.position.y = chao;
  const noite = mundo3d.estado.noite;
  mundo3d.atualizar(dt, tempo, tempo / 6, controles.target);
  cidade3d.atualizar(dt, tempo, noite);
  moradores.atualizar(dt, tempo, noite);
  fx.atualizar(dt, tempo, noite);
  renderer.render(scene, camera);
  requestAnimationFrame(quadro);
}

window.jogoCEO = {
  estado: () => j,
  avancar(anos) { for (let i = 0; i < anos && !terminou(j); i++) { for (const c of j.ceos) if (naVez(j, c)) despachar(j, c, ceoPorRegras(j, c, CEOS[c.id].perfil), 'regras'); avancarJogo(j); } espelhar(true); pintar(); pintarAba(); },
  hora(h) { mundo3d.estado.hora = h; },
  pensando: () => pensando,
};

fetch('/api/arena/status').then((r) => r.json()).catch(() => servidor).then((s) => { servidor = s; pintar(); });
fim = terminou(j);
espelhar(true);
pintar();
pintarAba();
window.addEventListener('pagehide', salvar);
document.addEventListener('visibilitychange', () => { if (document.hidden) salvar(); });
quadro();
