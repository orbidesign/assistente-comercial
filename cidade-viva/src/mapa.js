// O mapa de Campinas com as unidades de cada empresário. Usa Google Maps quando
// há chave (GOOGLE_MAPS_API_KEY no servidor); sem chave, usa OpenStreetMap.
// Nos dois casos o mapa tem as ruas reais, com cores de jogo por cima.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LOCAIS, CENTRO_DO_MAPA } from './empresas/campinas.js';

export const ICONE = { padaria: '🥖', cafeteria: '☕', minimercado: '🛒', restaurante: '🍽️', delivery: '🛵', fabrica: '🏭', distribuidora: '📦', marca_nacional: '🏷️' };
const PULSO = { assalto: '🚨', obra: '🚧', concorrente: '⚔️', abriu: '✨' };
const VISTAS = { campinas: { ...CENTRO_DO_MAPA }, regiao: { lat: -22.95, lng: -47.1, zoom: 9 }, brasil: { lat: -21.5, lng: -46.5, zoom: 6 } };

// Cores de jogo para o Google Maps: papel antigo, ruas claras, água azul.
const ESTILO_GOOGLE = [
  { elementType: 'geometry', stylers: [{ color: '#efe3c2' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#5a4632' }] }, { elementType: 'labels.text.stroke', stylers: [{ color: '#f6ecd2' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#fff7e2' }] }, { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f3d99a' }] }, { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e0a83a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#7fc3e8' }] }, { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#b9d98a' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] }, { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

function marcadores(estado) {
  // Um selo por empresário em cada lugar, deslocado para os três não se cobrirem.
  const lista = [];
  estado.ceos.forEach((c, k) => {
    const porLocal = {};
    for (const u of c.unidades) (porLocal[u.local] ||= []).push(u);
    for (const [local, us] of Object.entries(porLocal)) {
      const total = us.reduce((s, u) => s + u.n, 0), principal = [...us].sort((a, b) => b.n - a.n)[0];
      lista.push({ chave: `${c.id}:${local}`, ceo: c, k, local, total, icone: ICONE[principal.negocio] || '🏪', us, pulso: c.pulsos.find((p) => p.local === local) });
    }
  });
  return lista;
}

const seloHtml = (m, vista) => `<div class="selo${m.ceo.id === vista ? ' vista' : ''}${m.ceo.fora ? ' fora' : ''}" style="--cor:${m.ceo.cor}"><span>${m.icone}</span>${m.total > 1 ? `<b>${m.total}</b>` : ''}${m.pulso ? `<i>${PULSO[m.pulso.tipo] || '❗'}</i>` : ''}</div>`;
const baloeHtml = (m, nomes) => `<b style="color:${m.ceo.cor}">${m.ceo.nome}</b> em <b>${LOCAIS[m.local].nome}</b><br>${m.us.map((u) => `${ICONE[u.negocio] || ''} ${u.n} × ${nomes[u.negocio].toLowerCase()}`).join('<br>')}<br><small>público ${LOCAIS[m.local].renda >= 1.2 ? 'de renda alta' : LOCAIS[m.local].renda >= 0.95 ? 'de renda média' : 'de renda baixa'} · aluguel ${Math.round(LOCAIS[m.local].aluguel * 100)}% da média</small>`;
// Desloca cada empresário em um sentido, cerca de 250 m, para os selos não ficarem um sobre o outro.
const desloca = (l, k) => [l.lat + Math.cos(k * 2.1) * 0.0024, l.lng + Math.sin(k * 2.1) * 0.0026];

function mapaLeaflet(el, aoClicar) {
  const mapa = L.map(el, { zoomControl: false, attributionControl: true, minZoom: 4, maxZoom: 18 }).setView([VISTAS.campinas.lat, VISTAS.campinas.lng], VISTAS.campinas.zoom);
  L.control.zoom({ position: 'bottomright' }).addTo(mapa);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'ladrilho-jogo', attribution: '&copy; colaboradores do OpenStreetMap' }).addTo(mapa);
  const vivos = new Map();
  return {
    tipo: 'OpenStreetMap',
    atualizar(estado, vista, nomes) {
      const lista = marcadores(estado), chaves = new Set(lista.map((m) => m.chave));
      for (const [k, mk] of vivos) if (!chaves.has(k)) { mapa.removeLayer(mk); vivos.delete(k); }
      for (const m of lista) {
        const icon = L.divIcon({ className: 'selo-caixa', html: seloHtml(m, vista), iconSize: [40, 40], iconAnchor: [20, 20] });
        let mk = vivos.get(m.chave);
        if (!mk) { mk = L.marker(desloca(LOCAIS[m.local], m.k), { icon, riseOnHover: true }).addTo(mapa); mk.on('click', () => aoClicar(m.ceo.id)); vivos.set(m.chave, mk); }
        else mk.setIcon(icon);
        mk.setZIndexOffset(m.ceo.id === vista ? 1000 : 0);
        mk.bindPopup(baloeHtml(m, nomes), { closeButton: false, offset: [0, -14] });
      }
    },
    ver(qual) { const v = VISTAS[qual]; mapa.flyTo([v.lat, v.lng], v.zoom, { duration: 0.8 }); },
    enquadrar(pontos) { if (pontos.length) mapa.flyToBounds(L.latLngBounds(pontos.map((p) => [LOCAIS[p].lat, LOCAIS[p].lng])).pad(0.35), { duration: 0.8, maxZoom: 14 }); },
    redimensionar() { mapa.invalidateSize(); },
  };
}

function carregarGoogle(chave) {
  return new Promise((ok, erro) => {
    if (window.google?.maps) return ok();
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(chave)}&v=weekly&language=pt-BR&region=BR`;
    s.async = true; s.onload = () => (window.google?.maps ? ok() : erro(new Error('Google Maps não carregou'))); s.onerror = () => erro(new Error('falha ao carregar o Google Maps'));
    document.head.appendChild(s);
  });
}

function mapaGoogle(el, aoClicar) {
  const g = window.google.maps;
  const mapa = new g.Map(el, { center: { lat: VISTAS.campinas.lat, lng: VISTAS.campinas.lng }, zoom: VISTAS.campinas.zoom, styles: ESTILO_GOOGLE, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false });
  // Selos em HTML sobre o mapa, iguais aos do OpenStreetMap.
  class Selo extends g.OverlayView {
    constructor(pos) { super(); this.pos = pos; this.div = document.createElement('div'); this.div.className = 'selo-caixa'; this.div.style.position = 'absolute'; this.div.style.cursor = 'pointer'; }
    onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.div); }
    draw() { const p = this.getProjection().fromLatLngToDivPixel(this.pos); if (p) { this.div.style.left = `${p.x - 20}px`; this.div.style.top = `${p.y - 20}px`; } }
    onRemove() { this.div.remove(); }
  }
  const vivos = new Map(), balao = new g.InfoWindow();
  return {
    tipo: 'Google Maps',
    atualizar(estado, vista, nomes) {
      const lista = marcadores(estado), chaves = new Set(lista.map((m) => m.chave));
      for (const [k, s] of vivos) if (!chaves.has(k)) { s.setMap(null); vivos.delete(k); }
      for (const m of lista) {
        let s = vivos.get(m.chave);
        if (!s) { const [lat, lng] = desloca(LOCAIS[m.local], m.k); s = new Selo(new g.LatLng(lat, lng)); s.setMap(mapa); vivos.set(m.chave, s); }
        s.div.innerHTML = seloHtml(m, vista); s.div.style.zIndex = m.ceo.id === vista ? 1000 : 1;
        s.div.onclick = () => { aoClicar(m.ceo.id); balao.setContent(baloeHtml(m, nomes)); balao.setPosition(s.pos); balao.open({ map: mapa }); };
      }
    },
    ver(qual) { const v = VISTAS[qual]; mapa.panTo({ lat: v.lat, lng: v.lng }); mapa.setZoom(v.zoom); },
    enquadrar(pontos) { if (!pontos.length) return; const b = new g.LatLngBounds(); pontos.forEach((p) => b.extend({ lat: LOCAIS[p].lat, lng: LOCAIS[p].lng })); mapa.fitBounds(b, 80); if (mapa.getZoom() > 14) mapa.setZoom(14); },
    redimensionar() { g.event.trigger(mapa, 'resize'); },
  };
}

export async function criarMapa(el, chaveGoogle, aoClicar) {
  if (chaveGoogle) {
    try { await carregarGoogle(chaveGoogle); return mapaGoogle(el, aoClicar); } catch (e) { console.warn(`${e.message}; usando OpenStreetMap.`); }
  }
  return mapaLeaflet(el, aoClicar);
}
