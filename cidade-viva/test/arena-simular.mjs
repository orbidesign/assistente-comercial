// Arena sem tela, com os três governos por regras. Uso: node test/arena-simular.mjs [semente] [anos]
import { criarArena, avancarArena, turnoDevido, aplicarTurno, rivaisPublicos, PROVEDORES } from '../src/arena/arena.js';
import { governoPorRegras, pontos } from '../src/sim/sim.js';
import { ERAS } from '../src/sim/dados.js';
const a = criarArena(+process.argv[2] || 1), anos = +process.argv[3] || 1000;
const t0 = Date.now();
for (let m = 0; m < anos * 12; m++) {
  avancarArena(a);
  if (turnoDevido(a)) for (const c of a.cidades) aplicarTurno(a, c, governoPorRegras(c.w, rivaisPublicos(a, c), process.argv[4] === 'iguais' ? 'equilibrado' : PROVEDORES[c.id].perfil));
  if (a.mes % (anos * 12 / 10) === 0) console.log(`ano ${a.mes / 12}: ` + a.cidades.map((c) => `${c.w.nome} ${ERAS[c.w.era].nome} pop ${c.w.ind.populacao} conh ${c.w.conhecimento | 0} ex ${c.w.estado.exercito} tes ${c.w.estado.tesouro | 0} pts ${pontos(c.w)}`).join(' | '));
}
console.log(`${Date.now() - t0} ms`); console.log(a.marcos.map((x) => `${ERAS[x.era].nome}: ${x.id} ano ${x.ano}`).join('\n'));
console.log(a.log.filter((l) => l.tipo === 'guerra').slice(0, 8).map((l) => `[${l.mes / 12 | 0}] ${l.texto}`).join('\n'));
