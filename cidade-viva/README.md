# Cidade Viva

Um vale vazio, cinco famílias e uma fogueira. A cidade cresce sozinha, e você é o
**narrador**: não governa nem empreende, só provoca situações e assiste ao que o
**Estado** e os **empresários** fazem com elas.

Protótipo de testes. Vive numa pasta isolada deste repositório até ganhar um
repositório próprio.

## Rodar

```bash
cd cidade-viva
npm install
npm run dev        # jogo em http://localhost:5173 (servidor de IA na porta 8787)
npm test           # testes da simulação
npm run simular -- 3 150   # semente 3, 150 anos, sem tela: imprime a trajetória
```

Para ligar os agentes de IA, defina `ANTHROPIC_API_KEY` antes do `npm run dev`.
Sem a chave o jogo funciona inteiro com regras.

### Custo da IA

O jogo foi montado para gastar pouco:

- O modelo padrão é o mais barato (`claude-haiku-5-5`, US$ 0,10 por milhão de
  tokens de entrada e US$ 0,50 de saída). `CIDADE_MODELO` troca o modelo.
- As regras da simulação rodam sempre. A IA entra por cima, em dois momentos:
  quando você narra em texto livre, e na reunião do conselho, que acontece no
  máximo a cada 3 anos de jogo e nunca mais de uma vez por minuto.
- Cada chamada usa em torno de 1.500 tokens de entrada e algumas centenas de
  saída, o que no modelo padrão fica na casa de US$ 0,0005. É uma estimativa
  pelos preços de tabela; não foi medida com uma chamada real.
- Há um teto de gasto por execução do servidor (`CIDADE_LIMITE_USD`, padrão
  0,50). Ao atingir, a IA desliga e o jogo segue com regras.
- Narrações repetidas vêm de memória, sem nova chamada. O gasto acumulado
  aparece no rodapé da crônica.

## Controles

| | Toque (celular, iPad) | Mouse e teclado |
| --- | --- | --- |
| Girar a câmera | arrastar com um dedo | arrastar |
| Zoom e mover | pinça e arrastar com dois dedos | roda e botão direito |
| Ver uma família ou prédio | tocar | clicar |
| Voar até um ponto | tocar duas vezes | duplo clique |
| Andar pela cidade | 🚶, depois alavanca ou toque no chão | `V`, depois WASD |
| Só assistir | 🎬 (câmera passeia sozinha) | `C` |
| Trocar a hora do dia | 🌗 | 🌗 |
| Jogar uma carta | tocar na carta, depois Jogar | igual |

## Arena das IAs

Segundo modo de jogo, em `arena.html` (link "⚔️ Arena" na crônica do modo
narrador). Três cidades nascem iguais, da mesma semente, e cada uma tem o
governo entregue a uma API: Claude (Anthropic), Grok (xAI) e Gemini (Google).
O povo e os empresários seguem as mesmas regras nas três; só o governo muda.

```bash
ANTHROPIC_API_KEY=... XAI_API_KEY=... GEMINI_API_KEY=... npm run dev
# abrir http://localhost:5173/arena.html
npm run arena:simular -- 7 600     # disputa sem tela, só com governos de regras
```

- **Turnos.** A cada 5 anos de jogo os três governos decidem ao mesmo tempo,
  vendo a mesma situação, e o relógio espera as respostas: a latência de uma
  API não vira vantagem nem prejuízo.
- **O que um governo decide.** Imposto, uma obra, recrutar ou dispensar
  soldados, dinheiro para pesquisa, auxílio aos pobres, fomento a um negócio,
  uma mensagem diplomática, atacar uma rival, uma fala pública e uma nota para
  si mesmo (a única memória entre reuniões).
- **Verba em tokens.** Para a disputa ser justa, a verba não é em dinheiro: as
  três APIs recebem a mesma quantidade de tokens, 2 milhões no jogo inteiro e
  no máximo 400 mil por milênio, liberados aos poucos. Conta tudo o que a IA
  lê, raciocina e escreve, como cada API informa. Cada governo marca a própria
  próxima reunião (de 5 a 50 anos): pensar muito ou se reunir demais esgota a
  verba, e sem verba as políticas ficam congeladas. Resposta que não é JSON
  válido perde a reunião e os tokens. O servidor conta os tokens em disco
  (`.arena-gasto.json`) e recusa chamadas acima do teto.
- **Guerra.** Um ataque leva 70% do exército e chega em um ano. Vitória rende
  saque e destrói construções da rival; derrota custa a maior parte da tropa.
  Quem defende tem vantagem.
- **Pontos.** Era, população, conhecimento, felicidade e educação. Na arena o
  conhecimento cresce dez vezes mais devagar e há três eras a mais (Elétrica,
  Digital, Solar), para a corrida ocupar o milênio.
- **Sem chave.** A cidade é governada por regras com um temperamento fixo
  (sábio, guerreiro, mercador). Serve de demonstração e de linha de base; não
  diz nada sobre o modelo de verdade.

Modelos e preços são configuráveis, porque mudam com frequência:

| Variável | Padrão |
| --- | --- |
| `ARENA_MODELO_ANTHROPIC` / `ARENA_PRECO_ANTHROPIC` | `claude-sonnet-5-5` / `2,10` |
| `ARENA_MODELO_XAI` / `ARENA_PRECO_XAI` | `grok-4.7` / `2,6` |
| `ARENA_MODELO_GEMINI` / `ARENA_PRECO_GEMINI` | `gemini-3.1-pro` / `2,12` |
| `ARENA_TOKENS` | `2000000` |

Os preços (dólares por milhão de tokens de entrada e de saída) servem só para
mostrar quanto a partida custou; não entram nas regras. Os identificadores e
preços de Grok e Gemini vieram de páginas de terceiros, não das tabelas
oficiais: confira antes de jogar valendo. `ARENA_ENSAIO=1` roda o fluxo
inteiro com respostas simuladas, sem chamar nem gastar nada.

### Como saber qual é mais inteligente

Uma partida só é anedota: há sorte nos dados da simulação e nas batalhas. O
que vale é o torneio, que repete a disputa em várias sementes e resume.

```bash
npm run torneio -- --modo solo  --sementes 10 --anos 300
npm run torneio -- --modo arena --sementes 10 --anos 500
```

- **Prova solo (governança).** Cada IA governa sozinha as mesmas cidades
  iniciais, sem rivais. Entram duas referências: `regras` (governo de regras) e
  `ausente` (ninguém governa). Responde "quem faz a cidade prosperar mais
  rápido" sem a interferência da guerra.
- **Prova arena (estratégia).** As três juntas, com diplomacia e guerra.
- **O que é medido.** Ano em que cada era é alcançada, pontos em marcos fixos
  e no fim, componentes separados (população, saber, felicidade, educação,
  riqueza, desigualdade), tokens gastos, pontos por 100 mil tokens, respostas
  inválidas e, na arena, guerras vencidas e perdidas.
- **Como ler.** A tabela traz média e desvio entre sementes. Diferença menor
  que o desvio não permite conclusão; rode mais sementes. O arquivo completo
  de cada torneio fica em `resultados/`.

Com 4 sementes e 300 anos, o governo de regras fez 2.254 pontos em média
(desvio 612) contra 886 da cidade sem governo: a medida responde a governo, e
uma IA só "é inteligente" aqui se superar as regras com folga.

Limites do método: cada API conta tokens com o próprio tokenizador, então a
mesma frase pode valer um pouco mais ou menos em cada uma; o resultado vale
para os modelos configurados, não para a empresa; e os pontos são uma fórmula
escolhida, por isso os componentes são reportados separados.

Verificado: a lógica (testes de determinismo, guerra, verba e decisões
malformadas), a tela em desktop, iPhone e iPad emulados, com governos de regras
e com o modo de ensaio. Não verificado: nenhuma chamada real a nenhuma das três
APIs, porque não havia chaves neste ambiente.

## Decisões de design

| Pergunta | Decisão |
| --- | --- |
| Papel do jogador | Narrador. Estado e empresários são atores autônomos. |
| Cérebro dos atores | Híbrido: famílias seguem regras; conselho e as três famílias mais ricas podem ser agentes de IA. |
| Visual | 3D estilizado em cel-shading, natureza detalhada, dia e noite, estações. |
| Câmera | Voo livre por padrão; tecla `V` desce um avatar para andar pelas ruas. |
| Eventos | Baralho de cartas prontas e texto livre interpretado pela IA. |
| Cenário | Vila de fantasia sem magia, do assentamento à metrópole. |
| "Evoluir" | Economia, qualidade de vida, instituições e eras, tudo ao mesmo tempo. |

## Como a cidade funciona

Um passo da simulação é um mês (4 segundos na velocidade normal).

- **Famílias** começam na roça de subsistência. A terra é limitada: com gente
  demais a roça não alimenta, e isso empurra as pessoas para o emprego ou para fora.
- **Empresários** são famílias com poupança que enxergam um preço alto e abrem um
  negócio. Contratam, pagam salário, lucram ou quebram, ampliam, acumulam. Com um
  banco na cidade passa a existir crédito.
- **Mercado** de quatro bens (comida, materiais, bens, serviços) com preços que
  sobem na falta e caem na sobra. Uma caravana compra o excedente e vende comida
  cara quando falta.
- **Estado** nasce em assembleia quando a vila cresce e a segurança cai. Cobra
  imposto, constrói guarda, escola, casa de cura, estradas, saneamento, hospital,
  universidade e ferrovia. Paga obra pública a quem vende materiais. Se perde a
  legitimidade por tempo demais, é derrubado.
- **Tensão**: imposto alto derruba a confiança de quem investe; empresários ricos
  fazem lobby; salário curto com patrão lucrando vira greve.
- **Eras**: Assentamento, Vila, Cidade Mercantil, Cidade Industrial, Metrópole.
  Cada uma exige população, conhecimento e uma instituição, e destrava negócios,
  serviços e casas melhores.

O narrador age por **efeitos primitivos** (`producao`, `familias`, `riqueza`,
`saude`, `mortes`, `destruir`, `fundar_estado`…). Uma carta é uma lista desses
efeitos, e a IA devolve exatamente o mesmo formato para um texto livre, então
qualquer situação cabe no jogo sem código novo.

## Estrutura

```
src/sim/      simulação pura (sem tela), determinística por semente, estado em JSON
  dados.js    tabelas: bens, eras, negócios, serviços, cartas  <- balanceamento
  sim.js      o mês, mercado, Estado, eventos, decisões dos agentes
  geo.js      forma do vale e lotes de construção
src/arena/    lógica da Arena: turnos, verba, diplomacia e guerra
src/render/   three.js: vale, céu, clima, prédios procedurais, moradores, efeitos
src/ui.js     painéis em HTML
server/       ponte com as APIs: eventos e conselho (Anthropic) e os três governos da Arena
test/         testes e simulador de linha de comando
```

## Estado atual

Verificado: simulação (10 testes, cinco sementes por 100 anos); a cena 3D em
navegador do assentamento à cidade industrial; cartas, texto livre sem IA,
inspetor, modo andar, modo cinema, efeitos de evento, salvar e recarregar; e a
interface em emulação de iPhone e iPad, em pé e deitado, com toque.

Não verificado em aparelho físico: o teste de toque foi feito por emulação no
Chromium. Desempenho real em iPhone e iPad ainda precisa ser conferido; a cena
reduz a própria resolução se o aparelho não acompanhar.

Não verificado: as chamadas reais à IA. O servidor está escrito e responde
corretamente sem credencial, mas não havia chave neste ambiente para testar uma
resposta de verdade.

Limites conhecidos: o balanceamento é um primeiro passe (a cidade chega à
metrópole em 70 a 90 anos e depois estabiliza); o avatar atravessa paredes.

## Próximos passos

1. Testar e afinar os agentes de IA com uma chave real; dar memória e
   personalidade persistente a cada empresário e ao conselho.
2. Política de verdade: eleições, facções, salário mínimo, corrupção, monopólios.
3. Vida visível: diálogos ao se aproximar com o avatar, mercado animado, festas e
   funerais, animais, barcos no rio.
4. Mais eras e ramificações (cidade operária, cidade mercante, cidade do saber).
5. Linha do tempo com gráficos e um "jornal" anual escrito pela IA.
6. Som ambiente e trilha que muda com a era.
