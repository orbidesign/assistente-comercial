// Interface em HTML por cima da cena 3D. Pensada primeiro para o toque.
import { ERAS, NEGOCIOS, SERVICOS, CARTAS, BENS } from './sim/dados.js';
import { dataTexto } from './sim/sim.js';

const $ = (id) => document.getElementById(id);
const pct = (v) => `${Math.round(v * 100)}%`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const medidor = (rotulo, v, cor = '') => `<span>${rotulo}</span> ${pct(v)}<div class="medidor"><i style="width:${pct(v)};${cor && `background:${cor}`}"></i></div>`;

export function criarUI(acoes) {
  let ultimoVisto = null, selecionado = null, cartaEscolhida = null;
  const joy = { x: 0, y: 0 };

  // ----- cartas: um toque mostra o que a carta faz, o botão Jogar confirma -----
  $('cartas').innerHTML = CARTAS.map((c) => `<button class="carta" data-carta="${c.id}"><span>${c.icone}</span>${esc(c.titulo)}</button>`).join('');
  function escolher(c) {
    cartaEscolhida = c;
    document.querySelectorAll('.carta').forEach((b) => b.classList.toggle('escolhida', !!c && b.dataset.carta === c.id));
    $('previa').classList.toggle('visivel', !!c);
    if (c) { $('previa-titulo').textContent = `${c.icone} ${c.titulo}`; $('previa-texto').textContent = c.texto; }
  }
  $('cartas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-carta]');
    if (!b) return;
    const c = CARTAS.find((q) => q.id === b.dataset.carta);
    escolher(cartaEscolhida === c ? null : c);
  });
  $('jogar').addEventListener('click', () => { if (cartaEscolhida) { acoes.carta(cartaEscolhida); escolher(null); } });
  $('narrar').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('texto').value.trim();
    if (t) { acoes.narrar(t); $('texto').value = ''; $('texto').blur(); }
  });
  $('recolher').addEventListener('click', () => {
    const r = $('doca').classList.toggle('recolhida');
    $('recolher').textContent = r ? '🃏 Narrar ▴' : '▾';
  });

  $('velocidade').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) acoes.velocidade(+b.dataset.v); });
  $('b-andar').addEventListener('click', () => acoes.andar());
  $('b-cinema').addEventListener('click', () => acoes.cinema());
  $('b-foto').addEventListener('click', () => acoes.hora());
  $('b-cronica').addEventListener('click', () => $('cronica').classList.toggle('aberta'));
  $('c-fechar').addEventListener('click', () => $('cronica').classList.remove('aberta'));
  $('novo').addEventListener('click', () => { if (confirm('Abandonar esta cidade e começar um novo vale?')) acoes.novo(); });
  $('insp-fechar').addEventListener('click', () => acoes.selecionar(null));
  $('insp-ir').addEventListener('click', () => acoes.irAte());

  // Em tela baixa (celular deitado) a doca começa recolhida para não cobrir a cidade.
  if (window.innerHeight < 480) $('recolher').click();

  // A altura da doca muda (recolhida, com prévia…); o resto da tela se ajusta por esta variável.
  new ResizeObserver(() => document.documentElement.style.setProperty('--doca', `${$('doca').offsetHeight}px`)).observe($('doca'));

  // ----- alavanca de toque -----
  const elJoy = $('joy'), pino = elJoy.firstElementChild;
  let dedo = null;
  const moverJoy = (e) => {
    const r = elJoy.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / 40, y = (e.clientY - r.top - r.height / 2) / 40;
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    joy.x = x; joy.y = y;
    pino.style.transform = `translate(${x * 32}px, ${y * 32}px)`;
  };
  elJoy.addEventListener('pointerdown', (e) => { dedo = e.pointerId; elJoy.setPointerCapture(dedo); moverJoy(e); });
  elJoy.addEventListener('pointermove', (e) => { if (e.pointerId === dedo) moverJoy(e); });
  const soltar = (e) => { if (e.pointerId === dedo) { dedo = null; joy.x = joy.y = 0; pino.style.transform = ''; } };
  elJoy.addEventListener('pointerup', soltar);
  elJoy.addEventListener('pointercancel', soltar);

  function chip(icone, rotulo, valor, titulo = '') {
    return `<div class="chip" title="${esc(titulo)}">${icone} <b>${valor}</b><small>${rotulo}</small></div>`;
  }

  function indicadores(w) {
    const i = w.ind, e = w.estado;
    let h = chip('👥', 'habitantes', i.populacao) + chip('🏠', 'famílias', i.familias) + chip('🏪', 'negócios', i.negocios)
      + chip('😊', 'felicidade', pct(i.felicidade)) + chip('❤️', 'saúde', pct(i.saude)) + chip('📚', 'educação', pct(i.educacao))
      + chip('⚖️', 'desigualdade', pct(i.gini), 'Índice de Gini da riqueza das famílias')
      + chip('🪙', 'salário', i.salario.toFixed(1), `Preços — ${Object.entries(w.precos).map(([k, v]) => `${BENS[k].nome}: ${v.toFixed(1)}`).join(' · ')}`)
      + chip('🛡️', 'segurança', pct(w.seguranca));
    if (e.existe) {
      h += chip('🏛️', 'imposto', pct(e.taxa)) + chip('💰', 'tesouro', Math.round(e.tesouro)) + chip('👑', 'legitimidade', pct(e.legitimidade));
      h += `<div id="tensao" title="Para que lado pende a força: governo forte e legítimo, ou donos de negócio ricos e influentes">
        <span style="color:var(--estado)">Estado</span><div class="barra"><div class="marca" style="left:${pct(0.5 + (i.influencia - e.legitimidade) * 0.5)}"></div></div>
        <span style="color:var(--negocio)">Empresários</span></div>`;
    } else h += chip('🏛️', '', 'sem governo', 'Ainda não há Estado: nem impostos, nem serviços públicos');
    const el = $('ind'), rolagem = el.scrollLeft;
    el.innerHTML = h;
    el.scrollLeft = rolagem;
  }

  function toast(texto, tipo = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${tipo}`;
    el.textContent = texto;
    const caixa = $('toasts');
    caixa.appendChild(el);
    while (caixa.children.length > 3) caixa.firstChild.remove();
    setTimeout(() => el.remove(), 6000);
  }

  function cronica(w) {
    const fim = w.log[w.log.length - 1] || null;
    if (fim === ultimoVisto) return [];
    const desde = w.log.indexOf(ultimoVisto);
    const novos = ultimoVisto ? w.log.slice(desde + 1) : [];
    ultimoVisto = fim;
    $('log').innerHTML = w.log.slice(-70).reverse().map((l) =>
      `<p class="${l.tipo}"><small>ano ${Math.floor(l.mes / 12) + 1}</small>${esc(l.texto)}</p>`).join('');
    // Depois de um salto grande no tempo não faz sentido empilhar dezenas de avisos.
    if (novos.length <= 4) novos.forEach((l) => toast(l.texto, l.tipo));
    return novos;
  }

  function grafico(w) {
    const c = $('grafico');
    if (!c.offsetWidth) return;
    c.width = c.offsetWidth * 2; c.height = 60;
    const g = c.getContext('2d');
    const pts = [...w.hist.map((h) => h.pop), w.ind.populacao];
    const max = Math.max(...pts, 30);
    g.beginPath();
    pts.forEach((p, i) => g.lineTo((i / Math.max(1, pts.length - 1)) * c.width, 56 - (p / max) * 50));
    g.strokeStyle = '#7a6248'; g.lineWidth = 3; g.stroke();
    g.lineTo(c.width, 60); g.lineTo(0, 60); g.fillStyle = 'rgba(217,161,58,.3)'; g.fill();
  }

  function inspetor(w) {
    const el = $('inspetor');
    if (!selecionado) { el.style.display = 'none'; return; }
    const { classe, id } = selecionado;
    let titulo = '', corpo = '';
    if (classe === 'casa') {
      const f = w.familias.find((q) => q.id === id);
      if (!f) return acoes.selecionar(null);
      const n = f.emprego ? w.negocios.find((q) => q.id === f.emprego) : null;
      const seus = w.negocios.filter((q) => q.dono === f.id);
      const oficio = seus.length ? `donos de ${seus.map((q) => NEGOCIOS[q.tipo].nome.toLowerCase()).join(', ')}`
        : n ? `trabalham na ${NEGOCIOS[n.tipo].nome.toLowerCase()} dos ${w.familias.find((q) => q.id === n.dono)?.nome}` : 'vivem da própria roça';
      titulo = `Família ${f.nome}`;
      corpo = `<span>${f.membros} pessoas · ${['cabana', 'casa de madeira', 'casa de pedra', 'sobrado'][f.nivelCasa]}</span><br>
        ${esc(oficio)}<br><span>Riqueza</span> ${Math.round(f.riqueza)} moedas · <span>renda</span> ${f.renda.toFixed(1)}/mês<br>
        ${medidor('Felicidade', f.felicidade)}${medidor('Saúde', f.saude, '#c9584f')}${medidor('Educação', f.educacao, '#4f7fc9')}
        <span>Aqui desde o ano ${Math.floor(f.chegou / 12) + 1}</span>`;
    } else if (classe === 'negocio') {
      const n = w.negocios.find((q) => q.id === id);
      if (!n) return acoes.selecionar(null);
      const def = NEGOCIOS[n.tipo];
      titulo = `${def.nome} (nível ${n.nivel})`;
      corpo = `<span>Dos</span> ${esc(w.familias.find((q) => q.id === n.dono)?.nome || '?')}<br>
        <span>Produz</span> ${BENS[def.produz].nome.toLowerCase()} · <span>emprega</span> ${n.funcionarios.length} de ${def.empregos * n.nivel - 1} famílias<br>
        <span>Salário</span> ${n.salario.toFixed(1)} · <span>caixa</span> ${Math.round(n.capital)}<br>
        <span>Lucro do mês</span> <b style="color:${n.lucro >= 0 ? 'var(--bom)' : 'var(--ruim)'}">${n.lucro.toFixed(1)}</b><br>
        <span>Aberta no ano ${Math.floor(n.aberto / 12) + 1}</span>`;
    } else {
      const p = w.estado.predios.find((q) => q.id === id);
      if (!p) return acoes.selecionar(null);
      titulo = SERVICOS[p.tipo].nome;
      corpo = `<span>Prédio público, mantido com impostos.</span><br><span>Custo mensal base</span> ${SERVICOS[p.tipo].manut} moedas<br>
        <span>Inaugurado no ano ${Math.floor(p.mes / 12) + 1}</span>`;
    }
    $('insp-titulo').textContent = titulo;
    $('insp-corpo').innerHTML = corpo;
    el.style.display = 'block';
  }

  return {
    joy,
    // Devolve as entradas novas da crônica, para a cena reagir a elas.
    atualizar(w, vel) {
      $('nome').textContent = w.nome;
      $('era').textContent = ERAS[w.era].nome;
      $('data').textContent = dataTexto(w);
      document.querySelectorAll('#velocidade button').forEach((b) => b.classList.toggle('ativo', +b.dataset.v === vel));
      indicadores(w); grafico(w); inspetor(w);
      return cronica(w);
    },
    selecionar(info, w) { selecionado = info; inspetor(w); },
    ia(s) {
      $('ia').className = s.ia ? '' : 'off';
      $('ia').innerHTML = s.ia
        ? `<b>● IA ativa</b> · gasto US$ ${s.gasto.toFixed(4)} de ${s.limite.toFixed(2)}<br>${s.chamadas} chamadas · ${esc(s.modelo)}`
        : '<b>○ IA desligada</b><br>Estado e empresários seguem regras';
    },
    aviso(t) { $('aviso').textContent = t; },
    toast,
    novaEra(nome) {
      $('faixa-texto').textContent = nome;
      $('faixa').classList.add('visivel');
      setTimeout(() => $('faixa').classList.remove('visivel'), 4200);
    },
    andando(sim) { $('b-andar').classList.toggle('ativo', sim); $('b-andar').textContent = sim ? '🦅' : '🚶'; document.body.classList.toggle('andando', sim); },
    cinema(sim) { $('b-cinema').classList.toggle('ativo', sim); document.body.classList.toggle('cinema', sim); $('cronica').classList.remove('aberta'); },
  };
}
