// Cidade brasileira contemporânea: casas de alvenaria com telha cerâmica,
// prédios, comércio de rua, galpões, escola, posto de saúde, prefeitura,
// praça com igreja matriz e coreto.
import * as THREE from 'three';
import { toon, matJanela, caixa, cilindro, cone, piramide, esfera, prisma, fundir, aleatorio } from './base.js';

const TELHA = 0xb5593f, MURO = 0xd9d4c7, ASFALTO = 0x6f6f75, CONCRETO = 0xbfbcb4;
const CORES_CASA = [0xf2e6c8, 0xf7d9c0, 0xcfe3d6, 0xd7e3f2, 0xf5efdf, 0xf2c9b0, 0xe6e0a8];
const CORES_POP = [0xe88a6a, 0x6fb3a0, 0x6f9fd0, 0xe6c04a, 0xd98ab0, 0x9fc46a];
const CORES_PREDIO = [0xe9e4d8, 0xcfd8e0, 0xe8d9c2, 0xd6e2d6, 0xc9c4bc, 0xe0cfc4];
const CORES_LOJA = [0xd64a4a, 0x3f7fd0, 0xe0a83a, 0x3fa56a, 0x8a5fc9, 0xe07a3a];
const vivo = (...f) => { const g = new THREE.Group(); g.userData.vivo = true; if (f.length) g.add(...f); return g; };
const jan = (x, y, z, w = 0.55, h = 0.55, lado = false) => (lado ? caixa(matJanela, 0.06, h, w, x, y, z) : caixa(matJanela, w, h, 0.06, x, y, z));
const pick = (l, r) => l[Math.floor(r() * l.length)];

function bandeira(x, y, z, cor = 0x2f9a4a) {
  const pano = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85, 6, 1).translate(0.65, 0, 0), toon(cor, { side: THREE.DoubleSide }));
  const g = vivo(pano, (() => { const l = esfera(0xf5d33a, 0.2, 0.62, 0, 0.02); l.scale.set(0.3, 0.22, 0.02); return l; })());
  g.position.set(x, y, z);
  const p = pano.geometry.attributes.position;
  g.userData.anim = (t) => { for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 4 + p.getX(i) * 4) * 0.1 * p.getX(i)); p.needsUpdate = true; };
  return g;
}

function palmeira(g, x, z, h = 3.4) {
  g.add(cilindro(0x9a7b55, 0.12, h, x, 0, z));
  for (let i = 0; i < 6; i++) { const f = cone(0x3f9a4a, 0.22, 1.5, 0, 0, 0); f.position.set(x + Math.cos(i * 1.05) * 0.6, h + 0.1, z + Math.sin(i * 1.05) * 0.6); f.rotation.set(Math.sin(i * 1.05) * 1.25, 0, -Math.cos(i * 1.05) * 1.25); g.add(f); }
}

const M = {
  casa_simples(g, n, r) {
    g.add(caixa(pick(CORES_POP, r), 2.5, 1.5, 2.6), piramide(TELHA, 3.1, 0.7, 3.2, 0, 1.5), caixa(0x6b4a2e, 0.55, 1, 0.08, -0.5, 0, 1.31), jan(0.55, 0.7, 1.31));
    g.add(caixa(0x3f7fd0, 0.5, 0.45, 0.5, 0.7, 2, -0.6), caixa(MURO, 3.4, 0.5, 0.1, 0, 0, 2.1));
  },
  casa(g, n, r) {
    g.add(caixa(pick(CORES_CASA, r), 3.2, 1.7, 3), piramide(TELHA, 3.9, 0.9, 3.7, 0, 1.7), caixa(0x5d4028, 0.6, 1.1, 0.08, -0.9, 0, 1.51), jan(0.1, 0.8, 1.51), jan(1.0, 0.8, 1.51));
    g.add(caixa(0x8a8a90, 1.3, 1, 0.08, 1.7, 0, 2.4), caixa(MURO, 1.9, 0.9, 0.1, -1.1, 0, 2.4), caixa(MURO, 0.1, 0.9, 2.4, -2.05, 0, 1.2), esfera(0x3f9a4a, 0.4, -1.3, 0.4, 2));
  },
  sobrado(g, n, r) {
    const c = pick(CORES_CASA, r);
    g.add(caixa(c, 3.2, 3.3, 3), piramide(TELHA, 3.9, 0.9, 3.7, 0, 3.3), caixa(0x5d4028, 0.6, 1.1, 0.08, -0.9, 0, 1.51), caixa(0x8a8a90, 1.3, 1.1, 0.08, 0.7, 0, 1.51));
    g.add(jan(-0.8, 2.3, 1.51), jan(0.8, 2.3, 1.51), caixa(CONCRETO, 3.2, 0.1, 0.7, 0, 1.75, 1.8), caixa(0x3a3a40, 3.2, 0.5, 0.05, 0, 1.85, 2.15), caixa(MURO, 3.8, 0.9, 0.1, 0, 0, 2.6));
  },
  predio(g, n, r, spec) {
    const cor = pick(CORES_PREDIO, r), h = n * 1.05, l = 3.4 + r() * 0.8;
    g.add(caixa(spec.cor ?? pick(CORES_LOJA, r), l + 0.2, 1.2, l + 0.2), caixa(cor, l, h, l, 0, 1.2));
    if (spec.cor !== undefined) g.add(caixa(spec.cor, l + 0.15, 0.9, l + 0.15, 0, 1.2 + h - 0.9));
    for (let a = 0; a < n; a++) {
      g.add(caixa(matJanela, l * 0.82, 0.5, 0.06, 0, 1.55 + a * 1.05, l / 2 + 0.01), caixa(matJanela, 0.06, 0.5, l * 0.82, l / 2 + 0.01, 1.55 + a * 1.05, 0), caixa(matJanela, 0.06, 0.5, l * 0.82, -l / 2 - 0.01, 1.55 + a * 1.05, 0));
      if (a % 2 === 0) g.add(caixa(CONCRETO, 1, 0.08, 0.5, -l * 0.2, 1.3 + a * 1.05, l / 2 + 0.25));
    }
    g.add(caixa(CONCRETO, l + 0.2, 0.25, l + 0.2, 0, 1.2 + h), caixa(0x8a8a90, 1.1, 0.8, 1.1, 0.6, 1.45 + h, -0.5), cilindro(0x3f7fd0, 0.4, 0.6, -0.8, 1.45 + h, 0.6));
  },
  comercio(g, n, r, spec) {
    const c = spec.cor ?? pick(CORES_LOJA, r);
    g.add(caixa(0xf2ede0, 3.6, 2.2, 3), caixa(c, 3.7, 0.6, 0.15, 0, 2.2, 1.5), caixa(c, 3.6, 0.08, 1, 0, 1.75, 2), caixa(matJanela, 1.6, 1.2, 0.06, 0.7, 0.2, 1.51), caixa(0x8a8a90, 0.9, 1.5, 0.08, -1, 0, 1.51));
    g.add(caixa(CONCRETO, 3.8, 0.15, 3.2, 0, 2.8), caixa(0x8a8a90, 0.8, 0.5, 0.8, -1, 2.95, -0.5));
    // Loja de uma das três marcas: totem alto na cor da rede, para achar de longe.
    if (spec.cor !== undefined) g.add(cilindro(0xe9e4d8, 0.09, 6.5, 2.3, 0, 2), caixa(c, 1.6, 1.1, 0.25, 2.3, 6.5, 2), caixa(0xffffff, 1.2, 0.3, 0.28, 2.3, 6.9, 2));
  },
  galpao(g, n, r, spec) {
    const teto = cilindro(0x9aa3ad, 2.2, 6.4, 0, 0, 0);
    teto.rotation.z = Math.PI / 2; teto.position.set(0, 2.4, 0); teto.scale.y = 0.45;
    g.add(caixa(pick([0xd9dde2, 0xcfd6c9, 0xe0d6c4], r), 6.4, 2.4, 4.4), teto, caixa(0x4a6fa5, 1.8, 1.9, 0.08, -1.4, 0, 2.21), caixa(spec.cor ?? 0x3a3a40, 6.4, spec.cor !== undefined ? 0.7 : 0.3, 0.06, 0, 1.7, 2.22));
    g.add(cilindro(0xc9ced6, 0.3, 4.2, 2.6, 0, -1.4), caixa(0xf2f2f2, 2.2, 1.1, 1, 2, 0.3, 3.4), caixa(0x3f7fd0, 0.7, 0.9, 1, 3.4, 0.3, 3.4));
    if (n > 1) g.add(caixa(0xd9dde2, 3, 1.8, 2.4, -5, 0, -0.8));
  },
  escola(g) {
    g.add(caixa(0xf2d24a, 6.4, 2.1, 2.8), caixa(TELHA, 6.8, 0.25, 3.2, 0, 2.1), caixa(0x3f7fd0, 6.4, 0.35, 0.08, 0, 1.7, 1.41), caixa(0x5d4028, 0.8, 1.2, 0.08, -2.4, 0, 1.41));
    for (let i = 0; i < 4; i++) g.add(jan(-1 + i * 0.95, 0.8, 1.41, 0.6, 0.7));
    g.add(caixa(0x3fa56a, 4.6, 0.06, 3, 0.6, 0.02, 4), caixa(0xffffff, 4.6, 0.07, 0.08, 0.6, 0.02, 4), caixa(0xffffff, 0.08, 0.07, 3, 0.6, 0.02, 4));
    for (const x of [-1.6, 2.8]) g.add(cilindro(0xf2f2f2, 0.05, 1.6, x, 0, 4), caixa(0xf2f2f2, 0.5, 0.35, 0.05, x, 1.3, 4));
    g.add(cilindro(0xc9ced6, 0.05, 3.6, -3.6, 0, 2.2), bandeira(-3.6, 3.1, 2.2));
  },
  ubs(g) {
    g.add(caixa(0xffffff, 4.4, 1.9, 3), caixa(0x3fa56a, 4.5, 0.4, 3.1, 0, 1.9), caixa(matJanela, 1.4, 1.2, 0.06, -0.9, 0, 1.51), jan(1, 0.8, 1.51), caixa(0x3fa56a, 0.25, 0.8, 0.08, 1.7, 2.4, 1.5), caixa(0x3fa56a, 0.8, 0.25, 0.08, 1.7, 2.68, 1.5));
    g.add(caixa(0xf2f2f2, 1.4, 0.7, 0.7, -2.6, 0.2, 2.6), caixa(0xd64a4a, 1.4, 0.1, 0.72, -2.6, 0.55, 2.6));
  },
  hospital(g) {
    g.add(caixa(0xf7f7f5, 6, 4.2, 3.6), caixa(0x4a8fd6, 6.1, 0.4, 3.7, 0, 4.2), caixa(0xf7f7f5, 2.4, 1.3, 1.4, 0, 0, 2.4), caixa(0xd64a4a, 0.3, 1, 0.08, 2.2, 4.8, 1.8), caixa(0xd64a4a, 1, 0.3, 0.08, 2.2, 5.15, 1.8));
    for (let a = 0; a < 3; a++) g.add(caixa(matJanela, 5.2, 0.55, 0.06, 0, 1.6 + a * 1.1, 1.81));
    g.add(cilindro(0xc9ced6, 1.1, 0.08, -2, 4.6, -0.6));
  },
  prefeitura(g) {
    g.add(caixa(CONCRETO, 6.6, 0.5, 4.4), caixa(0xf5efdf, 6, 2.8, 3.6, 0, 0.5, -0.2), prisma(0xe6dfcf, 3.6, 0.9, 1, 0, 3.3, 1.5), caixa(TELHA, 6.3, 0.3, 3.9, 0, 3.3, -0.2));
    for (let i = 0; i < 4; i++) g.add(cilindro(0xffffff, 0.18, 2.8, -1.35 + i * 0.9, 0.5, 1.9));
    g.add(caixa(0x5d4028, 1, 1.6, 0.08, 0, 0.5, 1.61), jan(-2.2, 1.7, 1.61), jan(2.2, 1.7, 1.61), cilindro(0xc9ced6, 0.05, 4.4, 3.6, 0, 2), bandeira(3.6, 3.8, 2));
  },
  guarda(g) {
    g.add(caixa(0xe9eef5, 3.4, 1.9, 2.8), caixa(0x2f4f8a, 3.5, 0.35, 2.9, 0, 1.9), caixa(0x2f4f8a, 3.4, 0.3, 0.06, 0, 1.2, 1.41), caixa(0x5d4028, 0.7, 1.1, 0.08, -0.8, 0, 1.41), jan(0.7, 0.75, 1.41));
    g.add(cilindro(0x8a8a90, 0.06, 4.6, 2.2, 0, 1.4), caixa(0x22242c, 0.35, 0.2, 0.2, 2.2, 4.5, 1.5), caixa(0xf2f2f2, 1.9, 0.6, 0.9, -0.2, 0.2, 2.7), caixa(0x2f4f8a, 1.9, 0.12, 0.92, -0.2, 0.5, 2.7));
  },
  parque(g, n, r) {
    const lago = cilindro(0x4aa6e8, 2.6, 0.06, 0, 0.03, 0); lago.scale.z = 1.7;
    g.add(lago, caixa(0x8a623f, 1.4, 0.3, 0.4, 2.8, 0, 2.4), caixa(0xd9c7a0, 7, 0.05, 0.6, 0, 0.02, 3.2));
    for (let i = 0; i < 5; i++) { const a = i * 1.3; g.add(cilindro(0x7a5536, 0.12, 1.4, Math.cos(a) * 3.6, 0, Math.sin(a) * 3), esfera(0x3f9a4a, 0.9, Math.cos(a) * 3.6, 2, Math.sin(a) * 3)); }
    palmeira(g, -3, 3.4, 3);
  },
  saneamento(g) {
    for (const x of [-1.8, 1.8]) g.add(cilindro(CONCRETO, 1.5, 0.9, x, 0, 0), cilindro(0x4a8a9a, 1.3, 0.06, x, 0.88, 0));
    g.add(caixa(0xe9eef5, 2, 1.6, 1.6, 0, 0, -2.6), caixa(0x3f7fd0, 2.1, 0.3, 1.7, 0, 1.6, -2.6), cilindro(0x3f7fd0, 0.9, 3.4, 4, 0, -2), cone(0x3f7fd0, 0.95, 0.5, 4, 3.4, -2));
  },
  polo(g) {
    g.add(caixa(0x9fc9e8, 5, 4.4, 3.4), caixa(0xf2f2f2, 5.2, 0.3, 3.6, 0, 4.4), caixa(0xf2f2f2, 5.2, 0.15, 3.6, 0, 1.4), caixa(0xf2f2f2, 5.2, 0.15, 3.6, 0, 2.9));
    for (let i = 0; i < 5; i++) g.add(caixa(0x2a3a5a, 0.9, 0.06, 1.6, -2 + i, 4.75, 0));
    g.add(caixa(matJanela, 1.4, 1.2, 0.06, 0, 0, 1.71));
  },
};

export function criarPredioBR(spec) {
  const r = aleatorio(spec.id * 7919 + 31);
  const g = new THREE.Group();
  // Em lote de marca, o nível vem multiplicado por 100 (ver cidadeDosCEOs).
  const nivel = spec.cor !== undefined ? Math.floor(spec.nivel / 100) : spec.nivel || 1;
  (M[spec.tipo] || M.casa)(g, nivel, r, spec);
  const raiz = new THREE.Group();
  raiz.add(g);
  fundir(raiz);
  const anims = [];
  raiz.traverse((o) => { if (o.userData.anim) anims.push(o.userData.anim); });
  raiz.userData.anims = anims;
  return raiz;
}

// Praça da matriz: igreja, coreto, bancos, palmeiras e um chafariz.
export function criarPracaBR() {
  const g = new THREE.Group();
  g.add(cilindro(0xd9d4c7, 6.2, 0.08, 0, 0, 0));
  g.add(caixa(0xf7f2e4, 3, 3, 4.6, -3.2, 0, -3.2), prisma(TELHA, 3.4, 1.2, 4.8, -3.2, 3, -3.2), caixa(0xf7f2e4, 1.5, 5.6, 1.5, -3.2, 0, -0.4), piramide(0x3f6aa8, 1.9, 1.5, 1.9, -3.2, 5.6, -0.4));
  g.add(caixa(0xe0b23a, 0.12, 0.9, 0.12, -3.2, 7.1, -0.4), caixa(0xe0b23a, 0.5, 0.12, 0.12, -3.2, 7.6, -0.4), caixa(0x5d4028, 0.8, 1.4, 0.08, -3.2, 0, 0.36), jan(-3.2, 3.6, 0.36, 0.5, 0.9));
  g.add(cilindro(0xf2ede0, 1.5, 0.35, 2.6, 0, 1.6), cone(0x3f8a7a, 1.9, 0.9, 2.6, 2.2, 1.6));
  for (let i = 0; i < 6; i++) g.add(cilindro(0xffffff, 0.07, 1.9, 2.6 + Math.cos(i * 1.05) * 1.3, 0.35, 1.6 + Math.sin(i * 1.05) * 1.3));
  g.add(cilindro(CONCRETO, 1.1, 0.4, 1.4, 0, -2.6), cilindro(0x4aa6e8, 0.95, 0.06, 1.4, 0.38, -2.6), cilindro(CONCRETO, 0.15, 1, 1.4, 0.4, -2.6));
  for (const a of [0.4, 2, 3.5, 5.1]) { const b = caixa(0x8a623f, 1.3, 0.3, 0.4, Math.cos(a) * 4.6, 0.05, Math.sin(a) * 4.6); b.rotation.y = -a + Math.PI / 2; g.add(b); }
  palmeira(g, 4.6, -1.2, 4.2); palmeira(g, 0.2, 4.8, 3.8); palmeira(g, -0.8, -5.2, 4);
  const jato = vivo(cone(0xbfe6ff, 0.15, 0.8, 1.4, 1.4, -2.6));
  jato.userData.anim = (t) => { jato.scale.y = 0.85 + Math.sin(t * 5) * 0.15; };
  g.add(jato);
  return fundir(g);
}
