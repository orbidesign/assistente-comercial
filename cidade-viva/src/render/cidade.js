// Liga a simulação ao 3D: cria, troca e remove prédios e moradores conforme o
// estado do mundo muda. O mundo é a única fonte de verdade; aqui só se espelha.
import * as THREE from 'three';
import { altura, NIVEL_AGUA, rioX } from '../sim/geo.js';
import { criarPredio, criarPraca, criarPonte } from './predios.js';
import { toon, cilindro, esfera, cone, caixa, aleatorio } from './base.js';

const saltinho = (t) => { const c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

export function criarCidade(scene, mundo3d) {
  const grupo = new THREE.Group();
  scene.add(grupo);
  const predios = new Map();
  const saindo = [];
  let praca = null, eraPraca = -1, ponte = null, sujo = 0, calcada = false;

  const anel = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.14, 6, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe07a }));
  anel.visible = false;
  scene.add(anel);

  function desejados(w) {
    const lista = [];
    for (const f of w.familias) lista.push({ chave: `c${f.id}`, classe: 'casa', id: f.id, nivel: f.nivelCasa, pos: f.pos });
    for (const n of w.negocios) lista.push({ chave: `n${n.id}`, classe: 'negocio', id: n.id, tipo: n.tipo, nivel: n.nivel, pos: n.pos });
    for (const p of w.estado.predios) if (p.pos) lista.push({ chave: `e${p.id}`, classe: 'estado', id: p.id, tipo: p.tipo, nivel: 1, pos: p.pos });
    return lista;
  }

  function sincronizar(w, tempo, imediato = false) {
    const lista = desejados(w);
    const novos = [];
    const chaves = new Map(lista.map((s) => [s.chave, s]));
    for (const [chave, p] of predios) {
      const s = chaves.get(chave);
      if (!s || s.nivel !== p.spec.nivel) {
        predios.delete(chave);
        if (s) grupo.remove(p.obj); else { p.fim = tempo; saindo.push(p); }
        sujo = 1;
      }
    }
    for (const s of lista) {
      if (predios.has(s.chave)) continue;
      const obj = criarPredio(s);
      obj.position.set(s.pos.x, altura(s.pos.x, s.pos.z) - 0.08, s.pos.z);
      obj.rotation.y = Math.atan2(-s.pos.x, -s.pos.z) + (aleatorio(s.id)() - 0.5) * 0.5;
      obj.userData.info = { classe: s.classe, id: s.id };
      obj.scale.setScalar(imediato ? 1 : 0.01);
      grupo.add(obj);
      predios.set(s.chave, { obj, spec: s, nasc: imediato ? -10 : tempo });
      mundo3d.limparArea(s.pos.x, s.pos.z, s.classe === 'casa' ? 4.2 : 7.5);
      if (!imediato) novos.push(s);
      sujo = 1;
    }
    if (eraPraca !== w.era) {
      if (praca) scene.remove(praca);
      praca = criarPraca(w.era);
      praca.position.y = altura(0, 0);
      praca.userData.anims = [];
      praca.traverse((o) => { if (o.userData.anim) praca.userData.anims.push(o.userData.anim); });
      scene.add(praca);
      mundo3d.limparArea(0, 0, 7);
      eraPraca = w.era;
    }
    if (w.era >= 1 && !ponte) {
      ponte = criarPonte();
      ponte.position.set(rioX(-12), NIVEL_AGUA, -12);
      scene.add(ponte);
      sujo = 1;
    }
    const temEstrada = w.estado.predios.some((p) => p.tipo === 'estrada');
    if (temEstrada !== calcada) { calcada = temEstrada; sujo = 1; }
    if (imediato) repintar();
    return novos;
  }

  function repintar() {
    sujo = 0;
    const pontos = [{ x: 0, z: 0, vx: 0, vz: 0 }];
    if (ponte) pontos.push({ x: ponte.position.x - 9, z: -12, vx: ponte.position.x + 9, vz: -12 }, { x: ponte.position.x - 9, z: -12, vx: 0, vz: 0 });
    const feitos = [{ x: 0, z: 0 }];
    for (const { spec } of predios.values()) {
      let perto = feitos[0], dmin = 1e9;
      for (const q of feitos) {
        const d = Math.hypot(q.x - spec.pos.x, q.z - spec.pos.z) + Math.hypot(q.x, q.z) * 0.35;
        if (d < dmin) { dmin = d; perto = q; }
      }
      pontos.push({ x: spec.pos.x, z: spec.pos.z, vx: perto.x, vz: perto.z });
      feitos.push(spec.pos);
    }
    mundo3d.pintarCaminhos(pontos, calcada);
  }

  function atualizar(dt, tempo, noite) {
    for (const p of predios.values()) {
      const idade = (tempo - p.nasc) / 0.9;
      if (idade < 1.05) p.obj.scale.setScalar(idade >= 1 ? 1 : Math.max(0.01, saltinho(idade)));
      for (const a of p.obj.userData.anims) a(tempo, noite);
    }
    for (let i = saindo.length - 1; i >= 0; i--) {
      const p = saindo[i], f = (tempo - p.fim) / 0.6;
      p.obj.scale.setScalar(Math.max(0.01, 1 - f));
      if (f >= 1) { grupo.remove(p.obj); saindo.splice(i, 1); }
    }
    if (praca) for (const a of praca.userData.anims) a(tempo, noite);
    if (sujo && (sujo += dt) > 1.6) repintar();
    if (anel.visible) anel.scale.setScalar(1 + Math.sin(tempo * 4) * 0.05);
  }

  function selecionar(info) {
    const chave = info && { casa: 'c', negocio: 'n', estado: 'e' }[info.classe] + info.id;
    const p = chave && predios.get(chave);
    anel.visible = !!p;
    if (p) anel.position.set(p.spec.pos.x, altura(p.spec.pos.x, p.spec.pos.z) + 0.25, p.spec.pos.z);
  }

  function limpar() {
    for (const p of predios.values()) grupo.remove(p.obj);
    for (const p of saindo) grupo.remove(p.obj);
    predios.clear(); saindo.length = 0;
    if (praca) scene.remove(praca);
    if (ponte) scene.remove(ponte);
    praca = ponte = null; eraPraca = -1; calcada = false; anel.visible = false;
  }

  return { grupo, sincronizar, atualizar, selecionar, limpar, posicoes: () => [...predios.values()].map((p) => p.spec.pos) };
}

// ---------- moradores ----------

const PELE = [0xf2c9a0, 0xd9a273, 0xa9714b, 0x7a4a2e, 0xf6d7b8];
const ROUPA = [0xc94f4f, 0x4f7fc9, 0x4fa86a, 0xd9a13a, 0x8a5fc9, 0xd97a3a, 0x3a9a9a, 0xb5b0a3, 0xc96a9a];

function figura(r, dono) {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.24, 0.62, 7), toon(dono ? 0x2f3340 : ROUPA[Math.floor(r() * ROUPA.length)]));
  corpo.position.y = 0.31;
  const cabeca = esfera(PELE[Math.floor(r() * PELE.length)], 0.16, 0, 0.76, 0);
  g.add(corpo, cabeca);
  if (dono) g.add(cilindro(0x22242c, 0.2, 0.03, 0, 0.88, 0), cilindro(0x22242c, 0.13, 0.22, 0, 0.9, 0));
  else if (r() < 0.45) g.add(cone(0xdcbb68, 0.27, 0.14, 0, 0.86, 0));
  else g.add(esfera([0x3a2a1e, 0x6b4a2e, 0xc9a25a, 0x1e1e22][Math.floor(r() * 4)], 0.165, 0, 0.8, -0.03));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Balõezinhos de emoji sobre a cabeça dos moradores.
const texturas = new Map();
function texturaEmoji(e) {
  if (!texturas.has(e)) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,250,235,.95)';
    g.beginPath(); g.arc(48, 44, 40, 0, 6.3); g.fill();
    g.beginPath(); g.moveTo(36, 78); g.lineTo(48, 96); g.lineTo(60, 78); g.fill();
    g.font = '50px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(e, 48, 47);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texturas.set(e, t);
  }
  return texturas.get(e);
}

export function criarMoradores(scene) {
  const grupo = new THREE.Group();
  scene.add(grupo);
  const gente = new Map();
  let pontos = [];

  function sincronizar(w, posicoes) {
    pontos = posicoes;
    const querem = new Map();
    for (const f of w.familias) {
      const q = Math.min(2, Math.ceil(f.membros / 3));
      for (let i = 0; i < q && querem.size < 150; i++) querem.set(`${f.id}-${i}`, f);
    }
    for (const [k, m] of gente) if (!querem.has(k)) { grupo.remove(m.g); gente.delete(k); }
    for (const [k, f] of querem) {
      const dono = f.dono > 0 && k.endsWith('-0');
      let m = gente.get(k);
      if (m && m.dono !== dono) { grupo.remove(m.g); gente.delete(k); m = null; }
      if (!m) {
        const r = aleatorio(f.id * 31 + k.length + (k.endsWith('-1') ? 7 : 0));
        m = { g: figura(r, dono), dono, fase: r() * 6.28, vel: 1.3 + r() * 0.8, espera: r() * 4, alvo: null, r };
        m.g.position.set(f.pos.x, 0, f.pos.z);
        m.g.userData.info = { classe: 'casa', id: f.id };
        grupo.add(m.g);
        gente.set(k, m);
      }
      m.casa = f.pos;
      const n = f.emprego ? w.negocios.find((q) => q.id === f.emprego) : f.dono ? w.negocios.find((q) => q.dono === f.id) : null;
      m.trab = n ? n.pos : null;
    }
  }

  function novoAlvo(m) {
    const s = m.r();
    if (m.trab && s < 0.5) return { x: m.trab.x + (m.r() - 0.5) * 3, z: m.trab.z + 2.5 };
    if (s < 0.72) { const a = m.r() * 6.28; return { x: Math.cos(a) * 3.5, z: Math.sin(a) * 3.5 }; }
    if (s < 0.88 && pontos.length) { const p = pontos[Math.floor(m.r() * pontos.length)]; return { x: p.x + 2, z: p.z + 2 }; }
    return { x: m.casa.x, z: m.casa.z + 1.8 };
  }

  function emote(emoji, quantos = 6, familiaId = null) {
    const acordados = [...gente.entries()].filter(([k, m]) => m.g.visible && !m.balao && (familiaId === null || k.startsWith(`${familiaId}-`)));
    for (let i = 0; i < quantos && acordados.length; i++) {
      const [, m] = acordados.splice(Math.floor(Math.random() * acordados.length), 1)[0];
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaEmoji(emoji), depthWrite: false, transparent: true }));
      sp.position.y = 1.7;
      m.g.add(sp);
      m.balao = { sp, t: 0, dur: 3.2 + Math.random() * 1.5 };
    }
  }

  function atualizar(dt, tempo, noite) {
    for (const m of gente.values()) {
      if (m.balao) {
        const b = m.balao;
        b.t += dt;
        const s = Math.min(1, b.t * 5, (b.dur - b.t) * 4) * 1.15;
        b.sp.scale.setScalar(Math.max(0.01, s));
        b.sp.position.y = 1.7 + Math.sin(b.t * 3) * 0.06;
        if (b.t >= b.dur || !m.g.visible) { m.g.remove(b.sp); b.sp.material.dispose(); m.balao = null; }
      }
      const p = m.g.position;
      const dormir = noite > 0.75;
      if (dormir && !m.dormindo) { m.alvo = { x: m.casa.x, z: m.casa.z }; m.dormindo = true; }
      if (!dormir && m.dormindo) { m.dormindo = false; m.g.visible = true; m.alvo = null; m.espera = m.r() * 5; }
      if (!m.alvo) {
        if ((m.espera -= dt) > 0) continue;
        m.alvo = novoAlvo(m);
      }
      const dx = m.alvo.x - p.x, dz = m.alvo.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.35) {
        if (m.dormindo) m.g.visible = false;
        else { m.alvo = null; m.espera = 1.5 + m.r() * 6; }
        continue;
      }
      const passo = Math.min(d, m.vel * dt);
      const nx = p.x + (dx / d) * passo, nz = p.z + (dz / d) * passo;
      const h = altura(nx, nz);
      if (h < NIVEL_AGUA + 0.25) { m.alvo = { x: m.casa.x, z: m.casa.z + 1.8 }; if (Math.hypot(m.casa.x - p.x, m.casa.z - p.z) < 1) m.alvo = null; continue; }
      p.set(nx, h + Math.abs(Math.sin(tempo * 10 + m.fase)) * 0.07, nz);
      m.g.rotation.y = Math.atan2(dx, dz);
    }
  }

  function limpar() { for (const m of gente.values()) grupo.remove(m.g); gente.clear(); }

  return { grupo, sincronizar, atualizar, emote, limpar };
}

// Avatar do narrador, para descer e andar pela cidade.
export function criarAvatar(scene) {
  const g = new THREE.Group();
  const manto = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 1.05, 8), toon(0x3d5fa8));
  manto.position.y = 0.52;
  g.add(manto, esfera(0xf2c9a0, 0.22, 0, 1.2, 0), cone(0x3d5fa8, 0.3, 0.5, 0, 1.25, 0), caixa(0xe0b23a, 0.5, 0.08, 0.08, 0, 0.95, 0.2));
  const cajado = cilindro(0x7a5536, 0.035, 1.7, 0.42, 0, 0.1);
  g.add(cajado, esfera(0xffe07a, 0.1, 0.42, 1.75, 0.1));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.visible = false;
  scene.add(g);
  return g;
}
