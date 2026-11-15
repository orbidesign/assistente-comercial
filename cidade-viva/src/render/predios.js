// Modelos procedurais dos prédios. Cada função monta peças simples; no fim
// `fundir` junta tudo em poucas malhas. Partes animadas ficam em grupos "vivos".
import * as THREE from 'three';
import { toon, matJanela, matFogo, caixa, cilindro, cone, piramide, esfera, prisma, fundir, aleatorio } from './base.js';

const TELHADOS = [0xb5523b, 0xc96a3a, 0x4f6d8f, 0x3f8a7a, 0x8a4f6d, 0xa8563a, 0x56708f];
const PAREDES = [0xf1e3c2, 0xe8d3b0, 0xf4ead8, 0xe2c9a6, 0xd9dfd2];
const MADEIRA = 0x8a623f, MADEIRA_ESC = 0x5d4028, PEDRA = 0xb5afa3, PEDRA_ESC = 0x8e897f, PALHA = 0xdcbb68, TIJOLO = 0xb5593f;

const vivo = (...filhos) => { const g = new THREE.Group(); g.userData.vivo = true; if (filhos.length) g.add(...filhos); return g; };
const janela = (x, y, z, w = 0.5, h = 0.55, lado = false) => (lado ? caixa(matJanela, 0.08, h, w, x, y, z) : caixa(matJanela, w, h, 0.08, x, y, z));
const porta = (x, z, h = 1) => caixa(MADEIRA_ESC, 0.55, h, 0.1, x, 0, z);

// Fumaça: três bolinhas que sobem e somem em laço.
function fumaca(x, y, z, cor = 0xdedede) {
  const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.5, depthWrite: false });
  const bolas = [0, 1, 2].map(() => new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), mat));
  const g = vivo(...bolas);
  g.position.set(x, y, z);
  g.userData.anim = (t) => bolas.forEach((b, i) => {
    const f = (t * 0.35 + i / 3) % 1;
    b.position.set(Math.sin(f * 5 + i) * 0.3 + f * 0.8, f * 2.6, 0);
    b.scale.setScalar(0.5 + f * 1.1);
    b.visible = f < 0.92;
  });
  return g;
}

function chamine(g, x, y, z, h = 0.9, cor = PEDRA_ESC) {
  g.add(caixa(cor, 0.4, h, 0.4, x, y, z), fumaca(x, y + h + 0.1, z));
}

function arbusto(g, r, raio) {
  const a = r() * 6.28;
  g.add(esfera(0x4f9a3c, 0.35 + r() * 0.2, Math.cos(a) * raio, 0.3, Math.sin(a) * raio));
}

function casa(nivel, r) {
  const g = new THREE.Group();
  const telhado = TELHADOS[Math.floor(r() * TELHADOS.length)];
  const parede = PAREDES[Math.floor(r() * PAREDES.length)];
  if (nivel === 0) {
    g.add(caixa(MADEIRA, 2.1, 1.2, 1.9), piramide(PALHA, 3, 1.3, 2.8, 0, 1.2), porta(0, 0.96, 0.85));
    g.add(cilindro(MADEIRA_ESC, 0.5, 0.25, 1.9, 0, 0.6), cone(matFogo, 0.18, 0.4, 1.9, 0.25, 0.6));
  } else if (nivel === 1) {
    g.add(caixa(parede, 2.7, 1.7, 2.3), prisma(telhado, 3.2, 1.3, 2.9, 0, 1.7));
    for (const sx of [-1.33, 1.33]) g.add(caixa(MADEIRA_ESC, 0.12, 1.7, 0.12, sx, 0, 1.13));
    g.add(porta(0.5, 1.16), janela(-0.6, 0.75, 1.16));
    chamine(g, -0.8, 2.2, -0.4);
    arbusto(g, r, 2.2);
  } else if (nivel === 2) {
    g.add(caixa(PEDRA, 3.2, 0.7, 2.8), caixa(parede, 3.1, 1.6, 2.7, 0, 0.7), prisma(telhado, 3.7, 1.6, 3.3, 0, 2.3));
    g.add(porta(0, 1.41, 1.15), janela(-1, 1, 1.36), janela(1, 1, 1.36), janela(1.56, 1, 0, 0.5, 0.55, true));
    g.add(caixa(0xd65a6f, 0.6, 0.14, 0.2, -1, 0.82, 1.46), caixa(0xffd24a, 0.6, 0.14, 0.2, 1, 0.82, 1.46));
    chamine(g, 1, 3, -0.5, 1.1);
    arbusto(g, r, 2.6); arbusto(g, r, 2.7);
  } else {
    g.add(caixa(PEDRA, 3.3, 0.6, 3), caixa(parede, 3.2, 3.2, 2.9, 0, 0.6), prisma(telhado, 3.8, 1.7, 3.5, 0, 3.8));
    for (const sx of [-1.6, 0, 1.6]) g.add(caixa(MADEIRA_ESC, 0.13, 3.2, 0.13, sx, 0.6, 1.47));
    g.add(caixa(MADEIRA_ESC, 3.3, 0.13, 0.13, 0, 2.15, 1.47));
    g.add(porta(-0.8, 1.5, 1.25), janela(0.8, 1.1, 1.47), janela(-0.8, 2.75, 1.47), janela(0.8, 2.75, 1.47));
    g.add(caixa(MADEIRA, 1.5, 0.1, 0.55, 0.8, 2.25, 1.75), caixa(MADEIRA_ESC, 1.5, 0.4, 0.06, 0.8, 2.35, 2));
    chamine(g, -1, 4.6, -0.6, 1.2);
    arbusto(g, r, 2.8); arbusto(g, r, 2.9); arbusto(g, r, 2.7);
  }
  return g;
}

function campo(g, cor, x, z, linhas = 5) {
  g.add(caixa(0x7a5a3a, 5.2, 0.08, linhas * 0.9 + 0.4, x, 0.02, z));
  for (let i = 0; i < linhas; i++) g.add(caixa(cor, 4.8, 0.35, 0.35, x, 0.08, z - (linhas - 1) * 0.45 + i * 0.9));
  for (let i = -2; i <= 2; i++) g.add(caixa(MADEIRA, 0.1, 0.6, 0.1, x + i * 1.3, 0, z + linhas * 0.45 + 0.4));
  g.add(caixa(MADEIRA, 5.3, 0.08, 0.06, x, 0.42, z + linhas * 0.45 + 0.4));
}

const NEG = {
  fazenda(g, n, r) {
    g.add(caixa(0xb04a3a, 3.2, 2.2, 2.6), prisma(0x6b3a2e, 3.6, 1.4, 3.1, 0, 2.2), caixa(0xf4ead8, 1.1, 1.5, 0.1, 0, 0, 1.31));
    g.add(caixa(0xf4ead8, 3.3, 0.14, 0.1, 0, 2.1, 1.31));
    campo(g, r() < 0.5 ? 0xe4c44a : 0x79b84a, 4.6, 0.5, 4 + n);
    g.add(cilindro(PALHA, 0.45, 0.6, -2.4, 0, 1.2), cilindro(PALHA, 0.45, 0.6, -2.9, 0, 0.3));
    if (n >= 2) g.add(cilindro(PEDRA, 0.8, 3.2, -2.6, 0, -1), cone(0x6b3a2e, 0.95, 0.9, -2.6, 3.2, -1));
  },
  serraria(g, n) {
    for (const [x, z] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) g.add(caixa(MADEIRA_ESC, 0.2, 2, 0.2, x, 0, z));
    g.add(prisma(0x7a5536, 4, 1.1, 3.2, 0, 2), caixa(MADEIRA, 2.2, 0.7, 0.9, 0, 0, 0));
    const serra = vivo(cilindro(0xc9ced6, 0.55, 0.06, 0, 0, 0));
    serra.rotation.x = Math.PI / 2; serra.position.set(0, 0.95, 0);
    serra.userData.anim = (t) => { serra.rotation.y = t * 6; };
    g.add(serra);
    for (let i = 0; i < 3 + n * 2; i++) {
      const tora = cilindro(0x9c6b3e, 0.22, 2.4, 0, 0, 0);
      tora.rotation.z = Math.PI / 2; tora.position.set(3, 0.22 + Math.floor(i / 3) * 0.42, -0.6 + (i % 3) * 0.5);
      g.add(tora);
    }
  },
  oficina(g) {
    g.add(caixa(PEDRA, 3, 2, 2.6), prisma(0x5a4a44, 3.5, 1.2, 3.1, 0, 2), porta(-0.6, 1.31, 1.2), janela(0.7, 0.9, 1.31));
    g.add(caixa(PEDRA_ESC, 0.9, 3.4, 0.9, 1.2, 0, -1), fumaca(1.2, 3.5, -1, 0x9a9a9a));
    g.add(caixa(0x3a3a40, 0.6, 0.4, 0.3, -1.9, 0.5, 1.2), caixa(MADEIRA_ESC, 0.3, 0.5, 0.3, -1.9, 0, 1.2), cone(matFogo, 0.2, 0.35, 0.7, 0.3, 1.5));
  },
  venda(g, n, r) {
    const lona = [0xd65a4a, 0x4a8fd6, 0xe0a83a][Math.floor(r() * 3)];
    g.add(caixa(0xf1e3c2, 3, 2, 2.4), prisma(0xa8563a, 3.5, 1.2, 2.9, 0, 2), porta(-0.8, 1.21, 1.1), janela(0.6, 0.8, 1.21, 1, 0.7));
    for (let i = 0; i < 5; i++) g.add(caixa(i % 2 ? 0xffffff : lona, 0.62, 0.08, 1.1, -1.24 + i * 0.62, 1.55, 1.75));
    g.add(caixa(MADEIRA, 0.5, 0.5, 0.5, 1.9, 0, 1.2), caixa(MADEIRA, 0.4, 0.4, 0.4, 1.9, 0.5, 1.2), cilindro(0x8a5a3a, 0.28, 0.6, 2.3, 0, 0.5));
    g.add(esfera(0xe0483a, 0.14, 0.3, 0.75, 1.7), esfera(0xf0c23a, 0.14, 0.7, 0.75, 1.7), esfera(0x6fbf4a, 0.14, 1.1, 0.75, 1.7), caixa(MADEIRA, 1.3, 0.65, 0.5, 0.7, 0, 1.7));
  },
  moinho(g) {
    const torre = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 4.2, 10), toon(0xf1e3c2));
    torre.position.y = 2.1; torre.castShadow = true;
    g.add(torre, cone(0xa8563a, 1.4, 1.3, 0, 4.2, 0), porta(0, 1.55, 1.1), janela(0, 2.6, 1.28, 0.4, 0.5));
    const pas = vivo();
    for (let i = 0; i < 4; i++) {
      const pa = new THREE.Group();
      pa.add(caixa(MADEIRA_ESC, 0.12, 2.6, 0.08, 0, 0.2, 0), caixa(0xf4ead8, 0.7, 2, 0.04, 0.35, 0.7, 0));
      pa.rotation.z = (i * Math.PI) / 2;
      pas.add(pa);
    }
    pas.position.set(0, 3.5, 1.45);
    pas.userData.anim = (t) => { pas.rotation.z = t * 0.9; };
    g.add(pas);
  },
  taverna(g) {
    g.add(caixa(PEDRA, 3.8, 0.6, 3), caixa(0xe8d3b0, 3.7, 2.2, 2.9, 0, 0.6), prisma(0x8a4f6d, 4.3, 1.7, 3.5, 0, 2.8));
    g.add(porta(0, 1.5, 1.2), janela(-1.2, 1.2, 1.46, 0.7, 0.7), janela(1.2, 1.2, 1.46, 0.7, 0.7));
    g.add(caixa(MADEIRA_ESC, 0.1, 0.1, 0.9, 1.95, 2.3, 1.7), caixa(0xe0a83a, 0.08, 0.6, 0.7, 1.95, 1.6, 1.9));
    g.add(cilindro(0x8a5a3a, 0.33, 0.7, -2.3, 0, 1), cilindro(0x8a5a3a, 0.33, 0.7, -2.4, 0, 0.2));
    chamine(g, -1.2, 3.6, -0.6, 1.2);
  },
  tecelagem(g) {
    g.add(caixa(TIJOLO, 5.4, 2.4, 3), prisma(0x5a4a44, 2.9, 1.1, 3.3, -1.35, 2.4), prisma(0x5a4a44, 2.9, 1.1, 3.3, 1.35, 2.4));
    for (let i = -2; i <= 2; i++) g.add(janela(i * 1, 1.2, 1.51, 0.6, 0.9));
    g.add(porta(2.3, 1.52, 1.3));
    for (const c of [0xd65a6f, 0x4a8fd6, 0xe0a83a]) g.add(caixa(c, 0.5, 0.4, 0.8, -3.2, c === 0x4a8fd6 ? 0.4 : 0, c === 0xe0a83a ? 0.9 : 0));
  },
  banco(g) {
    g.add(caixa(PEDRA, 4.4, 0.4, 3.8), caixa(0xe6e1d6, 3.8, 2.6, 2.8, 0, 0.4, -0.2), prisma(0xd2ccbe, 4.4, 1, 3.6, 0, 3));
    for (let i = 0; i < 4; i++) g.add(cilindro(0xf2eee4, 0.2, 2.6, -1.5 + i, 0.4, 1.5));
    g.add(porta(0, 1.21, 1.6), esfera(0xe0b23a, 0.3, 0, 3.6, 1.82));
  },
  fabrica(g) {
    g.add(caixa(TIJOLO, 6, 3, 3.6));
    for (let i = -1; i <= 1; i++) g.add(prisma(0x4a4a50, 2, 1, 3.7, i * 2, 3));
    for (let i = -2; i <= 2; i++) g.add(janela(i * 1.1, 1.5, 1.81, 0.7, 1.2));
    for (const x of [-2.2, 2.4]) g.add(cilindro(0x8e4a38, 0.42, 6.5, x, 0, -1.4), cilindro(0x3a3a40, 0.5, 0.3, x, 6.5, -1.4), fumaca(x, 6.9, -1.4, 0x7a7a7a));
    g.add(caixa(0x4a4a50, 1.4, 1.6, 0.1, 2.2, 0, 1.82));
  },
  olaria(g) {
    const forno = esfera(TIJOLO, 1.6, 0, 0, 0);
    forno.scale.y = 1.4;
    g.add(forno, cilindro(0x8e4a38, 0.4, 3.6, 0, 1.2, 0), fumaca(0, 4.9, 0, 0x8a8a8a), caixa(0x2a2020, 0.8, 0.8, 0.2, 0, 0, 1.5), cone(matFogo, 0.25, 0.5, 0, 0.1, 1.55));
    for (let i = 0; i < 4; i++) g.add(caixa(0xc96a4a, 1.2, 0.3 + (i % 2) * 0.3, 0.7, 2.6, 0, -1 + i * 0.8));
    g.add(caixa(MADEIRA, 2.6, 0.12, 2.6, -2.8, 1.6, 0));
    for (const [x, z] of [[-3.9, -1.1], [-1.7, -1.1], [-3.9, 1.1], [-1.7, 1.1]]) g.add(caixa(MADEIRA_ESC, 0.16, 1.6, 0.16, x, 0, z));
  },
  escritorio(g) {
    g.add(caixa(0xdfe4ea, 3.6, 6.4, 3.2), caixa(0x56708f, 3.9, 0.3, 3.5, 0, 6.4), caixa(0x56708f, 1.2, 0.9, 1.2, 0.8, 6.7, -0.5));
    for (let a = 0; a < 4; a++) for (let i = -1; i <= 1; i++) g.add(janela(i * 1.05, 1 + a * 1.4, 1.61, 0.7, 0.9), janela(1.81, 1 + a * 1.4, i * 0.95, 0.6, 0.9, true));
    g.add(caixa(0x3a4a5a, 1.2, 1.3, 0.1, 0, 0, 1.62));
  },
};

const EST = {
  conselho(g) {
    g.add(caixa(PEDRA, 4.4, 0.5, 3.6), caixa(0xf4ead8, 4, 2.4, 3.2, 0, 0.5), prisma(0x3f6aa8, 4.6, 1.6, 3.8, 0, 2.9));
    g.add(porta(0, 1.62, 1.4), janela(-1.3, 1.3, 1.61), janela(1.3, 1.3, 1.61), caixa(0xf4ead8, 1, 1.4, 1, 0, 3.6, 0), piramide(0x3f6aa8, 1.5, 1, 1.5, 0, 5));
    g.add(cilindro(MADEIRA_ESC, 0.06, 4.5, 2.8, 0, 1.4), bandeira(2.8, 3.6, 1.4, 0x3f6aa8));
  },
  guarda(g) {
    g.add(cilindro(PEDRA, 1.3, 4.6, 0, 0, 0), cilindro(PEDRA_ESC, 1.5, 0.4, 0, 4.6, 0), porta(0, 1.3, 1.2), janela(0, 3, 1.28, 0.3, 0.6));
    for (let i = 0; i < 8; i++) g.add(caixa(PEDRA_ESC, 0.45, 0.5, 0.45, Math.cos(i * 0.785) * 1.3, 5, Math.sin(i * 0.785) * 1.3));
    g.add(cilindro(MADEIRA_ESC, 0.05, 2.2, 0, 5, 0), bandeira(0, 6.3, 0, 0xc23a3a));
  },
  escola(g) {
    g.add(caixa(0xf1e3c2, 4.2, 2.2, 2.8), prisma(0xc96a3a, 4.7, 1.4, 3.3, 0, 2.2), porta(-1.2, 1.41, 1.2));
    for (let i = 0; i < 3; i++) g.add(janela(-0.1 + i * 0.85, 1.1, 1.41, 0.55, 0.8));
    g.add(caixa(0xf1e3c2, 1, 2, 1, -1.2, 2.2, 0), piramide(0xc96a3a, 1.5, 1, 1.5, -1.2, 4.2), esfera(0xe0b23a, 0.22, -1.2, 3.6, 0.55));
  },
  posto(g) {
    g.add(caixa(0xffffff, 3.4, 2, 2.6), prisma(0x3f8a7a, 3.9, 1.3, 3.1, 0, 2), porta(0.8, 1.31, 1.1), janela(-0.7, 0.9, 1.31));
    g.add(caixa(0x3fae6a, 0.2, 0.7, 0.08, 0, 2.3, 1.6), caixa(0x3fae6a, 0.7, 0.2, 0.08, 0, 2.55, 1.6));
    for (let i = 0; i < 4; i++) g.add(esfera(i % 2 ? 0x6fbf4a : 0xb07cff, 0.25, -2.4, 0.25, -0.9 + i * 0.6));
  },
  saneamento(g) {
    g.add(cilindro(PEDRA, 1.8, 0.5, 0, 0, 0), cilindro(0x4aa6e8, 1.55, 0.1, 0, 0.46, 0), cilindro(PEDRA, 0.3, 1.5, 0, 0.5, 0), cilindro(PEDRA, 0.8, 0.2, 0, 1.9, 0), cilindro(0x4aa6e8, 0.65, 0.08, 0, 2.06, 0));
    const jato = vivo(cone(0xbfe6ff, 0.18, 0.9, 0, 2.1, 0));
    jato.userData.anim = (t) => { jato.scale.y = 0.8 + Math.sin(t * 5) * 0.2; };
    g.add(jato);
  },
  hospital(g) {
    g.add(caixa(0xffffff, 5.6, 3.6, 3.4), caixa(0xd9dfe6, 5.9, 0.3, 3.7, 0, 3.6), caixa(0xffffff, 2, 1.2, 1.2, 0, 0, 2.1), porta(0, 2.71, 1.1));
    for (let a = 0; a < 2; a++) for (let i = -2; i <= 2; i++) if (i || a) g.add(janela(i * 1.05, 1 + a * 1.4, 1.71, 0.6, 0.8));
    g.add(caixa(0xd64a4a, 0.3, 1, 0.1, 0, 3.9, 1.6), caixa(0xd64a4a, 1, 0.3, 0.1, 0, 4.25, 1.6));
  },
  universidade(g) {
    g.add(caixa(PEDRA, 6.4, 0.5, 4.4), caixa(0xe6e1d6, 5.8, 3, 3.6, 0, 0.5, -0.2), prisma(0xd2ccbe, 3.4, 1, 1, 0, 3.5, 1.6));
    for (let i = 0; i < 6; i++) g.add(cilindro(0xf2eee4, 0.2, 3, -2.5 + i, 0.5, 1.9));
    const domo = esfera(0x4f8fa8, 1.6, 0, 3.5, -0.2);
    g.add(domo, cilindro(0xe6e1d6, 1.7, 0.5, 0, 3.4, -0.2), cone(0xe0b23a, 0.12, 0.8, 0, 5.1, -0.2), porta(0, 1.61, 1.5));
  },
  ferrovia(g) {
    g.add(caixa(PEDRA, 7, 0.4, 2), caixa(0xe8d3b0, 3.6, 2, 1.8, -1.2, 0.4, -0.6), prisma(0xa8563a, 6.6, 1, 2.6, 0, 2.6, -0.3));
    for (const x of [1.4, 2.8]) g.add(caixa(MADEIRA_ESC, 0.15, 2.2, 0.15, x, 0.4, 0.5));
    g.add(janela(-1.2, 1.3, 0.31, 0.8, 0.7));
    for (let i = -5; i <= 5; i++) g.add(caixa(MADEIRA_ESC, 0.25, 0.1, 1.5, i * 0.9, 0, 2.4));
    g.add(caixa(0x6a6a72, 10.5, 0.12, 0.1, 0, 0.1, 1.85), caixa(0x6a6a72, 10.5, 0.12, 0.1, 0, 0.1, 2.95));
    const trem = vivo(caixa(0x2f5d4a, 2.2, 0.9, 1, 0, 0.35, 0), caixa(0x2f5d4a, 0.9, 0.9, 1, -0.75, 1.2, 0), cilindro(0x3a3a40, 0.2, 0.9, 0.7, 1.25, 0),
      caixa(0xb04a3a, 1.8, 1.1, 1, -2.3, 0.35, 0), fumaca(0.7, 2.2, 0, 0xeeeeee));
    for (const x of [-0.7, 0.7, -2.8, -1.8]) { const roda = cilindro(0x2a2a30, 0.3, 1.2, x, 0, 0); roda.rotation.x = Math.PI / 2; roda.position.y = 0.3; trem.add(roda); }
    trem.position.set(0, 0.1, 2.4);
    trem.userData.anim = (t) => { trem.position.x = ((t * 0.6) % 12) - 6 + 1.5; };
    g.add(trem);
  },
};

function bandeira(x, y, z, cor) {
  const pano = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7, 6, 1).translate(0.6, 0, 0), toon(cor, { side: THREE.DoubleSide }));
  const g = vivo(pano);
  g.position.set(x, y, z);
  const p = pano.geometry.attributes.position;
  g.userData.anim = (t) => {
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 4 + p.getX(i) * 4) * 0.12 * p.getX(i));
    p.needsUpdate = true;
  };
  return g;
}

// Praça central: fogueira e poço desde o primeiro dia; depois, feira e estátua.
export function criarPraca(era) {
  const g = new THREE.Group();
  g.add(cilindro(PEDRA, 0.8, 0.7, 2.6, 0, 0), cilindro(0x4aa6e8, 0.6, 0.05, 2.6, 0.62, 0), prisma(MADEIRA, 1.8, 0.6, 1.4, 2.6, 1.9, 0));
  for (const sx of [-0.7, 0.7]) g.add(caixa(MADEIRA_ESC, 0.12, 1.9, 0.12, 2.6 + sx, 0, 0));
  for (let i = 0; i < 5; i++) { const tora = cilindro(MADEIRA_ESC, 0.12, 1.1, 0, 0, 0); tora.rotation.set(0.9, i * 1.26, 0); tora.position.y = 0.3; g.add(tora); }
  for (let i = 0; i < 7; i++) g.add(esfera(PEDRA_ESC, 0.2, Math.cos(i * 0.9) * 0.9, 0.1, Math.sin(i * 0.9) * 0.9));
  const chama = vivo(cone(matFogo, 0.42, 1.1, 0, 0.25, 0), cone(new THREE.MeshBasicMaterial({ color: 0xffe07a }), 0.22, 0.7, 0, 0.3, 0));
  const luz = new THREE.PointLight(0xff9a3c, 0, 26, 1.6);
  luz.position.y = 1.6;
  chama.add(luz);
  chama.userData.anim = (t, noite) => {
    chama.scale.set(1 + Math.sin(t * 13) * 0.12, 1 + Math.sin(t * 17 + 1) * 0.2, 1 + Math.cos(t * 11) * 0.12);
    luz.intensity = noite * (38 + Math.sin(t * 15) * 8);
  };
  g.add(chama);
  for (const a of [0.6, 2.2, 3.8, 5.2]) { const banco = caixa(MADEIRA, 1.4, 0.3, 0.4, Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6); banco.rotation.y = -a + Math.PI / 2; g.add(banco); }
  if (era >= 1) {
    for (const [x, z, c] of [[-3.4, 2.2, 0xd65a4a], [-3.8, -1.6, 0x4a8fd6], [-1.2, -3.8, 0xe0a83a]]) {
      g.add(caixa(MADEIRA, 1.6, 0.7, 1, x, 0, z), prisma(c, 2, 0.5, 1.5, x, 1.7, z));
      for (const sx of [-0.75, 0.75]) g.add(caixa(MADEIRA_ESC, 0.1, 1.7, 0.1, x + sx, 0, z));
      g.add(esfera(0xe0483a, 0.16, x - 0.3, 0.85, z), esfera(0xf0c23a, 0.16, x + 0.2, 0.85, z));
    }
  }
  if (era >= 2) g.add(caixa(PEDRA, 1.2, 1.2, 1.2, 0.2, 0, 4), cilindro(0x8aa39a, 0.28, 1.3, 0.2, 1.2, 4), esfera(0x8aa39a, 0.3, 0.2, 2.75, 4), cone(0x8aa39a, 0.1, 1, 0.65, 1.9, 4));
  return fundir(g);
}

export function criarPonte() {
  const g = new THREE.Group();
  g.add(caixa(MADEIRA, 15, 0.25, 2.6, 0, 0.9, 0));
  for (let i = -3; i <= 3; i++) for (const z of [-1.25, 1.25]) g.add(caixa(MADEIRA_ESC, 0.2, 1.9, 0.2, i * 2.3, -0.2, z));
  for (const z of [-1.25, 1.25]) g.add(caixa(MADEIRA_ESC, 15, 0.14, 0.14, 0, 1.6, z));
  return fundir(g);
}

// spec: { classe: 'casa' | 'negocio' | 'estado', tipo, nivel, id }
export function criarPredio(spec) {
  const r = aleatorio(spec.id * 7919 + 13);
  let g;
  if (spec.classe === 'casa') g = casa(spec.nivel, r);
  else {
    g = new THREE.Group();
    (spec.classe === 'negocio' ? NEG : EST)[spec.tipo](g, spec.nivel || 1, r);
    if (spec.classe === 'negocio' && spec.nivel >= 3) g.add(caixa(MADEIRA, 1.8, 1.4, 1.6, -3.4, 0, -1.4), prisma(0x6b3a2e, 2.1, 0.8, 1.9, -3.4, 1.4, -1.4));
    if (spec.classe === 'negocio') g.scale.setScalar(1 + 0.08 * ((spec.nivel || 1) - 1));
  }
  const raiz = new THREE.Group();
  raiz.add(g);
  fundir(raiz);
  const anims = [];
  raiz.traverse((o) => { if (o.userData.anim) anims.push(o.userData.anim); });
  raiz.userData.anims = anims;
  return raiz;
}
