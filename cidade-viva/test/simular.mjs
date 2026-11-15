// Roda a simulação sem tela e imprime a trajetória. Uso: npm run simular -- [semente] [anos]
import { criarMundo, avancarMes } from '../src/sim/sim.js';
import { ERAS } from '../src/sim/dados.js';
const semente = +process.argv[2] || 1, anos = +process.argv[3] || 120;
const w = criarMundo(semente);
for (let a = 1; a <= anos; a++) {
  for (let m = 0; m < 12; m++) avancarMes(w);
  if (a % 10 === 0) {
    const i = w.ind;
    console.log(`ano ${String(a).padStart(3)} | ${ERAS[w.era].nome.padEnd(17)} pop ${String(i.populacao).padStart(4)} fam ${String(i.familias).padStart(3)} neg ${String(i.negocios).padStart(3)} | fel ${i.felicidade.toFixed(2)} sau ${i.saude.toFixed(2)} edu ${i.educacao.toFixed(2)} gini ${i.gini.toFixed(2)} | riq ${i.riquezaMedia.toFixed(0).padStart(5)} sal ${i.salario.toFixed(1)} emp ${i.emprego.toFixed(2)} | taxa ${(w.estado.taxa*100).toFixed(0)}% tes ${w.estado.tesouro.toFixed(0)} leg ${w.estado.legitimidade.toFixed(2)} serv ${w.estado.predios.length} | conh ${w.conhecimento.toFixed(0)} p ${Object.values(w.precos).map(v=>v.toFixed(1)).join('/')}`);
  }
}
console.log(w.log.filter(l => l.tipo === 'era' || l.tipo === 'estado').map(l => `[${Math.floor(l.mes/12)+1}] ${l.texto}`).slice(0, 25).join('\n'));
