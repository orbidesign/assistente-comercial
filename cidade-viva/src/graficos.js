// Gráficos do painel, desenhados em canvas, com leitura por toque ou mouse.

const dinheiro = (v) => (Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(1)} bi` : Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)} mi` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)} mil` : `${Math.round(v)}`);

// series: [{ cor, pontos: [{ t, v }] }]. opcoes: { log, foco (t em destaque), moeda, deT, ateT }
export function desenharLinhas(canvas, series, opcoes = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return null;
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const m = { e: 50, d: 10, t: 10, b: 20 };
  const todos = series.flatMap((s) => s.pontos);
  if (!todos.length) return null;
  const deT = opcoes.deT ?? Math.min(...todos.map((p) => p.t)), ateT = Math.max(opcoes.ateT ?? Math.max(...todos.map((p) => p.t)), deT + 1);
  const visiveis = todos.filter((p) => p.t >= deT && p.t <= ateT).map((p) => p.v);
  let min = Math.min(...visiveis), max = Math.max(...visiveis);
  // Escala logarítmica quando os valores são positivos e variam mais de 50 vezes.
  const log = opcoes.log && min > 0 && max / Math.max(1, min) > 50;
  const f = (v) => (log ? Math.log10(Math.max(1, v)) : v);
  if (!log) { if (min > 0) min = 0; const folga = (max - min) * 0.08 || 1; max += folga; if (min < 0) min -= folga; } else { min /= 1.3; max *= 1.3; }
  const x = (t) => m.e + ((t - deT) / (ateT - deT)) * (W - m.e - m.d);
  const y = (v) => H - m.b - ((f(v) - f(min)) / (f(max) - f(min) || 1)) * (H - m.t - m.b);
  g.font = '11px Georgia, serif'; g.textBaseline = 'middle';
  // Linhas de grade com valores.
  const marcas = [];
  if (log) for (let e = Math.ceil(f(min)); e <= f(max); e++) marcas.push(10 ** e);
  else for (let i = 0; i <= 4; i++) marcas.push(min + ((max - min) * i) / 4);
  for (const v of marcas) {
    g.strokeStyle = Math.abs(v) < 1e-9 ? '#b6935a' : '#e2d3ac'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(m.e, y(v)); g.lineTo(W - m.d, y(v)); g.stroke();
    g.fillStyle = '#7a6248'; g.textAlign = 'right';
    g.fillText(opcoes.moeda === false ? Math.round(v).toLocaleString('pt-BR') : dinheiro(v), m.e - 5, y(v));
  }
  // Anos no eixo de baixo.
  const anos = (ateT - deT) / 12, passo = anos > 60 ? 20 : anos > 25 ? 10 : anos > 10 ? 5 : anos > 4 ? 2 : 1;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (let a = Math.ceil(deT / 12 / passo) * passo; a * 12 <= ateT; a += passo) { g.fillStyle = '#7a6248'; g.fillText(String(2026 + a), x(a * 12), H - 5); g.strokeStyle = '#efe3c2'; g.beginPath(); g.moveTo(x(a * 12), m.t); g.lineTo(x(a * 12), H - m.b); g.stroke(); }
  for (const s of series) {
    const pts = s.pontos.filter((p) => p.t >= deT && p.t <= ateT);
    if (!pts.length) continue;
    const salto = Math.max(1, Math.floor(pts.length / 500));
    g.beginPath();
    pts.forEach((p, i) => { if (i % salto === 0 || i === pts.length - 1) g.lineTo(x(p.t), y(log ? Math.max(1, p.v) : p.v)); });
    g.strokeStyle = s.cor; g.lineWidth = s.fino ? 1.6 : 2.6; g.lineJoin = 'round'; g.stroke();
    const u = pts[pts.length - 1];
    g.fillStyle = s.cor; g.beginPath(); g.arc(x(u.t), y(log ? Math.max(1, u.v) : u.v), 3.5, 0, 6.3); g.fill();
  }
  if (opcoes.foco !== undefined && opcoes.foco !== null && opcoes.foco >= deT && opcoes.foco <= ateT) {
    g.strokeStyle = '#3b2a1a'; g.setLineDash([4, 3]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(x(opcoes.foco), m.t); g.lineTo(x(opcoes.foco), H - m.b); g.stroke(); g.setLineDash([]);
    for (const s of series) { const p = s.pontos.find((q) => q.t === opcoes.foco); if (p) { g.fillStyle = '#fff'; g.strokeStyle = s.cor; g.lineWidth = 2.5; g.beginPath(); g.arc(x(p.t), y(log ? Math.max(1, p.v) : p.v), 4.5, 0, 6.3); g.fill(); g.stroke(); } }
  }
  // Devolve como converter um ponto da tela em mês.
  return { mesEm: (px) => Math.round(deT + Math.min(1, Math.max(0, (px - m.e) / (W - m.e - m.d))) * (ateT - deT)), log };
}

// Minigráfico sem eixos, para cartões e para o ranking.
export function desenharMini(canvas, valores, cor) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H || valores.length < 2) return;
  if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const min = Math.min(...valores), max = Math.max(...valores), amp = max - min || 1;
  const px = (i) => (i / (valores.length - 1)) * (W - 4) + 2, py = (v) => H - 3 - ((v - min) / amp) * (H - 6);
  g.beginPath(); valores.forEach((v, i) => g.lineTo(px(i), py(v)));
  g.strokeStyle = cor; g.lineWidth = 1.8; g.lineJoin = 'round'; g.stroke();
  g.lineTo(px(valores.length - 1), H); g.lineTo(px(0), H); g.globalAlpha = 0.14; g.fillStyle = cor; g.fill(); g.globalAlpha = 1;
}
