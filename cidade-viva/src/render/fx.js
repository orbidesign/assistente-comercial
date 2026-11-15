// Efeitos e vida ambiente: tudo o que faz a cidade ser gostosa de assistir.
// Incêndios, fogos de artifício, caravanas, brilhos, poeira de obra, ovelhas,
// o pescador no rio e os lampiões das ruas.
import * as THREE from 'three';
import { altura, rioX, NIVEL_AGUA } from '../sim/geo.js';
import { toon, matFogo, caixa, cilindro, cone, esfera, fundir, aleatorio, texturaPonto } from './base.js';

export function criarFX(scene) {
  const ativos = []; // { atualizar(dt, tempo) -> false quando acabou, fim() }
  const rng = aleatorio(99);
  let luzes = 0;

  function nuvemDePontos(qtd, cor, tam, aditivo = true) {
    const pos = new Float32Array(qtd * 3);
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: cor, size: tam * 1.5, map: texturaPonto(), transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return { pos, geo, mat, pts, fim() { scene.remove(pts); geo.dispose(); mat.dispose(); } };
  }

  // Fogos de artifício sobre a praça.
  function fogos(rajadas = 9, x = 0, z = 0) {
    for (let k = 0; k < rajadas; k++) {
      const atraso = k * 0.7 + rng() * 0.4;
      const cor = new THREE.Color().setHSL(rng(), 0.9, 0.6);
      const centro = new THREE.Vector3(x + (rng() - 0.5) * 22, altura(x, z) + 13 + rng() * 9, z + (rng() - 0.5) * 22);
      const N = 70, vel = [];
      for (let i = 0; i < N; i++) {
        const v = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(5 + rng() * 4);
        vel.push(v);
      }
      let n = null, t = -atraso;
      ativos.push({
        atualizar(dt) {
          t += dt;
          if (t < 0) return true;
          if (!n) { n = nuvemDePontos(N, cor, 0.55); for (let i = 0; i < N; i++) centro.toArray(n.pos, i * 3); }
          for (let i = 0; i < N; i++) {
            vel[i].y -= 4.5 * dt; vel[i].multiplyScalar(1 - dt * 0.9);
            n.pos[i * 3] += vel[i].x * dt; n.pos[i * 3 + 1] += vel[i].y * dt; n.pos[i * 3 + 2] += vel[i].z * dt;
          }
          n.geo.attributes.position.needsUpdate = true;
          n.mat.opacity = Math.max(0, 1 - t / 1.9);
          return t < 1.9;
        },
        fim() { if (n) n.fim(); },
      });
    }
  }

  // Coluna de brilhos subindo (ouro no rio, saber na praça, febre sobre as casas).
  function brilho(x, z, cor, { raio = 3, dur = 5, qtd = 70, tam = 0.4, sobe = 3, aditivo = true } = {}) {
    const n = nuvemDePontos(qtd, cor, tam, aditivo);
    const base = Math.max(altura(x, z), NIVEL_AGUA);
    const fases = [];
    for (let i = 0; i < qtd; i++) {
      const a = rng() * 6.28, r = Math.sqrt(rng()) * raio;
      fases.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, f: rng() });
    }
    let t = 0;
    ativos.push({
      atualizar(dt, tempo) {
        t += dt;
        for (let i = 0; i < qtd; i++) {
          const p = fases[i], f = (p.f + t * 0.35) % 1;
          n.pos[i * 3] = p.x + Math.sin(tempo * 2 + i) * 0.25; n.pos[i * 3 + 1] = base + 0.2 + f * sobe * 2; n.pos[i * 3 + 2] = p.z;
        }
        n.geo.attributes.position.needsUpdate = true;
        n.mat.opacity = Math.min(1, t * 2, (dur - t) * 1.2) * 0.9;
        return t < dur;
      },
      fim: n.fim,
    });
  }

  const poeira = (x, z) => brilho(x, z, 0xd9c7a0, { raio: 2.6, dur: 1.5, qtd: 26, tam: 0.7, sobe: 0.9, aditivo: false });

  // Incêndio em um prédio.
  function fogo(x, z, dur = 15) {
    const g = new THREE.Group();
    const amarelo = new THREE.MeshBasicMaterial({ color: 0xffe07a });
    const chamas = [];
    for (let i = 0; i < 5; i++) {
      const c = cone(i % 2 ? amarelo : matFogo, 0.5 + rng() * 0.4, 1.6 + rng() * 1.2, (rng() - 0.5) * 2.4, 1 + rng() * 1.4, (rng() - 0.5) * 2);
      c.castShadow = false;
      chamas.push(c); g.add(c);
    }
    const matF = new THREE.MeshBasicMaterial({ color: 0x33302e, transparent: true, opacity: 0.6, depthWrite: false });
    const fumos = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), matF); g.add(m); return m; });
    let luz = null;
    if (luzes < 2) { luz = new THREE.PointLight(0xff7a2a, 60, 30, 1.6); luz.position.y = 3; g.add(luz); luzes++; }
    g.position.set(x, altura(x, z), z);
    scene.add(g);
    let t = 0;
    ativos.push({
      atualizar(dt, tempo) {
        t += dt;
        const forca = Math.min(1, t * 1.5, (dur - t) * 0.6);
        chamas.forEach((c, i) => c.scale.set(c.scale.x, (1.6 + Math.sin(tempo * 14 + i * 2) * 0.6) * forca + 0.01, c.scale.z));
        fumos.forEach((m, i) => { const f = (t * 0.3 + i / 4) % 1; m.position.set(Math.sin(f * 4 + i) * 0.8 + f * 2, 2.5 + f * 8, 0); m.scale.setScalar((0.8 + f * 2.2) * forca + 0.01); });
        if (luz) luz.intensity = (50 + Math.sin(tempo * 17) * 18) * forca;
        return t < dur;
      },
      fim() { scene.remove(g); if (luz) luzes--; },
    });
  }

  // Carroças de colonos chegando pela estrada do oeste.
  function carroca() {
    const g = new THREE.Group();
    g.add(caixa(0x8a623f, 1.7, 0.5, 0.95, 0, 0.45, 0), caixa(0x8a623f, 0.1, 0.1, 1.2, 1.6, 0.6, 0));
    const lona = cilindro(0xf4ead8, 0.52, 1.6, 0, 0, 0);
    lona.rotation.z = Math.PI / 2; lona.position.set(0, 1.05, 0); lona.scale.z = 0.5;
    g.add(lona, esfera(0x7a5536, 0.42, 2, 0.6, 0), esfera(0x6a4a30, 0.22, 2.5, 0.75, 0));
    for (const [x, z] of [[-0.55, 0.52], [0.55, 0.52], [-0.55, -0.52], [0.55, -0.52]]) {
      const r = cilindro(0x4a3626, 0.32, 0.1, 0, 0, 0);
      r.rotation.x = Math.PI / 2; r.position.set(x, 0.32, z);
      g.add(r);
    }
    return fundir(g);
  }
  function caravana(qtd = 2) {
    for (let k = 0; k < Math.min(4, qtd); k++) {
      const g = carroca();
      const ang = Math.PI * (0.75 + rng() * 0.5);
      const de = new THREE.Vector3(Math.cos(ang) * 74, 0, Math.sin(ang) * 74), ate = new THREE.Vector3(Math.cos(ang) * 7, 0, Math.sin(ang) * 7);
      g.rotation.y = Math.atan2(-(ate.z - de.z), ate.x - de.x);
      scene.add(g);
      let t = -k * 2.2;
      const dur = 16;
      ativos.push({
        atualizar(dt, tempo) {
          t += dt;
          g.visible = t >= 0;
          const f = Math.min(1, Math.max(0, t / dur));
          const x = de.x + (ate.x - de.x) * f, z = de.z + (ate.z - de.z) * f;
          g.position.set(x, altura(x, z) + Math.abs(Math.sin(tempo * 9)) * 0.05, z);
          g.scale.setScalar(Math.min(1, Math.max(0.01, (dur + 1 - t) * 1.2)));
          return t < dur + 1;
        },
        fim() { scene.remove(g); },
      });
    }
  }

  // ----- vida ambiente permanente -----

  // O pescador que desce o rio de canoa.
  const canoa = new THREE.Group();
  canoa.add(caixa(0x8a5a36, 2.2, 0.3, 0.8, 0, 0, 0), caixa(0x8a5a36, 0.5, 0.26, 0.5, 1.25, 0.04, 0), caixa(0x6b4428, 2.2, 0.08, 0.9, 0, 0.3, 0));
  canoa.add(cilindro(0x4f7fc9, 0.2, 0.5, -0.3, 0.3, 0), esfera(0xf2c9a0, 0.16, -0.3, 0.95, 0), cone(0xdcbb68, 0.28, 0.14, -0.3, 1.05, 0));
  const vara = cilindro(0x5d4028, 0.025, 1.8, 0.3, 0.5, 0.2);
  vara.rotation.z = -0.9;
  canoa.add(vara);
  fundir(canoa);
  scene.add(canoa);

  // Ovelhas perto das fazendas.
  const ovelhas = new Map(); // id da fazenda -> [{ g, cx, cz, alvo, espera }]
  function ovelha() {
    const g = new THREE.Group();
    const corpo = esfera(0xf7f3ea, 0.36, 0, 0.42, 0);
    corpo.scale.set(0.36, 0.3, 0.48);
    g.add(corpo, esfera(0x3a3230, 0.15, 0, 0.5, 0.42));
    for (const [x, z] of [[-0.14, 0.2], [0.14, 0.2], [-0.14, -0.2], [0.14, -0.2]]) g.add(caixa(0x3a3230, 0.07, 0.22, 0.07, x, 0, z));
    return fundir(g);
  }
  function sincronizarAnimais(w) {
    const fazendas = new Map(w.negocios.filter((n) => n.tipo === 'fazenda').slice(0, 14).map((n) => [n.id, n]));
    for (const [id, lista] of ovelhas) if (!fazendas.has(id)) { lista.forEach((o) => scene.remove(o.g)); ovelhas.delete(id); }
    for (const [id, n] of fazendas) {
      if (ovelhas.has(id)) continue;
      const r = aleatorio(id);
      const lista = [];
      for (let i = 0; i < 2 + n.nivel; i++) {
        const o = { g: ovelha(), cx: n.pos.x, cz: n.pos.z, alvo: null, espera: r() * 5, r };
        const a = r() * 6.28;
        o.g.position.set(n.pos.x + Math.cos(a) * 5, 0, n.pos.z + Math.sin(a) * 5);
        scene.add(o.g); lista.push(o);
      }
      ovelhas.set(id, lista);
    }
  }

  // Lampiões: aparecem na Cidade Mercantil e acendem à noite.
  const MAX_LAMP = 220;
  const matLuz = new THREE.MeshBasicMaterial({ color: 0x55504a });
  const postes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 5).translate(0, 1.2, 0), toon(0x3a3a40), MAX_LAMP);
  const bulbos = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 0).translate(0, 2.5, 0), matLuz, MAX_LAMP);
  postes.count = bulbos.count = 0;
  postes.castShadow = true;
  scene.add(postes, bulbos);
  const M = new THREE.Matrix4();
  function sincronizarLampioes(w, posicoes) {
    const qtd = w.era >= 2 ? Math.min(MAX_LAMP, posicoes.length) : 0;
    for (let i = 0; i < qtd; i++) {
      const p = posicoes[i], d = Math.hypot(p.x, p.z) || 1;
      const a = Math.atan2(-p.z, -p.x) + 0.7;
      const x = p.x + Math.cos(a) * Math.min(3.4, d * 0.4), z = p.z + Math.sin(a) * Math.min(3.4, d * 0.4);
      M.makeTranslation(x, altura(x, z), z);
      postes.setMatrixAt(i, M); bulbos.setMatrixAt(i, M);
    }
    postes.count = bulbos.count = qtd;
    postes.instanceMatrix.needsUpdate = bulbos.instanceMatrix.needsUpdate = true;
  }

  const corDia = new THREE.Color(0x55504a), corNoite = new THREE.Color(0xffd27a);
  function atualizar(dt, tempo, noite) {
    for (let i = ativos.length - 1; i >= 0; i--) {
      if (!ativos[i].atualizar(dt, tempo)) { ativos[i].fim(); ativos.splice(i, 1); }
    }
    const z = 95 - ((tempo * 2.1) % 190);
    canoa.position.set(rioX(z), NIVEL_AGUA + 0.08 + Math.sin(tempo * 2) * 0.05, z);
    canoa.rotation.set(Math.sin(tempo * 1.7) * 0.04, Math.atan2(1, rioX(z - 1) - rioX(z)), 0);
    matLuz.color.copy(corDia).lerp(corNoite, noite);

    for (const lista of ovelhas.values()) for (const o of lista) {
      const p = o.g.position;
      if (!o.alvo) {
        if ((o.espera -= dt) > 0) { p.y = altura(p.x, p.z); continue; }
        const a = o.r() * 6.28, d = 3.5 + o.r() * 3;
        o.alvo = { x: o.cx + Math.cos(a) * d, z: o.cz + Math.sin(a) * d };
        if (altura(o.alvo.x, o.alvo.z) < NIVEL_AGUA + 0.4) o.alvo = null;
        continue;
      }
      const dx = o.alvo.x - p.x, dz = o.alvo.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.2) { o.alvo = null; o.espera = 2 + o.r() * 7; continue; }
      p.x += (dx / d) * 0.7 * dt; p.z += (dz / d) * 0.7 * dt;
      p.y = altura(p.x, p.z) + Math.abs(Math.sin(tempo * 8 + o.cx)) * 0.04;
      o.g.rotation.y = Math.atan2(dx, dz);
    }
  }

  return { atualizar, fogos, brilho, poeira, fogo, caravana, sincronizarAnimais, sincronizarLampioes };
}
