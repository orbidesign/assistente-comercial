// O vale: terreno, rio, céu, ciclo de dia e noite, estações, vegetação, nuvens e pássaros.
import * as THREE from 'three';
import { altura, fbm, rioX, RAIO_MUNDO, NIVEL_AGUA } from '../sim/geo.js';
import { toon, matJanela, aleatorio, texturaPonto } from './base.js';

const C = (h) => new THREE.Color(h);
const CORES = {
  grama: C(0x7cc24f), gramaEscura: C(0x4f9a3c), gramaClara: C(0xa5d86a), areia: C(0xe2cf95),
  rocha: C(0x8d8a84), rochaClara: C(0xb4b0a6), neve: C(0xf4f8ff), terra: C(0xb08a5a), pedra: C(0xa9a49a),
};

// Paleta do céu ao longo do dia: [hora, topo, horizonte, luz do sol, intensidade, ambiente]
const CEU = [
  [0.0, 0x070b1f, 0x16224a, 0x8fa8ff, 0.18, 0.35],
  [0.21, 0x0d1533, 0x2a3566, 0x8fa8ff, 0.2, 0.38],
  [0.27, 0x4a6fb0, 0xffb07a, 0xffc9a0, 0.9, 0.6],
  [0.36, 0x3d97e6, 0xc4e8ff, 0xfff4dd, 1.5, 0.85],
  [0.64, 0x3d97e6, 0xc4e8ff, 0xfff4dd, 1.5, 0.85],
  [0.74, 0x3a4a94, 0xff9160, 0xffb27a, 0.95, 0.6],
  [0.81, 0x0d1533, 0x3a3566, 0x8fa8ff, 0.22, 0.4],
  [1.0, 0x070b1f, 0x16224a, 0x8fa8ff, 0.18, 0.35],
];
// Estações: cor da folhagem e tom do chão por mês.
// Hemisfério sul: janeiro é verão, julho é inverno.
const FOLHA = [0x47a53c, 0x4aa53a, 0x6fa83a, 0xb8a13a, 0xd98a2f, 0xc97a3c, 0x9fb59a, 0x8fb7a0, 0x7cc46a, 0x62c452, 0x55b845, 0x4fae3f].map(C);
const CHAO = [0xffffff, 0xfffbe6, 0xfff2cc, 0xf6e2b6, 0xf0d6a8, 0xe9dfcf, 0xe6ecf0, 0xe3ece6, 0xf2ffe6, 0xffffff, 0xffffff, 0xffffff].map(C);

export function criarMundo3D(scene, q = { arvores: 1700, tufos: 6500, sombra: 2048, particulas: 1400 }) {
  const tmp = new THREE.Color();
  const rng = aleatorio(4242);

  // ----- terreno -----
  const SEG = 200, LADO = RAIO_MUNDO * 2;
  const geo = new THREE.PlaneGeometry(LADO, LADO, SEG, SEG).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const n = pos.count;
  const base = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = altura(x, z);
    pos.setY(i, h);
    const incl = Math.abs(altura(x + 1.2, z) - h) + Math.abs(altura(x, z + 1.2) - h);
    const v = fbm(x * 0.15, z * 0.15);
    if (h < NIVEL_AGUA + 0.55) tmp.copy(CORES.areia);
    else if (h > 30 + v * 6) tmp.copy(CORES.neve);
    else if (incl > 1.9 || h > 20) tmp.copy(v > 0.5 ? CORES.rochaClara : CORES.rocha);
    else tmp.copy(v > 0.62 ? CORES.gramaClara : v < 0.38 ? CORES.gramaEscura : CORES.grama);
    tmp.toArray(base, i * 3);
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base), 3));
  const matTerreno = toon(0xffffff, { vertexColors: true });
  const terreno = new THREE.Mesh(geo, matTerreno);
  terreno.receiveShadow = true;
  scene.add(terreno);

  // Caminhos de terra (ou pedra) pintados nos vértices, ligando os prédios.
  function pintarCaminhos(pontos, calcada) {
    const cor = geo.attributes.color;
    const alvo = calcada ? CORES.pedra : CORES.terra;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let f = 0;
      if (Math.abs(x) < 86 && Math.abs(z) < 86 && base[i * 3] !== CORES.areia.r) {
        let dmin = 1e9;
        for (const p of pontos) {
          // distância ao segmento p -> p.via
          const vx = p.vx - p.x, vz = p.vz - p.z;
          const t = Math.max(0, Math.min(1, ((x - p.x) * vx + (z - p.z) * vz) / (vx * vx + vz * vz || 1)));
          const d = Math.hypot(x - p.x - vx * t, z - p.z - vz * t) - (t < 0.02 ? 1.6 : 0);
          if (d < dmin) dmin = d;
        }
        f = 1 - Math.min(1, Math.max(0, (dmin - 0.5) / 1.3));
      }
      tmp.fromArray(base, i * 3).lerp(alvo, f * 0.9);
      cor.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    cor.needsUpdate = true;
  }

  // ----- rio -----
  // Um mapa de profundidade do vale deixa a água rasa mais clara e desenha
  // espuma onde ela encosta na margem.
  const RES = 256, fundura = new Uint8Array(RES * RES);
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
    const x = (i / (RES - 1) - 0.5) * LADO, z = (j / (RES - 1) - 0.5) * LADO;
    fundura[j * RES + i] = Math.max(0, Math.min(255, ((NIVEL_AGUA - altura(x, z)) / 1.3) * 255));
  }
  const mapaFundo = new THREE.DataTexture(fundura, RES, RES, THREE.RedFormat);
  mapaFundo.minFilter = mapaFundo.magFilter = THREE.LinearFilter;
  mapaFundo.needsUpdate = true;
  const matAgua = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { t: { value: 0 }, mapa: { value: mapaFundo }, raso: { value: C(0x7fd6e8) }, fundo: { value: C(0x2f7fcf) }, luz: { value: 1 } },
    vertexShader: `varying vec3 p; varying vec2 u;
      void main(){ p = position; u = vec2(position.x, -position.y) / ${LADO.toFixed(1)} + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float t; uniform float luz; uniform sampler2D mapa; uniform vec3 raso; uniform vec3 fundo; varying vec3 p; varying vec2 u;
      void main(){
        float d = texture2D(mapa, u).r;
        float onda = sin(p.x * 0.9 + t * 0.7 + sin(p.y * 0.6 + t * 0.5) * 1.5) * sin(p.y * 1.3 - t * 1.6);
        vec3 c = mix(raso, fundo, smoothstep(0.05, 0.75, d));
        c = mix(c, c * 1.18, smoothstep(0.4, 0.6, onda));
        c = mix(c, vec3(1.0), step(0.97, onda) * 0.8);
        float borda = d + sin(t * 1.4 + p.x * 0.7 + p.y * 0.5) * 0.035;
        c = mix(c, vec3(1.0), (1.0 - smoothstep(0.1, 0.17, borda)) * 0.85);
        gl_FragColor = vec4(c * luz, mix(0.72, 0.93, smoothstep(0.0, 0.6, d)));
      }`,
  });
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(LADO, LADO), matAgua);
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = NIVEL_AGUA;
  scene.add(agua);

  // ----- céu -----
  const matCeu = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { topo: { value: C(0x3d97e6) }, horizonte: { value: C(0xc4e8ff) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 topo; uniform vec3 horizonte; varying float h; void main(){ gl_FragColor = vec4(mix(horizonte, topo, smoothstep(0.0, 0.55, h)), 1.0); }',
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), matCeu));
  scene.fog = new THREE.Fog(0xc4e8ff, 120, 420);

  const estrelasPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const a = rng() * Math.PI * 2, e = Math.acos(rng() * 0.95);
    estrelasPos.set([Math.sin(e) * Math.cos(a) * 560, Math.cos(e) * 560, Math.sin(e) * Math.sin(a) * 560], i * 3);
  }
  const matEstrelas = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const geoEstrelas = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(estrelasPos, 3));
  scene.add(new THREE.Points(geoEstrelas, matEstrelas));

  const sol = new THREE.DirectionalLight(0xfff4dd, 1.5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(q.sombra, q.sombra);
  Object.assign(sol.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 10, far: 420 });
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.6;
  scene.add(sol, sol.target);
  const ambiente = new THREE.HemisphereLight(0xdff1ff, 0x6a7a4a, 0.85);
  scene.add(ambiente);
  const discoSol = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 8), new THREE.MeshBasicMaterial({ color: 0xfff1b0, fog: false }));
  const discoLua = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false }));
  scene.add(discoSol, discoLua);

  // ----- vegetação -----
  const matFolha = toon(0x4fae3f, {});
  const matPinheiro = toon(0x2f7d4f, {});
  const matTronco = toon(0x7a5536);
  const vento = { value: 0 };
  const balancar = (mat, forca) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.vento = vento;
      sh.vertexShader = `uniform float vento;\n${sh.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n transformed.x += sin(vento + instanceMatrix[3].x * 0.4 + instanceMatrix[3].z * 0.3) * ${forca} * (position.y + 0.6);`,
      );
    };
  };
  balancar(matFolha, '0.07');
  balancar(matPinheiro, '0.05');
  const arvores = [];
  for (let k = 0; k < 9000 && arvores.length < q.arvores; k++) {
    const x = (rng() - 0.5) * LADO * 0.96, z = (rng() - 0.5) * LADO * 0.96;
    const h = altura(x, z), d = Math.hypot(x, z);
    if (h < 0.5 || h > 27 || d < 9) continue;
    const mata = fbm(x * 0.05 + 30, z * 0.05 + 30);
    if (rng() > (d < 45 ? mata * 0.55 : mata * 1.3)) continue;
    if (Math.abs(altura(x + 1.5, z) - h) > 1.6) continue;
    arvores.push({ x, z, h, s: 0.75 + rng() * 0.8, pinho: h > 9 || rng() < 0.25, rot: rng() * 6.28, viva: true });
  }
  const folhosas = arvores.filter((a) => !a.pinho), pinheiros = arvores.filter((a) => a.pinho);
  const geoCopa = new THREE.IcosahedronGeometry(1, 1);
  const geoCopa2 = new THREE.IcosahedronGeometry(0.72, 1).translate(0.55, 0.65, 0.2);
  const geoTronco = new THREE.CylinderGeometry(0.16, 0.24, 1, 6).translate(0, 0.5, 0);
  const geoPinho = new THREE.ConeGeometry(1, 2.4, 7).translate(0, 1.2, 0);
  const inst = (g, m, qtd) => {
    const im = new THREE.InstancedMesh(g, m, qtd);
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
    return im;
  };
  const camadas = {
    copa: inst(geoCopa, matFolha, folhosas.length), copa2: inst(geoCopa2, matFolha, folhosas.length),
    troncoF: inst(geoTronco, matTronco, folhosas.length),
    pinho: inst(geoPinho, matPinheiro, pinheiros.length), pinho2: inst(geoPinho, matPinheiro, pinheiros.length),
    troncoP: inst(geoTronco, matTronco, pinheiros.length),
  };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), eixoY = new THREE.Vector3(0, 1, 0);
  const poe = (im, i, x, y, z, sx, sy, sz, rot = 0) => {
    im.setMatrixAt(i, M.compose(P.set(x, y, z), Q.setFromAxisAngle(eixoY, rot), S.set(sx, sy, sz)));
  };
  function desenharArvore(a, i) {
    const s = a.viva ? a.s : 0;
    if (a.pinho) {
      poe(camadas.troncoP, i, a.x, a.h, a.z, s, s * 1.2, s);
      poe(camadas.pinho, i, a.x, a.h + s * 0.9, a.z, s * 1.05, s, s * 1.05, a.rot);
      poe(camadas.pinho2, i, a.x, a.h + s * 2.1, a.z, s * 0.75, s * 0.8, s * 0.75, a.rot);
    } else {
      poe(camadas.troncoF, i, a.x, a.h, a.z, s, s * 1.7, s);
      poe(camadas.copa, i, a.x, a.h + s * 2.3, a.z, s * 1.25, s * 1.1, s * 1.25, a.rot);
      poe(camadas.copa2, i, a.x, a.h + s * 2.0, a.z, s, s, s, a.rot);
    }
  }
  folhosas.forEach(desenharArvore);
  pinheiros.forEach(desenharArvore);

  // Abrir clareira quando um prédio aparece.
  function limparArea(x, z, raio) {
    let mudou = false;
    const corta = (lista) => lista.forEach((a, i) => {
      if (a.viva && Math.hypot(a.x - x, a.z - z) < raio) { a.viva = false; desenharArvore(a, i); mudou = true; }
    });
    corta(folhosas); corta(pinheiros);
    if (mudou) Object.values(camadas).forEach((im) => { im.instanceMatrix.needsUpdate = true; });
    const g = tufos.userData.lista;
    let mudouG = false;
    for (let i = 0; i < g.length; i++) {
      if (g[i].s && Math.hypot(g[i].x - x, g[i].z - z) < raio * 0.75) { g[i].s = 0; poe(tufos, i, 0, -50, 0, 0, 0, 0); mudouG = true; }
    }
    if (mudouG) tufos.instanceMatrix.needsUpdate = true;
  }

  // Tufos de capim que balançam com o vento, flores e pedras.
  const matCapim = toon(0x8fd05a, {});
  balancar(matCapim, '0.3');
  const geoTufo = new THREE.ConeGeometry(0.22, 0.75, 4).translate(0, 0.37, 0);
  const listaTufos = [];
  for (let k = 0; k < 30000 && listaTufos.length < q.tufos; k++) {
    const x = (rng() - 0.5) * 170, z = (rng() - 0.5) * 170;
    const h = altura(x, z);
    if (h < 0.5 || h > 14 || fbm(x * 0.2, z * 0.2) < 0.42) continue;
    listaTufos.push({ x, z, h, s: 0.6 + rng() * 0.9 });
  }
  const tufos = new THREE.InstancedMesh(geoTufo, matCapim, listaTufos.length);
  tufos.receiveShadow = true;
  tufos.userData.lista = listaTufos;
  listaTufos.forEach((g, i) => poe(tufos, i, g.x, g.h - 0.05, g.z, g.s, g.s, g.s, g.x));
  scene.add(tufos);

  const coresFlor = [0xff6b8b, 0xffd24a, 0xffffff, 0xb07cff, 0xff9a4a];
  const flores = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial(), 900);
  for (let i = 0, k = 0; i < 900 && k < 20000; k++) {
    const cx = (rng() - 0.5) * 150, cz = (rng() - 0.5) * 150;
    const h = altura(cx, cz);
    if (h < 0.6 || h > 10) continue;
    poe(flores, i, cx, h + 0.22, cz, 1, 1, 1);
    flores.setColorAt(i, tmp.set(coresFlor[Math.floor(rng() * coresFlor.length)]));
    i++;
  }
  scene.add(flores);

  const pedras = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), toon(0x9a968e), 160);
  pedras.castShadow = true;
  for (let i = 0, k = 0; i < 160 && k < 5000; k++) {
    const x = (rng() - 0.5) * 190, z = (rng() - 0.5) * 190;
    const h = altura(x, z), perto = Math.abs(x - rioX(z)) < 12;
    if (h < -0.3 || h > 24 || (!perto && rng() < 0.75) || Math.hypot(x, z) < 12) continue;
    const s = 0.3 + rng() * (perto ? 0.7 : 1.3);
    pedras.setMatrixAt(i, M.compose(P.set(x, h + s * 0.2, z), Q.setFromAxisAngle(eixoY, rng() * 6), S.set(s, s * 0.7, s * 1.1)));
    i++;
  }
  scene.add(pedras);

  // ----- nuvens e pássaros -----
  const matNuvem = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  const nuvens = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    for (let j = 0, q = 3 + Math.floor(rng() * 4); j < q; j++) {
      const b = new THREE.Mesh(geoCopa, matNuvem);
      const s = 5 + rng() * 6;
      b.scale.set(s * 1.5, s * 0.6, s);
      b.position.set(j * 6 - q * 3 + rng() * 3, rng() * 2, rng() * 5);
      g.add(b);
    }
    g.position.set((rng() - 0.5) * 500, 62 + rng() * 30, (rng() - 0.5) * 500);
    g.userData.v = 1.2 + rng() * 1.6;
    nuvens.push(g);
    scene.add(g);
  }
  const passaros = [];
  const geoAsa = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.9, 0, -0.25, 0.9, 0, 0.25]), 3));
  const matAve = new THREE.MeshBasicMaterial({ color: 0x2b2b33, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const ave = new THREE.Group();
    const e = new THREE.Mesh(geoAsa, matAve), d = new THREE.Mesh(geoAsa, matAve);
    d.scale.x = -1;
    ave.add(e, d);
    ave.userData = { e, d, raio: 22 + rng() * 40, fase: rng() * 6.28, alt: 20 + rng() * 14, vel: 0.12 + rng() * 0.1, cx: (rng() - 0.5) * 40, cz: (rng() - 0.5) * 40 };
    passaros.push(ave);
    scene.add(ave);
  }

  // ----- clima: folhas no outono, neve no inverno, pétalas na primavera, chuva nos eventos -----
  const NP = q.particulas;
  const pPos = new Float32Array(NP * 3), pFase = new Float32Array(NP);
  for (let i = 0; i < NP; i++) { pPos.set([(rng() - 0.5) * 90, rng() * 34, (rng() - 0.5) * 90], i * 3); pFase[i] = rng() * 6.28; }
  const geoClima = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const matClima = new THREE.PointsMaterial({ size: 0.3, map: texturaPonto(), transparent: true, opacity: 0.9, depthWrite: false });
  const clima = new THREE.Points(geoClima, matClima);
  clima.frustumCulled = false;
  scene.add(clima);
  const MODOS = {
    folhas: { cor: 0xd98a2f, tam: 0.42, queda: 2.4, deriva: 1.6, qtd: 0.35 },
    neve: { cor: 0xffffff, tam: 0.3, queda: 1.6, deriva: 0.8, qtd: 0.4 },
    petalas: { cor: 0xffb7d0, tam: 0.34, queda: 1.1, deriva: 1.4, qtd: 0.3 },
  };
  const tempoRuim = { chuvaAte: 0, seca: 0, secaAlvo: 0 };
  // A chuva é feita de riscos, não de pontos: lê muito melhor como chuva.
  const NR = Math.floor(NP * 0.8), rPos = new Float32Array(NR * 6), rTopo = new Float32Array(NR * 3);
  for (let i = 0; i < NR; i++) rTopo.set([(rng() - 0.5) * 80, rng() * 34, (rng() - 0.5) * 80], i * 3);
  const chuva = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rPos, 3)),
    new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  chuva.frustumCulled = false;
  chuva.visible = false;
  scene.add(chuva);

  const NV = 110, vPos = new Float32Array(NV * 3), vBase = [];
  for (let i = 0; i < NV; i++) {
    const a = rng() * 6.28, r = 6 + rng() * 50, x = Math.cos(a) * r, z = Math.sin(a) * r;
    vBase.push({ x, z, h: Math.max(altura(x, z), NIVEL_AGUA) + 0.6 + rng() * 1.6, f: rng() * 6.28 });
  }
  const matVaga = new THREE.PointsMaterial({ color: 0xe9ff7a, size: 0.5, map: texturaPonto(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const vagalumes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(vPos, 3)), matVaga);
  vagalumes.frustumCulled = false;
  scene.add(vagalumes);

  // ----- ciclo do dia e das estações -----
  const c1 = new THREE.Color(), c2 = new THREE.Color();
  const estado = { hora: 0.33, noite: 0 };
  function atualizar(dt, tempo, mes, foco) {
    estado.hora = (estado.hora + dt / 150) % 1;
    const h = estado.hora;
    let i = 0;
    while (CEU[i + 1][0] < h) i++;
    const a = CEU[i], b = CEU[i + 1], f = (h - a[0]) / (b[0] - a[0]);
    matCeu.uniforms.topo.value.copy(c1.set(a[1]).lerp(c2.set(b[1]), f));
    matCeu.uniforms.horizonte.value.copy(c1.set(a[2]).lerp(c2.set(b[2]), f));
    scene.fog.color.copy(matCeu.uniforms.horizonte.value);
    sol.color.copy(c1.set(a[3]).lerp(c2.set(b[3]), f));
    sol.intensity = a[4] + (b[4] - a[4]) * f;
    ambiente.intensity = a[5] + (b[5] - a[5]) * f;
    const ang = (h - 0.25) * Math.PI * 2;
    const sx = Math.cos(ang), sy = Math.sin(ang);
    discoSol.position.set(sx * 480, sy * 420, -150);
    discoLua.position.set(-sx * 480, -sy * 420, -150);
    const dia = sy > -0.05;
    sol.position.set((dia ? sx : -sx) * 160, Math.max(40, Math.abs(sy) * 200), -70);
    estado.noite = Math.min(1, Math.max(0, (0.12 - sy) / 0.25));
    matEstrelas.opacity = estado.noite;
    matJanela.emissiveIntensity = estado.noite * 1.6;
    matAgua.uniforms.t.value = tempo;
    matAgua.uniforms.luz.value = 0.35 + 0.65 * (1 - estado.noite);
    matNuvem.color.copy(c1.set(0xffffff).lerp(matCeu.uniforms.horizonte.value, 0.35 + estado.noite * 0.4)).multiplyScalar(1 - estado.noite * 0.55);
    vento.value = tempo * 1.8;
    const chovendo = tempo < tempoRuim.chuvaAte;
    if (chovendo) { sol.intensity *= 0.5; ambiente.intensity *= 0.8; }
    scene.fog.far += ((chovendo ? 230 : 420) - scene.fog.far) * Math.min(1, dt);
    tempoRuim.seca += (tempoRuim.secaAlvo - tempoRuim.seca) * Math.min(1, dt * 0.4);

    const m = Math.floor(((mes % 12) + 12) % 12);
    matFolha.color.lerp(FOLHA[m], Math.min(1, dt * 0.8));
    matTerreno.color.lerp(c2.copy(CHAO[m]).lerp(c1.set(0xf0d58a), tempoRuim.seca * 0.75), Math.min(1, dt * 0.8));
    matCapim.color.copy(matFolha.color).lerp(c1.set(0xd8f08a), 0.35).lerp(c2.set(0xd9c06a), tempoRuim.seca);

    chuva.visible = chovendo;
    if (chovendo) {
      chuva.position.set(foco.x, Math.max(0, foco.y - 6), foco.z);
      for (let i = 0; i < NR; i++) {
        let y = rTopo[i * 3 + 1] - 42 * dt;
        if (y < 0) y += 34;
        rTopo[i * 3 + 1] = y;
        const x = rTopo[i * 3], z = rTopo[i * 3 + 2];
        rPos.set([x, y, z, x + 0.25, y - 1.5, z], i * 6);
      }
      chuva.geometry.attributes.position.needsUpdate = true;
    }
    const modo = chovendo ? null : m >= 3 && m <= 5 ? 'folhas' : m === 6 || m === 7 ? 'neve' : m === 8 || m === 9 ? 'petalas' : null;
    clima.visible = !!modo;
    if (modo) {
      const M2 = MODOS[modo];
      matClima.color.set(M2.cor); matClima.size = M2.tam;
      geoClima.setDrawRange(0, Math.floor(NP * M2.qtd));
      clima.position.set(foco.x, Math.max(0, foco.y - 6), foco.z);
      for (let i = 0, n = Math.floor(NP * M2.qtd); i < n; i++) {
        pPos[i * 3 + 1] -= M2.queda * dt;
        pPos[i * 3] += Math.sin(tempo * 1.3 + pFase[i]) * M2.deriva * dt;
        if (pPos[i * 3 + 1] < 0) pPos[i * 3 + 1] += 34;
      }
      geoClima.attributes.position.needsUpdate = true;
    }
    matVaga.opacity = estado.noite * (0.55 + Math.sin(tempo * 2.2) * 0.25);
    vagalumes.visible = estado.noite > 0.05;
    if (vagalumes.visible) {
      for (let i = 0; i < NV; i++) {
        const v = vBase[i];
        vPos[i * 3] = v.x + Math.sin(tempo * 0.5 + v.f) * 1.6;
        vPos[i * 3 + 1] = v.h + Math.sin(tempo * 0.9 + v.f * 2) * 0.5;
        vPos[i * 3 + 2] = v.z + Math.cos(tempo * 0.4 + v.f) * 1.6;
      }
      vagalumes.geometry.attributes.position.needsUpdate = true;
    }

    for (const g of nuvens) {
      g.position.x += g.userData.v * dt;
      if (g.position.x > 280) g.position.x = -280;
    }
    for (const ave of passaros) {
      const u = ave.userData, t = tempo * u.vel + u.fase;
      ave.position.set(u.cx + Math.cos(t) * u.raio, u.alt + Math.sin(t * 3) * 1.5, u.cz + Math.sin(t) * u.raio);
      ave.rotation.y = -t;
      const bate = Math.sin(tempo * 9 + u.fase) * 0.7;
      u.e.rotation.z = bate; u.d.rotation.z = -bate;
      ave.visible = estado.noite < 0.6;
    }
  }

  return {
    atualizar, pintarCaminhos, limparArea, estado, terreno, sol,
    chover(tempo, segundos) { tempoRuim.chuvaAte = tempo + segundos; },
    secar(nivel) { tempoRuim.secaAlvo = nivel; },
  };
}
