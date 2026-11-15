// Interface em HTML por cima da cena 3D.
import { ERAS, NEGOCIOS, SERVICOS, CARTAS, BENS } from './sim/dados.js';
import { dataTexto } from './sim/sim.js';

const $ = (id) => document.getElementById(id);
const pct = (v) => `${Math.round(v * 100)}%`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const medidor = (rotulo, v, cor = '') => `<span>${rotulo}</span> ${pct(v)}<div class="medidor"><i style="width:${pct(v)};${cor && `background:${cor}`}"></i></div>`;

export function criarUI(acoes) {
  let ultimoLog = -1, selecionado = null;

  $('cartas').innerHTML = CARTAS.map((c) => `<button class="carta" data-carta="${c.id}" title="${esc(c.texto)}"><span>${c.icone}</span>${esc(c.titulo)}</button>`).join('');
  $('cartas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-carta]');
    if (b) acoes.carta(CARTAS.find((c) => c.id === b.dataset.carta));
  });
  $('narrar').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('texto').value.trim();
    if (t) { acoes.narrar(t); $('texto').value = ''; }
  });
  $('velocidade').addEventListener('click', (e) => { if (e.target.dataset.v) acoes.velocidade(+e.target.dataset.v); });
  $('andar').addEventListener('click', () => acoes.andar());
  $('novo').addEventListener('click', () => { if (confirm('Abandonar esta cidade e começar um novo vale?')) acoes.novo(); });
  $('insp-fechar').addEventListener('click', () => acoes.selecionar(null));

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
    $('indicadores').innerHTML = h;
  }

  function cronica(w) {
    const fim = w.log.length ? w.log[w.log.length - 1] : null;
    const marca = fim ? fim.mes * 1000 + w.log.length : -1;
    if (marca === ultimoLog) return;
    ultimoLog = marca;
    $('log').innerHTML = w.log.slice(-60).reverse().map((l) =>
      `<p class="${l.tipo}"><small>ano ${Math.floor(l.mes / 12) + 1}</small>${esc(l.texto)}</p>`).join('');
  }

  function grafico(w) {
    const c = $('grafico');
    if (!c.offsetWidth) return;
    c.width = c.offsetWidth * 2; c.height = 68;
    const g = c.getContext('2d');
    const pts = [...w.hist.map((h) => h.pop), w.ind.populacao];
    const max = Math.max(...pts, 30);
    g.beginPath();
    pts.forEach((p, i) => g.lineTo((i / Math.max(1, pts.length - 1)) * c.width, 64 - (p / max) * 58));
    g.strokeStyle = '#7a6248'; g.lineWidth = 3; g.stroke();
    g.lineTo(c.width, 68); g.lineTo(0, 68); g.fillStyle = 'rgba(217,161,58,.3)'; g.fill();
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
    atualizar(w, vel) {
      $('nome').textContent = w.nome;
      $('era').textContent = ERAS[w.era].nome;
      $('data').textContent = dataTexto(w);
      document.querySelectorAll('#velocidade button').forEach((b) => b.classList.toggle('ativo', +b.dataset.v === vel));
      indicadores(w); cronica(w); grafico(w); inspetor(w);
    },
    selecionar(info, w) { selecionado = info; inspetor(w); },
    ia(ativa, modelo) {
      $('ia').className = ativa ? '' : 'off';
      $('ia').innerHTML = ativa ? `<b>● IA ativa</b> — conselho e empresários decidem por conta própria` : '<b>○ IA desligada</b> — atores seguem regras';
      $('ia').title = ativa ? `Modelo: ${modelo}` : 'Defina ANTHROPIC_API_KEY e reinicie o servidor para ligar os agentes';
    },
    aviso(t) { $('aviso').textContent = t; },
    novaEra(nome) {
      $('faixa-texto').textContent = nome;
      $('faixa').classList.add('visivel');
      setTimeout(() => $('faixa').classList.remove('visivel'), 4200);
    },
    andando(sim) { $('andar').classList.toggle('ativo', sim); $('andar').textContent = sim ? '🦅 Voar' : '🚶 Andar'; },
  };
}
