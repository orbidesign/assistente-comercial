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
Sem a chave o jogo funciona inteiro com regras. `CIDADE_MODELO` troca o modelo
(padrão `claude-opus-5-5`).

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
src/render/   three.js: vale, céu, vegetação, prédios procedurais, moradores
src/ui.js     painéis em HTML
server/       ponte com a API da Anthropic (eventos em texto livre e conselho anual)
test/         testes e simulador de linha de comando
```

## Estado atual

Verificado: simulação (10 testes, cinco sementes por 100 anos), a cena 3D em
navegador do assentamento à cidade industrial, cartas, texto livre sem IA,
inspetor, modo andar, salvar e recarregar.

Não verificado: as chamadas reais à IA. O servidor está escrito e responde
corretamente sem credencial, mas não havia chave neste ambiente para testar uma
resposta de verdade.

Limites conhecidos: o balanceamento é um primeiro passe (a cidade chega à
metrópole em 70 a 90 anos e depois estabiliza); o avatar atravessa paredes; no
celular dá para observar e narrar, mas não para andar.

## Próximos passos

1. Testar e afinar os agentes de IA com uma chave real; dar memória e
   personalidade persistente a cada empresário e ao conselho.
2. Política de verdade: eleições, facções, salário mínimo, corrupção, monopólios.
3. Vida visível: diálogos ao se aproximar com o avatar, mercado animado, festas e
   funerais, animais, barcos no rio.
4. Mais eras e ramificações (cidade operária, cidade mercante, cidade do saber).
5. Linha do tempo com gráficos e um "jornal" anual escrito pela IA.
6. Som ambiente e trilha que muda com a era.
