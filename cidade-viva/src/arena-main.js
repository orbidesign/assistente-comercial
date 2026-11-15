// Arena das IAs: três cidades no mesmo ponto de partida, cada uma governada por
// uma API. A tela mostra uma cidade por vez em 3D e o placar das três.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { governoPorRegras, pontos } from './sim/sim.js';
import { ERAS } from './sim/dados.js';
import { altura, NIVEL_AGUA } from './sim/geo.js';
import {
  criarArena, avancarArena, turnoDevido, aplicarTurno, situacao, rivaisPublicos, podePagar, registrarCusto, classificacao, cidade as cidadeDe,
  PROVEDORES, VERBA_TOTAL, VERBA_MILENIO, MESES_MILENIO, MESES_POR_TURNO,
} from './arena/arena.js';
import { criarMundo3D } from './render/mundo.js';
import { criarCidade, criarMoradores } from './render/cidade.js';
import { criarFX } from './render/fx.js';

const CHAVE = 'cidade-viva-arena-v1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- cena (mesma do modo narrador) ----------
const toque = matchMedia('(pointer: coarse)').matches;
const leve = toque || Math.min(window.innerWidth, window.innerHeight) < 700;
const qualidade = leve ? { arvores: 1100, tufos: 3000, sombra: 1024, particulas: 700 } : { arvores: 1700, tufos: 6500, sombra: 2048, particulas: 1400 };
const pixelBase = Math.min(window.devicePixelRatio || 1, leve ? 1.75 : 2);
let escala = 1;
const canvas = $('cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !leve || pixelBase < 1.5, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelBase);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = leve ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 1400);
camera.position.set(34, 30, 46);
const controles = new OrbitControls(camera, canvas);
Object.assign(controles, { enableDamping: true, dampingFactor: 0.08, minDistance: 7, maxDistance: 185, maxPolarAngle: 1.5, autoRotate: true, autoRotateSpeed: 0.35 });
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

const mundo3d = criarMundo3D(scene, qualidade);
const cidade3d = criarCidade(scene, mundo3d);
const moradores = criarMoradores(scene);
const fx = criarFX(scene);

// ---------- estado ----------
function carregar() {
  try { const s = JSON.parse(localStorage.getItem(CHAVE)); return s && s.versao === 1 ? s : null; } catch { return null; }
}
function nova() {
  const a = criarArena((Math.random() * 1e9) | 0);
  a.jogo = `${a.semente}-${Date.now().toString(36)}`;
  return a;
}
let a = carregar() || nova();
let vista = a.cidades[0].id, velocidade = 4, acumulado = 0, tempo = 0, pensando = false, aba = 'cronica';
let servidor = { verba: VERBA_TOTAL, provedores: {} };
let ultimoEspelho = -1, ultimoLog = a.log[a.log.length - 1] || null;
const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(a)); } catch { /* sem armazenamento */ } };
const mundoVisto = () => cidadeDe(a, vista).w;

// ---------- 3D da cidade em exibição ----------
function espelhar(imediato = false) {
  const w = mundoVisto();
  const novos = cidade3d.sincronizar(w, tempo, imediato);
  const pos = cidade3d.posicoes();
  moradores.sincronizar(w, pos);
  fx.sincronizarAnimais(w);
  fx.sincronizarLampioes(w, pos);
  const seca = w.mods.reduce((m, q) => (q.alvo === 'comida' || q.alvo === 'tudo' ? Math.max(m, (1 - q.fator) * 1.7) : m), 0);
  mundo3d.secar(Math.min(1, seca));
  if (velocidade <= 20) novos.slice(0, 4).forEach((s) => fx.poeira(s.pos.x, s.pos.z));
  ultimoEspelho = a.mes;
}

function verCidade(id) {
  vista = id;
  cidade3d.limpar(); moradores.limpar(); fx.limpar(); mundo3d.restaurar();
  espelhar(true);
  pintar();
}

// ---------- interface ----------
function toast(texto, cor) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = texto;
  if (cor) el.style.borderColor = cor;
  $('toasts').appendChild(el);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => el.remove(), 6800);
}

function faixa(topo, texto) {
  $('faixa-topo').textContent = topo; $('faixa-texto').textContent = texto;
  $('faixa').classList.add('visivel');
  setTimeout(() => $('faixa').classList.remove('visivel'), 4200);
}

function estadoDaCidade(c) {
  const p = servidor.provedores[c.id];
  if (pensando && c.pensando) return 'pensando…';
  if (!c.w.estado.existe) return 'ainda sem governo';
  if (!p || !p.ativo) return `sem chave: regras (${PROVEDORES[c.id].perfil})`;
  if (c.gasto >= VERBA_TOTAL) return 'verba esgotada';
  if (c.modo === 'semverba') return 'poupando verba';
  if (c.modo === 'erro') return `erro: ${c.erro || ''}`;
  return p.modelo;
}

function pintarCidades() {
  const ordem = classificacao(a);
  const medalha = ['🥇', '🥈', '🥉'];
  $('cidades').innerHTML = a.cidades.map((c) => {
    const p = PROVEDORES[c.id], w = c.w, marcha = a.marchas.find((m) => m.de === c.id);
    return `<button class="cid painel ${c.id === vista ? 'vista' : ''} ${pensando && c.pensando ? 'pensa' : ''}" data-cid="${c.id}">
      <div class="faixa" style="background:${p.cor}"></div><div class="corpo">
      <div class="ia">${medalha[ordem.indexOf(c)]} ${p.nome} <small>${p.empresa}</small></div>
      <div class="nome">${esc(w.nome)}</div>
      <div class="era">${ERAS[w.era].nome}</div>
      <div class="nums"><span>⭐ <b>${pontos(w)}</b></span><span>👥 ${w.ind.populacao}</span><span>⚔️ ${w.estado.exercito || 0}${marcha ? ` → ${marcha.forca}` : ''}</span></div>
      <div class="verba" title="Verba de IA usada"><i style="width:${Math.min(100, (c.gasto / VERBA_TOTAL) * 100)}%"></i></div>
      <div class="st">US$ ${c.gasto.toFixed(3)} · ${esc(estadoDaCidade(c))}</div></div></button>`;
  }).join('');
}

function pintarAba() {
  const el = $('conteudo');
  if (aba === 'cronica') {
    el.innerHTML = a.log.slice(-60).reverse().map((l) =>
      `<p style="border-color:${l.de ? PROVEDORES[l.de].cor : '#d9a13a'}"><small>ano ${Math.floor(l.mes / 12) + 1}</small>${esc(l.texto)}</p>`).join('')
      || '<span class="rot">As três cidades acabam de ser fundadas. Os governos se reúnem a cada 5 anos.</span>';
  } else if (aba === 'mente') {
    const c = cidadeDe(a, vista), p = PROVEDORES[c.id], s = servidor.provedores[c.id];
    el.innerHTML = `<h3 style="color:${p.cor}">${p.nome} governa ${esc(c.w.nome)}</h3>
      <div class="rot">Plano que escreveu para si</div><div>${esc(c.plano || '—')}</div>
      <div class="rot" style="margin-top:6px">Última fala pública</div><div>${esc(c.fala || '—')}</div>
      <div class="rot" style="margin-top:6px">Últimas decisões</div><div>${esc(c.feito.join('; ') || '—')}</div>
      <div class="rot" style="margin-top:6px">Governo</div>
      <div>imposto ${Math.round(c.w.estado.taxa * 100)}% · tesouro ${Math.round(c.w.estado.tesouro)} · legitimidade ${Math.round(c.w.estado.legitimidade * 100)}% · felicidade ${Math.round(c.w.ind.felicidade * 100)}% · saber ${Math.round(c.w.conhecimento)}</div>
      <div class="rot" style="margin-top:6px">Verba</div>
      <div>${c.chamadas} reuniões pagas · US$ ${c.gasto.toFixed(4)} de ${VERBA_TOTAL} no total · US$ ${c.gastoMilenio.toFixed(4)} de ${VERBA_MILENIO} neste milênio${c.custoMedio ? ` · cerca de US$ ${c.custoMedio.toFixed(4)} por reunião` : ''}${s ? ` · ${esc(s.modelo)}` : ''}</div>`;
  } else if (aba === 'placar') {
    el.innerHTML = `<canvas id="placar"></canvas><div class="legenda">${a.cidades.map((c) => `<span><i style="background:${PROVEDORES[c.id].cor}"></i>${PROVEDORES[c.id].nome}: ${pontos(c.w)}</span>`).join('')}</div>
      <div class="rot" style="margin-top:6px">${a.marcos.filter((m, i, l) => l.findIndex((x) => x.era === m.era) === i).map((m) => `${ERAS[m.era].nome}: ${PROVEDORES[m.id].nome} (ano ${m.ano})`).join(' · ') || 'Nenhuma era conquistada ainda.'}</div>`;
    const cv = $('placar');
    cv.width = cv.offsetWidth * 2; cv.height = 260;
    const g = cv.getContext('2d');
    const pts = [...a.hist, { p: a.cidades.map((c) => pontos(c.w)) }];
    const max = Math.max(200, ...pts.flatMap((h) => h.p));
    a.cidades.forEach((c, k) => {
      g.beginPath();
      pts.forEach((h, i) => g.lineTo((i / Math.max(1, pts.length - 1)) * cv.width, 252 - (h.p[k] / max) * 240));
      g.strokeStyle = PROVEDORES[c.id].cor; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
    });
  } else {
    el.innerHTML = `<h3>Como funciona</h3>
      Três cidades nascem iguais, da mesma semente. Cada uma tem o governo entregue a uma API: Claude, Grok ou Gemini.
      O povo e os empresários seguem as mesmas regras nas três; só o governo muda.<br><br>
      A cada 5 anos os governos se reúnem e decidem imposto, obras, pesquisa, auxílio, fomento, exército, diplomacia e guerra.
      Cada API tem <b>US$ ${VERBA_TOTAL}</b> para o jogo inteiro e pode gastar no máximo <b>US$ ${VERBA_MILENIO} por milênio</b>, liberado aos poucos:
      modelo mais caro pensa menos vezes, e nas reuniões que não pode pagar suas políticas ficam como estavam.<br><br>
      Pontos = era, população, conhecimento, felicidade e educação. Sem chave configurada, a cidade é governada por regras simples com um temperamento fixo (sábio, guerreiro ou mercador), só para a disputa já ter graça; isso não diz nada sobre o modelo de verdade.<br><br>
      <button id="nova">🌱 Nova arena</button> &nbsp; <a href="./">Modo narrador</a>`;
    $('nova').onclick = () => { if (confirm('Encerrar esta disputa e começar outra do zero?')) { localStorage.removeItem(CHAVE); window.removeEventListener('pagehide', salvar); location.reload(); } };
  }
}

function pintar() {
  const ano = Math.floor(a.mes / 12) + 1;
  $('quando').textContent = `ano ${ano} · ${Math.floor(a.mes / MESES_MILENIO) + 1}º milênio · vendo ${mundoVisto().nome}`;
  document.querySelectorAll('#velocidade button').forEach((b) => b.classList.toggle('ativo', +b.dataset.v === velocidade));
  document.querySelectorAll('#abas [data-aba]').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
  pintarCidades();
  if (!$('baixo').classList.contains('recolhido')) pintarAba();
}

$('cidades').addEventListener('click', (e) => { const b = e.target.closest('[data-cid]'); if (b && b.dataset.cid !== vista) verCidade(b.dataset.cid); });
$('velocidade').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { velocidade = +b.dataset.v; pintar(); } });
$('abas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-aba]');
  if (b) { aba = b.dataset.aba; $('baixo').classList.remove('recolhido'); $('recolher').textContent = '▾'; pintar(); }
});
$('recolher').addEventListener('click', () => { const r = $('baixo').classList.toggle('recolhido'); $('recolher').textContent = r ? '▴' : '▾'; pintar(); });
if (window.innerHeight < 480 || window.innerWidth < 700) $('recolher').click();
canvas.addEventListener('pointerdown', () => { controles.autoRotate = false; });

// Novidades da crônica viram avisos e efeitos na cidade em exibição.
function novidades() {
  const fim = a.log[a.log.length - 1] || null;
  if (fim === ultimoLog) return;
  const novos = a.log.slice(a.log.indexOf(ultimoLog) + 1);
  ultimoLog = fim;
  for (const l of novos.slice(-3)) {
    if (velocidade > 20 && l.tipo === 'fala') continue;
    toast(l.texto, l.de ? PROVEDORES[l.de].cor : '#d9a13a');
    if (l.tipo === 'era' && l.de) { faixa(`${PROVEDORES[l.de].nome} avança`, l.texto.replace(/ — a primeira!|\.$/g, '')); if (l.de === vista) fx.fogos(10); }
  }
}

function aposBatalha(m) {
  if (m.para === vista) {
    if (m.resultado === 'vitoria') cidade3d.posicoes().sort(() => Math.random() - 0.5).slice(0, 5).forEach((p) => fx.fogo(p.x, p.z, 18));
    moradores.emote(m.resultado === 'vitoria' ? '😱' : '🛡️', 14);
  } else if (m.de === vista && m.resultado === 'vitoria') { fx.fogos(8); moradores.emote('🎉', 10); }
}

// ---------- o turno: as três decidem ao mesmo tempo, e o tempo espera ----------
async function pedirDecisao(c) {
  const r = await fetch('/api/arena/decidir', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jogo: a.jogo, provedor: c.id, situacao: situacao(a, c) }) });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro || `erro ${r.status}`);
  return dados;
}

async function turno() {
  pensando = true;
  const respostas = await Promise.all(a.cidades.map(async (c) => {
    c.pensando = false; c.erro = '';
    if (!c.w.estado.existe) return { modo: 'cedo' };
    if (!servidor.provedores[c.id]?.ativo) return { modo: 'regras', d: governoPorRegras(c.w, rivaisPublicos(a, c), PROVEDORES[c.id].perfil) };
    if (!podePagar(a, c)) { c.turnosSemVerba++; return { modo: 'semverba' }; }
    c.pensando = true;
    $('pensando').classList.add('visivel');
    pintarCidades();
    try {
      const r = await pedirDecisao(c);
      registrarCusto(c, r.custo);
      return { modo: 'ia', d: r.decisao };
    } catch (e) { c.erro = e.message.slice(0, 80); return { modo: 'erro' }; }
  }));
  // Todas decidem vendo a mesma situação; só depois as decisões são aplicadas.
  respostas.forEach((r, i) => { const c = a.cidades[i]; c.modo = r.modo; c.pensando = false; if (r.d) aplicarTurno(a, c, r.d); });
  pensando = false;
  $('pensando').classList.remove('visivel');
  salvar();
  espelhar();
  novidades();
  pintar();
}

// ---------- laço ----------
const relogio = new THREE.Clock();
let somaDt = 0, quadros = 0, ultimaPintura = 0;
function quadro() {
  const dt = Math.min(relogio.getDelta(), 0.1);
  tempo += dt;
  somaDt += dt; quadros++;
  if (quadros >= 50) {
    const medio = somaDt / quadros;
    const novaEscala = medio > 1 / 30 ? Math.max(0.6, escala - 0.1) : medio < 1 / 52 ? Math.min(1, escala + 0.06) : escala;
    if (novaEscala !== escala) { escala = novaEscala; renderer.setPixelRatio(pixelBase * escala); }
    somaDt = quadros = 0;
  }

  if (velocidade > 0 && !pensando) {
    acumulado += dt * velocidade;
    let passos = Math.min(10, Math.floor(acumulado));
    acumulado -= Math.floor(acumulado);
    while (passos-- > 0) {
      avancarArena(a).forEach(aposBatalha);
      if (turnoDevido(a)) { turno(); break; }
    }
    novidades();
    if (tempo - ultimaPintura > 0.5) {
      ultimaPintura = tempo;
      if (a.mes !== ultimoEspelho) espelhar();
      pintar();
    }
  }

  controles.update();
  const t = controles.target;
  if (Math.hypot(t.x, t.z) > 95) { const k = 95 / Math.hypot(t.x, t.z); t.x *= k; t.z *= k; }
  const chao = Math.max(altura(camera.position.x, camera.position.z), NIVEL_AGUA) + 1.2;
  if (camera.position.y < chao) camera.position.y = chao;
  const noite = mundo3d.estado.noite;
  mundo3d.atualizar(dt, tempo, a.mes + acumulado, controles.target);
  cidade3d.atualizar(dt, tempo, noite);
  moradores.atualizar(dt, tempo, noite);
  fx.atualizar(dt, tempo, noite);
  renderer.render(scene, camera);
  requestAnimationFrame(quadro);
}

window.arena = {
  estado: () => a,
  avancar(meses) { for (let i = 0; i < meses; i++) { avancarArena(a); if (turnoDevido(a)) for (const c of a.cidades) aplicarTurno(a, c, governoPorRegras(c.w, rivaisPublicos(a, c), PROVEDORES[c.id].perfil)); } espelhar(true); pintar(); },
  hora(h) { mundo3d.estado.hora = h; },
  pensando: () => pensando,
};

fetch('/api/arena/status').then((r) => r.json()).catch(() => servidor).then((s) => { servidor = s; pintar(); });
espelhar(true);
pintar();
window.addEventListener('pagehide', salvar);
document.addEventListener('visibilitychange', () => { if (document.hidden) salvar(); });
quadro();
