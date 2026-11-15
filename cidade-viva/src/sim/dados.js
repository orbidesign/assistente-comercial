// Tabelas de conteúdo do jogo. Mexer aqui é a forma mais rápida de balancear.

export const BENS = {
  comida: { nome: 'Comida', base: 1 },
  materiais: { nome: 'Materiais', base: 2 },
  bens: { nome: 'Bens', base: 4 },
  servicos: { nome: 'Serviços', base: 3 },
};

export const ERAS = [
  { nome: 'Assentamento', pop: 0, conhecimento: 0 },
  { nome: 'Vila', pop: 35, conhecimento: 12 },
  { nome: 'Cidade Mercantil', pop: 100, conhecimento: 90, requer: 'estado' },
  { nome: 'Cidade Industrial', pop: 240, conhecimento: 450, requer: 'escola' },
  { nome: 'Metrópole', pop: 520, conhecimento: 1600, requer: 'universidade' },
];

// prod = unidades por trabalhador (família) por mês.
export const NEGOCIOS = {
  fazenda: { nome: 'Fazenda', era: 0, custo: 40, empregos: 3, produz: 'comida', prod: 9, lote: 'borda' },
  serraria: { nome: 'Serraria', era: 0, custo: 45, empregos: 3, produz: 'materiais', prod: 4, lote: 'borda' },
  oficina: { nome: 'Oficina', era: 1, custo: 70, empregos: 3, produz: 'bens', prod: 2.6, lote: 'centro' },
  venda: { nome: 'Venda', era: 1, custo: 60, empregos: 2, produz: 'servicos', prod: 3.6, lote: 'centro' },
  moinho: { nome: 'Moinho', era: 1, custo: 110, empregos: 3, produz: 'comida', prod: 13, lote: 'borda' },
  taverna: { nome: 'Taverna', era: 1, custo: 80, empregos: 3, produz: 'servicos', prod: 4, lote: 'centro' },
  tecelagem: { nome: 'Tecelagem', era: 2, custo: 180, empregos: 5, produz: 'bens', prod: 4.2, lote: 'centro' },
  banco: { nome: 'Banco', era: 2, custo: 260, empregos: 3, produz: 'servicos', prod: 7.5, lote: 'centro' },
  fabrica: { nome: 'Fábrica', era: 3, custo: 520, empregos: 9, produz: 'bens', prod: 8, lote: 'borda' },
  olaria: { nome: 'Olaria', era: 3, custo: 300, empregos: 6, produz: 'materiais', prod: 9, lote: 'borda' },
  escritorio: { nome: 'Escritório', era: 4, custo: 700, empregos: 8, produz: 'servicos', prod: 13, lote: 'centro' },
};

export const SERVICOS = {
  conselho: { nome: 'Casa do Conselho', era: 0, custo: 0, manut: 1 },
  guarda: { nome: 'Posto da Guarda', era: 1, custo: 70, manut: 3 },
  estrada: { nome: 'Estradas calçadas', era: 1, custo: 60, manut: 1, semPredio: true },
  escola: { nome: 'Escola', era: 1, custo: 80, manut: 3 },
  posto: { nome: 'Casa de Cura', era: 1, custo: 90, manut: 3 },
  saneamento: { nome: 'Chafariz e esgoto', era: 2, custo: 200, manut: 5 },
  hospital: { nome: 'Hospital', era: 3, custo: 350, manut: 9 },
  universidade: { nome: 'Universidade', era: 3, custo: 400, manut: 10 },
  ferrovia: { nome: 'Estação ferroviária', era: 3, custo: 500, manut: 8 },
};

export const CUSTO_CASA = [0, 15, 40, 90]; // materiais para chegar a cada nível

export const SOBRENOMES = [
  'Alvorada', 'Barroso', 'Cardim', 'Dornelas', 'Estrela', 'Faia', 'Garoa', 'Horta', 'Ilhéu', 'Jatobá',
  'Lume', 'Moreira', 'Nogueira', 'Oliva', 'Pedreira', 'Quintão', 'Ribeira', 'Salgueiro', 'Teixo', 'Urze',
  'Valverde', 'Xisto', 'Zimbro', 'Amieiro', 'Brejo', 'Cedro', 'Dourado', 'Espinho', 'Figueira', 'Giesta',
  'Lavra', 'Mata', 'Nascente', 'Orvalho', 'Pinhal', 'Roseira', 'Serra', 'Trigo', 'Vinhal', 'Vau',
];

export const NOMES_CIDADE = ['Vale do Lume', 'Ribeira Mansa', 'Pedra Clara', 'Campo da Aurora', 'Vau das Garças'];

export const TIPOS_EFEITO = [
  'producao', 'familias', 'riqueza', 'saude', 'felicidade', 'seguranca', 'educacao',
  'legitimidade', 'conhecimento', 'imposto', 'mortes', 'destruir', 'fundar_estado',
];
export const ALVOS_EFEITO = ['nenhum', 'tudo', 'comida', 'materiais', 'bens', 'servicos', 'todos', 'ricos', 'pobres', 'estado'];

const ef = (tipo, valor = 0, alvo = 'nenhum', meses = 0) => ({ tipo, alvo, valor, meses });

// Cartas de evento do narrador. Cada carta é só uma lista de efeitos primitivos,
// o mesmo formato que a IA devolve para eventos em texto livre.
export const CARTAS = [
  { id: 'seca', titulo: 'Seca', icone: '☀️', texto: 'Meses sem chuva racham a terra e as roças murcham.',
    chaves: ['seca', 'estiagem', 'sem chuva'], efeitos: [ef('producao', 0.45, 'comida', 8), ef('felicidade', -0.08)] },
  { id: 'fartura', titulo: 'Colheita farta', icone: '🌾', texto: 'Chuva na hora certa: os celeiros transbordam.',
    chaves: ['colheita', 'fartura', 'safra', 'chuva boa'], efeitos: [ef('producao', 1.6, 'comida', 8), ef('felicidade', 0.08)] },
  { id: 'caravana', titulo: 'Caravana de colonos', icone: '🛖', texto: 'Famílias de longe chegam pedindo um pedaço de chão.',
    chaves: ['imigra', 'colonos', 'caravana', 'refugiad', 'chegam famílias', 'forasteiros'], efeitos: [ef('familias', 4, 'pobres')] },
  { id: 'ouro', titulo: 'Veio de ouro', icone: '⛏️', texto: 'Um garimpeiro acha ouro no riacho. A notícia corre.',
    chaves: ['ouro', 'garimpo', 'mina', 'prata', 'tesouro'], efeitos: [ef('riqueza', 35, 'todos'), ef('familias', 3, 'pobres'), ef('seguranca', -0.2)] },
  { id: 'peste', titulo: 'Febre do vale', icone: '🤒', texto: 'Uma febre desconhecida passa de casa em casa.',
    chaves: ['peste', 'febre', 'epidemia', 'doença', 'praga'], efeitos: [ef('saude', -0.3), ef('mortes', 0.08), ef('producao', 0.75, 'tudo', 4)] },
  { id: 'incendio', titulo: 'Incêndio', icone: '🔥', texto: 'Uma fagulha, vento forte, e o fogo come telhados.',
    chaves: ['incêndio', 'incendio', 'fogo', 'queima'], efeitos: [ef('destruir', 3), ef('felicidade', -0.1)] },
  { id: 'magnata', titulo: 'Forasteiro rico', icone: '💰', texto: 'Um mercador endinheirado decide se instalar e investir.',
    chaves: ['mercador', 'rico', 'investidor', 'magnata', 'banqueiro', 'empresário'], efeitos: [ef('familias', 1, 'ricos')] },
  { id: 'mestre', titulo: 'Mestre viajante', icone: '📜', texto: 'Uma sábia andarilha ensina letras, contas e ofícios.',
    chaves: ['mestre', 'sábi', 'professor', 'invenç', 'descoberta', 'livro', 'técnica'], efeitos: [ef('conhecimento', 25), ef('educacao', 0.12)] },
  { id: 'bandoleiros', titulo: 'Bandoleiros', icone: '🗡️', texto: 'Um bando saqueia armazéns e some na serra.',
    chaves: ['bandid', 'bandoleir', 'saque', 'roubo', 'ladr', 'invas'], efeitos: [ef('riqueza', -12, 'todos'), ef('seguranca', -0.3), ef('felicidade', -0.08)] },
  { id: 'festa', titulo: 'Grande festa', icone: '🎉', texto: 'Música, fogueira e dança por três noites.',
    chaves: ['festa', 'festival', 'celebra', 'casamento', 'feira'], efeitos: [ef('felicidade', 0.18), ef('legitimidade', 0.06)] },
  { id: 'enchente', titulo: 'Enchente', icone: '🌊', texto: 'O rio sobe de madrugada e invade as margens.',
    chaves: ['enchente', 'cheia', 'inunda', 'tempestade'], efeitos: [ef('destruir', 2), ef('producao', 0.7, 'comida', 4), ef('saude', -0.1)] },
  { id: 'assembleia', titulo: 'Assembleia', icone: '⚖️', texto: 'O povo se reúne na praça e decide ter um governo.',
    chaves: ['assembleia', 'governo', 'eleiç', 'conselho', 'prefeit', 'lei'], efeitos: [ef('fundar_estado'), ef('legitimidade', 0.1)] },
  { id: 'derrama', titulo: 'Derrama', icone: '🧾', texto: 'O governo decreta um imposto pesado para encher os cofres.',
    chaves: ['imposto', 'tribut', 'taxa', 'derrama'], efeitos: [ef('imposto', 0.08), ef('legitimidade', -0.1)] },
];
