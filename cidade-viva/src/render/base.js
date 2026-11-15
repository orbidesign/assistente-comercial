// Peças de montar do visual: materiais cel-shading e geometrias baratas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const degraus = new THREE.DataTexture(new Uint8Array([70, 130, 200, 255]), 4, 1, THREE.RedFormat);
degraus.minFilter = degraus.magFilter = THREE.NearestFilter;
degraus.needsUpdate = true;

const cache = new Map();
export function toon(cor, extra) {
  if (extra) return new THREE.MeshToonMaterial({ color: cor, gradientMap: degraus, ...extra });
  if (!cache.has(cor)) cache.set(cor, new THREE.MeshToonMaterial({ color: cor, gradientMap: degraus }));
  return cache.get(cor);
}

// Janelas compartilham um material: de noite todas acendem juntas.
export const matJanela = new THREE.MeshToonMaterial({ color: 0x2b3a55, gradientMap: degraus, emissive: 0xffc56b, emissiveIntensity: 0 });
export const matFogo = new THREE.MeshBasicMaterial({ color: 0xff9a3c });

const geoCaixa = new THREE.BoxGeometry(1, 1, 1);
const geoCil = new THREE.CylinderGeometry(1, 1, 1, 10);
const geoCone = new THREE.ConeGeometry(1, 1, 8);
const geoPiramide = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4);
const geoEsfera = new THREE.IcosahedronGeometry(1, 1);
// Prisma triangular: telhado de duas águas com a cumeeira ao longo de Z.
const geoPrisma = new THREE.CylinderGeometry(1, 1, 1, 3).rotateX(-Math.PI / 2).translate(0, 0.5, 0).scale(1 / 1.732, 1 / 1.5, 1);

function malha(geo, cor, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(geo, typeof cor === 'number' ? toon(cor) : cor);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// y é sempre a base da peça (mais fácil de empilhar).
export const caixa = (cor, w, h, d, x = 0, y = 0, z = 0) => malha(geoCaixa, cor, w, h, d, x, y + h / 2, z);
export const cilindro = (cor, r, h, x = 0, y = 0, z = 0) => malha(geoCil, cor, r, h, r, x, y + h / 2, z);
export const cone = (cor, r, h, x = 0, y = 0, z = 0) => malha(geoCone, cor, r, h, r, x, y + h / 2, z);
export const piramide = (cor, w, h, d, x = 0, y = 0, z = 0) => malha(geoPiramide, cor, w * 0.71, h, d * 0.71, x, y + h / 2, z);
export const esfera = (cor, r, x = 0, y = 0, z = 0) => malha(geoEsfera, cor, r, r, r, x, y, z);
export const prisma = (cor, w, h, d, x = 0, y = 0, z = 0) => malha(geoPrisma, cor, w, h, d, x, y, z);

// Funde as peças estáticas de um grupo em uma malha por material. Um prédio
// passa de ~30 draw calls para ~6; peças com userData.vivo continuam soltas.
export function fundir(grupo) {
  grupo.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(grupo.matrixWorld).invert();
  const porMat = new Map();
  const soltas = [];
  grupo.traverse((o) => {
    if (!o.isMesh) return;
    let vivo = false;
    for (let p = o; p && p !== grupo; p = p.parent) if (p.userData.vivo) vivo = true;
    if (vivo) return;
    // Icosaedros não têm índice; para fundir, todas as peças precisam estar no mesmo formato.
    const fonte = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const g = fonte.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!porMat.has(o.material)) porMat.set(o.material, []);
    porMat.get(o.material).push(g);
    soltas.push(o);
  });
  for (const o of soltas) o.parent.remove(o);
  for (const [mat, geos] of porMat) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
    m.castShadow = m.receiveShadow = true;
    grupo.add(m);
    geos.forEach((g) => g.dispose());
  }
  return grupo;
}

export function aleatorio(semente) {
  let s = semente | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Textura redonda e macia para partículas (sem ela, cada ponto é um quadrado).
let ponto = null;
export function texturaPonto() {
  if (!ponto) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    ponto = new THREE.CanvasTexture(c);
  }
  return ponto;
}
