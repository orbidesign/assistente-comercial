import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { criarMundo, avancarMes, aplicarEvento, interpretarTexto, aplicarDecisoes, resumoParaIA } from './sim/sim.js';
import { ERAS, NEGOCIOS, SERVICOS } from './sim/dados.js';
import { altura, rioX, NIVEL_AGUA } from './sim/geo.js';
import { criarMundo3D } from './render/mundo.js';
import { criarCidade, criarMoradores, criarAvatar } from './render/cidade.js';
import { criarFX } from './render/fx.js';
import { criarUI } from './ui.js';

const CHAVE = 'cidade-viva-v1';
const SEGUNDOS_POR_MES = 4;

// ---------- qualidade: celular e tablet recebem uma cena mais leve ----------
const toque = matchMedia('(pointer: coarse)').matches;
const leve = toque || Math.min(window.innerWidth, window.innerHeight) < 700;
const qualidade = leve ? { arvores: 1100, tufos: 3000, sombra: 1024, particulas: 700 } : { arvores: 1700, tufos: 6500, sombra: 2048, particulas: 1400 };
const pixelBase = Math.min(window.devicePixelRatio || 1, leve ? 1.75 : 2);
let escala = 1;
document.body.classList.toggle('toque', toque);

// ---------- cena ----------
const canvas = document.getElementById('cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !leve || pixelBase < 1.5, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelBase);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = leve ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 1400);
camera.position.set(27, 21, 36);
const controles = new OrbitControls(camera, canvas);
Object.assign(controles, { enableDamping: true, dampingFactor: 0.08, minDistance: 7, maxDistance: 185, maxPolarAngle: 1.5, autoRotateSpeed: 0.45, zoomSpeed: 1.2 });
controles.target.set(0, 2, 0);

function ajustar() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  // Em tela em pé o campo de visão abre, para a cidade não ficar espremida.
  camera.fov = camera.aspect < 0.8 ? 62 : 48;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', ajustar);
window.addEventListener('orientationchange', () => setTimeout(ajustar, 200));
ajustar();
// O Safari do iOS dá zoom na página com dois dedos mesmo com user-scalable=no.
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());

const mundo3d = criarMundo3D(scene, qualidade);
const cidade = criarCidade(scene, mundo3d);
const moradores = criarMoradores(scene);
const avatar = criarAvatar(scene);
const fx = criarFX(scene);

// ---------- estado do jogo ----------
let w = carregar() || criarMundo((Math.random() * 1e9) | 0);
let velocidade = 1, acumulado = 0, tempo = 0;
const ia = { ativa: false, ocupada: false, ultimoAno: -99, ultimaVez: -1e9 };
let andando = false, destino = null, cinema = false, proximoCorte = 0, ultimoNovo = null;
let voo = null, selecionado = null;
const teclas = new Set();
const rotulos = [];

function carregar() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE));
    return s && s.versao === 1 ? s : null;
  } catch { return null; }
}
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(w)); } catch { /* armazenamento indisponível: segue sem salvar */ }
}

const ui = criarUI({
  velocidade: (v) => { velocidade = v; ui.atualizar(w, velocidade); },
  carta: (c) => jogarEvento({ titulo: c.titulo, texto: c.texto, efeitos: c.efeitos }),
  narrar,
  andar: alternarAndar,
  cinema: alternarCinema,
  hora: () => { const h = mundo3d.estado.hora; mundo3d.estado.hora = [0.3, 0.5, 0.72, 0.9].find((x) => x > h + 0.02) ?? 0.3; },
  selecionar,
  irAte: () => { const p = posicaoDe(selecionado); if (p) voarAte(p.x, p.z, 22); },
  novo: () => { localStorage.removeItem(CHAVE); window.removeEventListener('pagehide', salvar); location.reload(); },
});

function posicaoDe(info) {
  if (!info) return null;
  if (info.classe === 'casa') return w.familias.find((f) => f.id === info.id)?.pos;
  if (info.classe === 'negocio') return w.negocios.find((n) => n.id === info.id)?.pos;
  return w.estado.predios.find((p) => p.id === info.id)?.pos;
}

function selecionar(info) {
  selecionado = info;
  cidade.selecionar(info);
  ui.selecionar(info, w);
}

// ---------- a cena reage ao que acontece na simulação ----------
function rotular(texto, x, z) {
  const el = document.createElement('div');
  el.className = 'rotulo';
  el.textContent = texto;
  document.getElementById('rotulos').appendChild(el);
  rotulos.push({ el, pos: new THREE.Vector3(x, altura(x, z) + 5, z), t: 0 });
}

function espelhar(imediato = false) {
  const novos = cidade.sincronizar(w, tempo, imediato);
  const pos = cidade.posicoes();
  moradores.sincronizar(w, pos);
  fx.sincronizarAnimais(w);
  fx.sincronizarLampioes(w, pos);
  const seca = w.mods.reduce((m, q) => (q.alvo === 'comida' || q.alvo === 'tudo' ? Math.max(m, (1 - q.fator) * 1.7) : m), 0);
  mundo3d.secar(Math.min(1, Math.max(0, seca)));

  for (const s of novos.slice(0, 6)) {
    fx.poeira(s.pos.x, s.pos.z);
    if (s.classe === 'negocio') rotular(`${NEGOCIOS[s.tipo].nome} dos ${w.familias.find((f) => f.id === w.negocios.find((n) => n.id === s.id)?.dono)?.nome ?? '…'}`, s.pos.x, s.pos.z);
    else if (s.classe === 'estado') rotular(SERVICOS[s.tipo].nome, s.pos.x, s.pos.z);
    if (s.classe !== 'casa') ultimoNovo = s.pos;
  }
  const fatos = ui.atualizar(w, velocidade);
  for (const l of fatos) {
    if (l.texto.startsWith('Greve')) moradores.emote('✊', 12);
    else if (l.texto.startsWith('Revolta')) moradores.emote('😡', 14);
    else if (l.tipo === 'era') fx.fogos(12);
    else if (l.texto.includes('fecha as portas')) moradores.emote('😟', 3);
    else if (l.texto.includes('distribui auxílio')) moradores.emote('🙏', 8);
    else if (l.texto.includes('sobe os impostos')) moradores.emote('😠', 6);
  }
}

// Balões do dia a dia: cada família mostra como está.
function humorDoMes() {
  if (velocidade > 3) return;
  const f = w.familias[Math.floor(Math.random() * w.familias.length)];
  if (!f) return;
  const e = f.fome > 0 ? '🍞' : f.infeliz > 0 ? '😠' : f.dono && f.renda > 40 ? '💰' : f.saude < 0.5 ? '🤒' : f.felicidade > 0.8 ? '😊' : null;
  if (e) moradores.emote(e, 1, f.id);
}

function efeitosVisuais(ev) {
  const txt = `${ev.titulo} ${ev.narrativa || ev.texto || ''}`.toLowerCase();
  const agua = /chuva|enchente|cheia|tempestade|inunda|temporal/.test(txt);
  if (agua) mundo3d.chover(tempo, 28);
  for (const e of ev.efeitos || []) {
    const v = Number(e.valor) || 0;
    if (e.tipo === 'familias' && v > 0) { fx.caravana(Math.ceil(v / 2)); moradores.emote('👋', 5); }
    else if (e.tipo === 'familias') moradores.emote('😢', 4);
    else if (e.tipo === 'riqueza' && v > 0) { fx.brilho(rioX(10) - 1, 10, 0xffd24a, { raio: 6, dur: 8, qtd: 120 }); moradores.emote('💰', 8); }
    else if (e.tipo === 'riqueza') moradores.emote('😠', 6);
    else if ((e.tipo === 'saude' && v < 0) || e.tipo === 'mortes') { fx.brilho(0, 0, 0x8fbf5a, { raio: 20, dur: 10, qtd: 140, tam: 0.6, sobe: 1.5, aditivo: false }); moradores.emote('🤒', 9); }
    else if (e.tipo === 'saude') moradores.emote('💚', 6);
    else if (e.tipo === 'felicidade' && v >= 0.1) { fx.fogos(10); moradores.emote('🎉', 12); }
    else if (e.tipo === 'felicidade' && v < 0) moradores.emote('😟', 6);
    else if (e.tipo === 'conhecimento' || e.tipo === 'educacao') { fx.brilho(0, 0, 0x8fd0ff, { raio: 5, dur: 7, qtd: 110, sobe: 5 }); moradores.emote('💡', 7); }
    else if (e.tipo === 'destruir' && !agua) {
      const alvos = cidade.posicoes().sort(() => Math.random() - 0.5).slice(0, Math.min(4, Math.max(1, Math.round(v))));
      alvos.forEach((p) => fx.fogo(p.x, p.z));
      if (alvos[0]) ultimoNovo = alvos[0];
      moradores.emote('😱', 10);
    } else if (e.tipo === 'fundar_estado') { fx.fogos(6); moradores.emote('⚖️', 8); }
    else if (e.tipo === 'seguranca' && v < 0) moradores.emote('😨', 8);
    else if (e.tipo === 'imposto' && v > 0) moradores.emote('😠', 8);
    else if (e.tipo === 'producao' && v > 1.15) moradores.emote('🌾', 7);
    else if (e.tipo === 'producao' && v < 0.85 && !agua) moradores.emote('🥵', 7);
  }
}

function jogarEvento(ev) {
  aplicarEvento(w, ev);
  efeitosVisuais(ev);
  espelhar();
}

// ---------- IA ----------
async function chamarIA(rota, corpo) {
  const r = await fetch(rota, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  const dados = await r.json();
  if (dados.custo) ui.ia({ ia: true, ...dados.custo });
  if (!r.ok) throw new Error(dados.erro || `erro ${r.status}`);
  return dados;
}

async function narrar(texto) {
  let ev = null;
  if (ia.ativa) {
    ui.aviso('A IA está interpretando a sua narração…');
    try {
      ev = await chamarIA('/api/evento', { texto, resumo: resumoParaIA(w, true) });
      ui.aviso('');
    } catch (e) {
      ui.aviso(`A IA não respondeu (${e.message}). Usei a carta mais parecida.`);
    }
  }
  if (!ev) {
    ev = interpretarTexto(texto);
    if (!ia.ativa) ui.aviso(`Sem IA, interpretei como “${ev.titulo}”.`);
  }
  jogarEvento(ev);
}

// O conselho com IA custa uma chamada. Para o gasto ficar baixo ele se reúne no
// máximo a cada 3 anos de jogo e nunca mais de uma vez por minuto de relógio;
// entre as reuniões, Estado e empresários seguem as regras da simulação.
async function reuniao() {
  const ano = Math.floor(w.mes / 12);
  if (!ia.ativa || ia.ocupada || ano - ia.ultimoAno < 3 || performance.now() - ia.ultimaVez < 60000) return;
  ia.ocupada = true; ia.ultimoAno = ano; ia.ultimaVez = performance.now();
  try {
    aplicarDecisoes(w, await chamarIA('/api/conselho', { resumo: resumoParaIA(w) }));
    espelhar();
  } catch (e) {
    ui.aviso(`Agentes de IA indisponíveis (${e.message}); os atores seguem as regras.`);
  } finally { ia.ocupada = false; }
}

function aposMes(eraAntes) {
  if (w.era !== eraAntes) ui.novaEra(ERAS[w.era].nome);
  if (w.mes % 12 === 0) { salvar(); reuniao(); }
  espelhar();
  humorDoMes();
}

// ---------- câmera ----------
function voarAte(x, z, dist = 26) {
  const alvo = new THREE.Vector3(x, Math.max(altura(x, z), NIVEL_AGUA) + 1.5, z);
  const dir = camera.position.clone().sub(controles.target);
  dir.y = Math.max(dir.y, dir.length() * (andando ? 0.6 : 0.42));
  dir.normalize().multiplyScalar(dist);
  voo = { t: 0, deAlvo: controles.target.clone(), deCam: camera.position.clone(), alvo, cam: alvo.clone().add(dir) };
}

function alternarCinema() {
  cinema = !cinema;
  if (cinema && andando) alternarAndar();
  controles.autoRotate = cinema;
  proximoCorte = tempo + 2;
  ui.cinema(cinema);
}

function alternarAndar() {
  andando = !andando;
  if (andando && cinema) alternarCinema();
  avatar.visible = andando;
  destino = null;
  if (andando) {
    const t = controles.target;
    const x = THREE.MathUtils.clamp(t.x, -70, 70), z = THREE.MathUtils.clamp(t.z, -70, 70);
    avatar.position.set(x, altura(x, z), z);
    Object.assign(controles, { minDistance: 4, maxDistance: 18, enablePan: false, maxPolarAngle: 1.3 });
    voarAte(x, z, 12);
    if (toque) ui.toast('Use a alavanca ou toque no chão para andar.');
  } else Object.assign(controles, { minDistance: 7, maxDistance: 185, enablePan: true, maxPolarAngle: 1.5 });
  ui.andando(andando);
}

// ---------- entrada: toque e mouse pelos mesmos eventos ----------
const raio = new THREE.Raycaster();
const ponteiros = new Map();
let ultimoToque = { t: 0, x: 0, y: 0 };

function mirar(e) {
  raio.setFromCamera(new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1), camera);
  const hit = raio.intersectObjects([moradores.grupo, cidade.grupo], true)[0];
  let o = hit && hit.object;
  while (o && !o.userData.info) o = o.parent;
  const chao = raio.intersectObject(mundo3d.terreno)[0];
  return { info: o ? o.userData.info : null, chao: chao ? chao.point : null };
}

canvas.addEventListener('pointerdown', (e) => {
  ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
  voo = null;
});
canvas.addEventListener('pointercancel', (e) => ponteiros.delete(e.pointerId));
canvas.addEventListener('pointerup', (e) => {
  const p = ponteiros.get(e.pointerId);
  const varios = ponteiros.size > 1;
  ponteiros.delete(e.pointerId);
  if (!p || varios || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 9 || performance.now() - p.t > 450) return;
  const agora = performance.now();
  const duplo = agora - ultimoToque.t < 330 && Math.hypot(e.clientX - ultimoToque.x, e.clientY - ultimoToque.y) < 30;
  ultimoToque = { t: agora, x: e.clientX, y: e.clientY };
  const { info, chao } = mirar(e);
  if (cinema) return;
  if (duplo) {
    const alvo = posicaoDe(info) || (chao && { x: chao.x, z: chao.z });
    if (alvo && !andando) voarAte(alvo.x, alvo.z, 20);
    return;
  }
  if (info) selecionar(info);
  else if (andando && chao) destino = { x: chao.x, z: chao.z };
  else selecionar(null);
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  teclas.add(k);
  if (k === 'v') alternarAndar();
  if (k === 'c') alternarCinema();
  if (k === ' ') { velocidade = velocidade ? 0 : 1; ui.atualizar(w, velocidade); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));

const frente = new THREE.Vector3(), lado = new THREE.Vector3(), alvoCam = new THREE.Vector3();
function moverAvatar(dt) {
  camera.getWorldDirection(frente);
  frente.y = 0; frente.normalize();
  lado.set(-frente.z, 0, frente.x);
  const f = (teclas.has('w') || teclas.has('arrowup') ? 1 : 0) - (teclas.has('s') || teclas.has('arrowdown') ? 1 : 0) - ui.joy.y;
  const l = (teclas.has('d') || teclas.has('arrowright') ? 1 : 0) - (teclas.has('a') || teclas.has('arrowleft') ? 1 : 0) + ui.joy.x;
  const p = avatar.position;
  let dx = frente.x * f + lado.x * l, dz = frente.z * f + lado.z * l, forca = Math.min(1, Math.hypot(f, l));
  if (forca > 0.05) destino = null;
  else if (destino) {
    dx = destino.x - p.x; dz = destino.z - p.z; forca = 1;
    if (Math.hypot(dx, dz) < 0.4) { destino = null; forca = 0; }
  }
  if (forca > 0.05) {
    const d = Math.hypot(dx, dz);
    const v = (teclas.has('shift') ? 9 : 5.5) * forca * dt;
    const nx = p.x + (dx / d) * v, nz = p.z + (dz / d) * v;
    if (altura(nx, nz) > NIVEL_AGUA - 0.4 && Math.hypot(nx, nz) < 100) { p.x = nx; p.z = nz; } else destino = null;
    avatar.rotation.y = Math.atan2(dx, dz);
    p.y = altura(p.x, p.z) + Math.abs(Math.sin(tempo * 11)) * 0.08;
  } else p.y = altura(p.x, p.z);
  controles.target.lerp(alvoCam.set(p.x, p.y + 1.3, p.z), Math.min(1, dt * 8));
}

// ---------- laço ----------
const relogio = new THREE.Clock();
const tela = new THREE.Vector3();
let somaDt = 0, quadros = 0;

function quadro() {
  const dt = Math.min(relogio.getDelta(), 0.1);
  tempo += dt;

  // Resolução dinâmica: se o aparelho não acompanha, renderiza menor em vez de travar.
  somaDt += dt; quadros++;
  if (quadros >= 50) {
    const medio = somaDt / quadros;
    const nova = medio > 1 / 30 ? Math.max(0.6, escala - 0.1) : medio < 1 / 52 ? Math.min(1, escala + 0.06) : escala;
    if (nova !== escala) { escala = nova; renderer.setPixelRatio(pixelBase * escala); }
    somaDt = quadros = 0;
  }

  if (velocidade > 0) {
    acumulado += dt * velocidade;
    while (acumulado >= SEGUNDOS_POR_MES) {
      acumulado -= SEGUNDOS_POR_MES;
      const era = w.era;
      avancarMes(w);
      aposMes(era);
    }
  }

  if (andando) moverAvatar(dt);
  if (cinema && tempo > proximoCorte) {
    proximoCorte = tempo + 13;
    const pos = cidade.posicoes();
    const p = ultimoNovo || pos[Math.floor(Math.random() * pos.length)] || { x: 0, z: 0 };
    ultimoNovo = null;
    voarAte(p.x, p.z, 18 + Math.random() * 26);
  }
  if (voo) {
    voo.t = Math.min(1, voo.t + dt / 1.5);
    const k = voo.t * voo.t * (3 - 2 * voo.t);
    controles.target.lerpVectors(voo.deAlvo, voo.alvo, k);
    camera.position.lerpVectors(voo.deCam, voo.cam, k);
    if (voo.t >= 1) voo = null;
  }
  controles.update();
  // A câmera nunca entra no chão nem sai do vale.
  const t = controles.target;
  if (Math.hypot(t.x, t.z) > 95) { const k = 95 / Math.hypot(t.x, t.z); t.x *= k; t.z *= k; }
  const chao = Math.max(altura(camera.position.x, camera.position.z), NIVEL_AGUA) + 1.2;
  if (camera.position.y < chao) camera.position.y = chao;

  const noite = mundo3d.estado.noite;
  mundo3d.atualizar(dt, tempo, w.mes + acumulado / SEGUNDOS_POR_MES, controles.target);
  cidade.atualizar(dt, tempo, noite);
  moradores.atualizar(dt, tempo, noite);
  fx.atualizar(dt, tempo, noite);

  for (let i = rotulos.length - 1; i >= 0; i--) {
    const r = rotulos[i];
    r.t += dt;
    tela.copy(r.pos).project(camera);
    const visivel = tela.z < 1 && r.t < 4.5;
    r.el.style.opacity = visivel ? Math.min(1, r.t * 4, (4.5 - r.t) * 1.5) : 0;
    r.el.style.transform = `translate(${(tela.x * 0.5 + 0.5) * window.innerWidth}px, ${(-tela.y * 0.5 + 0.5) * window.innerHeight - r.t * 12}px) translate(-50%, -100%)`;
    if (r.t >= 4.5) { r.el.remove(); rotulos.splice(i, 1); }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(quadro);
}

// Para depuração e testes pelo console do navegador.
window.cidadeViva = {
  mundo: () => w,
  avancar(meses) { for (let i = 0; i < meses; i++) avancarMes(w); espelhar(true); },
  hora(h) { mundo3d.estado.hora = h; },
  qualidade: () => ({ leve, toque, escala }),
  fx, mundo3d, voarAte,
  avatar: () => ({ x: avatar.position.x, z: avatar.position.z, andando, cinema }),
};

fetch('/api/status').then((r) => r.json()).catch(() => ({ ia: false })).then((s) => { ia.ativa = !!s.ia; ui.ia(s); });
ui.ia({ ia: false });
espelhar(true);
window.addEventListener('pagehide', salvar);
document.addEventListener('visibilitychange', () => { if (document.hidden) salvar(); });
quadro();
