import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { criarMundo, avancarMes, aplicarEvento, interpretarTexto, aplicarDecisoes, resumoParaIA } from './sim/sim.js';
import { ERAS } from './sim/dados.js';
import { altura, NIVEL_AGUA } from './sim/geo.js';
import { criarMundo3D } from './render/mundo.js';
import { criarCidade, criarMoradores, criarAvatar } from './render/cidade.js';
import { criarUI } from './ui.js';

const CHAVE = 'cidade-viva-v1';
const SEGUNDOS_POR_MES = 4;

// ---------- cena ----------
const canvas = document.getElementById('cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 1400);
camera.position.set(27, 21, 36);
const controles = new OrbitControls(camera, canvas);
Object.assign(controles, { enableDamping: true, dampingFactor: 0.08, minDistance: 7, maxDistance: 185, maxPolarAngle: 1.5 });
controles.target.set(0, 2, 0);

function ajustar() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', ajustar);
ajustar();

const mundo3d = criarMundo3D(scene);
const cidade = criarCidade(scene, mundo3d);
const moradores = criarMoradores(scene);
const avatar = criarAvatar(scene);

// ---------- estado do jogo ----------
let w = carregar() || criarMundo((Math.random() * 1e9) | 0);
let velocidade = 1, acumulado = 0, tempo = 0;
let ia = { ativa: false, modelo: null, ocupada: false };
let andando = false;
const teclas = new Set();

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
  carta: (c) => { aplicarEvento(w, { titulo: c.titulo, texto: c.texto, efeitos: c.efeitos }); espelhar(); },
  narrar,
  andar: alternarAndar,
  selecionar,
  novo: () => { localStorage.removeItem(CHAVE); location.reload(); },
});

function selecionar(info) {
  cidade.selecionar(info);
  ui.selecionar(info, w);
}

function espelhar(imediato = false) {
  cidade.sincronizar(w, tempo, imediato);
  moradores.sincronizar(w, cidade.posicoes());
  ui.atualizar(w, velocidade);
}

async function narrar(texto) {
  let ev = null;
  if (ia.ativa) {
    ui.aviso('A IA está interpretando a sua narração…');
    try {
      const r = await fetch('/api/evento', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto, resumo: resumoParaIA(w) }) });
      if (!r.ok) throw new Error((await r.json()).erro);
      ev = await r.json();
      ui.aviso('');
    } catch (e) {
      ui.aviso(`A IA não respondeu (${e.message}). Usei a carta mais parecida.`);
    }
  }
  if (!ev) {
    ev = interpretarTexto(texto);
    if (!ia.ativa) ui.aviso(`Sem IA, interpretei como “${ev.titulo}”. Com a IA ligada, qualquer situação vira efeito sob medida.`);
  }
  aplicarEvento(w, ev);
  espelhar();
}

async function reuniaoAnual() {
  if (!ia.ativa || ia.ocupada) return;
  ia.ocupada = true;
  try {
    const r = await fetch('/api/conselho', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resumo: resumoParaIA(w) }) });
    if (!r.ok) throw new Error((await r.json()).erro);
    aplicarDecisoes(w, await r.json());
    espelhar();
  } catch (e) {
    // Sem resposta, os atores voltam a seguir as regras até a próxima tentativa.
    w.ia = false;
    ui.aviso(`Agentes de IA indisponíveis (${e.message}); os atores seguem as regras por ora.`);
    setTimeout(() => { w.ia = ia.ativa; }, 60000);
  } finally { ia.ocupada = false; }
}

function aposMes(eraAntes) {
  if (w.era !== eraAntes) ui.novaEra(ERAS[w.era].nome);
  if (w.mes % 12 === 0) { salvar(); reuniaoAnual(); }
  espelhar();
}

// ---------- entrada ----------
let toque = null;
canvas.addEventListener('pointerdown', (e) => { toque = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!toque || Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 6) return;
  const raio = new THREE.Raycaster();
  raio.setFromCamera(new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1), camera);
  const hit = raio.intersectObjects(cidade.grupo.children, true)[0];
  let o = hit && hit.object;
  while (o && !o.userData.info) o = o.parent;
  selecionar(o ? o.userData.info : null);
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  teclas.add(k);
  if (k === 'v') alternarAndar();
  if (k === ' ') { velocidade = velocidade ? 0 : 1; ui.atualizar(w, velocidade); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));

function alternarAndar() {
  andando = !andando;
  avatar.visible = andando;
  if (andando) {
    const t = controles.target;
    const x = THREE.MathUtils.clamp(t.x, -70, 70), z = THREE.MathUtils.clamp(t.z, -70, 70);
    avatar.position.set(x, altura(x, z), z);
    Object.assign(controles, { minDistance: 4, maxDistance: 16, enablePan: false });
  } else Object.assign(controles, { minDistance: 7, maxDistance: 185, enablePan: true });
  ui.andando(andando);
}

const frente = new THREE.Vector3(), lado = new THREE.Vector3(), alvoCam = new THREE.Vector3();
function moverAvatar(dt) {
  camera.getWorldDirection(frente);
  frente.y = 0; frente.normalize();
  lado.set(-frente.z, 0, frente.x);
  const f = (teclas.has('w') || teclas.has('arrowup') ? 1 : 0) - (teclas.has('s') || teclas.has('arrowdown') ? 1 : 0);
  const l = (teclas.has('d') || teclas.has('arrowright') ? 1 : 0) - (teclas.has('a') || teclas.has('arrowleft') ? 1 : 0);
  const p = avatar.position;
  if (f || l) {
    const dx = frente.x * f + lado.x * l, dz = frente.z * f + lado.z * l, d = Math.hypot(dx, dz);
    const v = (teclas.has('shift') ? 9 : 5) * dt;
    const nx = p.x + (dx / d) * v, nz = p.z + (dz / d) * v;
    if (altura(nx, nz) > NIVEL_AGUA - 0.4 && Math.hypot(nx, nz) < 100) { p.x = nx; p.z = nz; }
    avatar.rotation.y = Math.atan2(dx, dz);
    p.y = altura(p.x, p.z) + Math.abs(Math.sin(tempo * 11)) * 0.08;
  } else p.y = altura(p.x, p.z);
  controles.target.lerp(alvoCam.set(p.x, p.y + 1.3, p.z), Math.min(1, dt * 8));
}

// ---------- laço ----------
const relogio = new THREE.Clock();
function quadro() {
  const dt = Math.min(relogio.getDelta(), 0.1);
  tempo += dt;
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
  controles.update();
  // A câmera nunca entra no chão nem sai do vale.
  const t = controles.target;
  if (Math.hypot(t.x, t.z) > 95) { const k = 95 / Math.hypot(t.x, t.z); t.x *= k; t.z *= k; }
  const chao = Math.max(altura(camera.position.x, camera.position.z), NIVEL_AGUA) + 1.2;
  if (camera.position.y < chao) camera.position.y = chao;

  mundo3d.atualizar(dt, tempo, w.mes + acumulado / SEGUNDOS_POR_MES);
  cidade.atualizar(dt, tempo, mundo3d.estado.noite);
  moradores.atualizar(dt, tempo, mundo3d.estado.noite);
  renderer.render(scene, camera);
  requestAnimationFrame(quadro);
}

// Para depuração e testes pelo console do navegador.
window.cidadeViva = {
  mundo: () => w,
  avancar(meses) { for (let i = 0; i < meses; i++) avancarMes(w); espelhar(true); },
  hora(h) { mundo3d.estado.hora = h; },
};

fetch('/api/status').then((r) => r.json()).catch(() => ({ ia: false })).then((s) => {
  ia.ativa = !!s.ia; ia.modelo = s.modelo; w.ia = ia.ativa;
  ui.ia(ia.ativa, ia.modelo);
});
ui.ia(false);
espelhar(true);
window.addEventListener('beforeunload', salvar);
quadro();
