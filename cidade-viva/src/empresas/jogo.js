// Três empresários (Claude, Grok, Gemini) começam iguais em janeiro de 2026: uma
// padaria de bairro em Campinas, R$ 20 mil no caixa da empresa. O jogo anda mês
// a mês até dezembro de 2075 (50 anos). Vence quem tiver o maior patrimônio pessoal
// (bens próprios mais o valor da empresa). Lógica pura, determinística, em JSON.
// Dinheiro em reais, a preços de 2026 (sem inflação).
import { LOCAIS, PONTO_INICIAL } from './campinas.js';
import { criarMunicipio, avancarAno, aplicarDecisao, prefeitoPorRegras, cenarioDoAno, retrato, ANO_INICIAL } from '../brasil/municipio.js';

export const TOKENS_JOGO = 5_000_000;   // verba igual para os três: dá para 600 despachos mensais enxutos
export const CAIXA_INICIAL = 20_000;
export const MESES = 600;   // 50 anos: de janeiro de 2026 a dezembro de 2075
export const NOME_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SAZONAL = [0.9, 0.88, 0.97, 1, 1.03, 1.08, 1.02, 0.98, 0.98, 1.02, 1.02, 1.2];   // dezembro forte, verão fraco

export const CEOS = {
  anthropic: { nome: 'Claude', casa: 'Anthropic', cor: '#d97757', marca: 'Lume', perfil: 'diversificador' },
  xai: { nome: 'Grok', casa: 'xAI', cor: '#3a3a44', marca: 'Pedra', perfil: 'expansionista' },
  gemini: { nome: 'Gemini', casa: 'Google', cor: '#4a8fe8', marca: 'Ribeira', perfil: 'padeiro' },
};

// Regras brasileiras que entram na conta (o README separa lei de modelo).
export const REGRAS = {
  simplesTeto: 4_800_000,   // Simples Nacional: receita dos últimos 12 meses até R$ 4,8 milhões
  simples: [[180_000, 0.04, 0], [360_000, 0.073, 5_940], [720_000, 0.095, 13_860], [1_800_000, 0.107, 22_500], [3_600_000, 0.143, 87_300], [4_800_000, 0.19, 378_000]],
  encargosSimples: 0.35, encargos: 0.7, rescisao: 0.25,
  tributoVendas: 0.09, iva: 0.265, ivaAlimentos: 0.5, anoIVA: 2033, irpj: 0.34, irAplicacao: 0.15,
  pisoSalarial: 0.7,                        // salário mínimo de 2026 (R$ 1.621) sobre o salário de mercado do setor
  inssProLabore: 0.11, tetoInss: 932.31,    // 11% sobre o pró-labore, até o teto de contribuição de 2026 (R$ 8.475,55)
  // IRPF mensal: tabela progressiva em vigor (limite da faixa, alíquota, parcela a deduzir)
  irpf: [[2_428.80, 0, 0], [2_826.65, 0.075, 182.16], [3_751.05, 0.15, 394.16], [4_664.68, 0.225, 675.49], [Infinity, 0.275, 908.73]],
  isentoIRPF: 5_000, reducaoAte: 7_350,     // Lei 15.270/2025: imposto zero até R$ 5 mil; redução parcial até R$ 7.350
  lucrosIsentos: 50_000, irLucros: 0.1,     // Lei 15.270/2025: lucros acima de R$ 50 mil por mês, 10% na fonte
  // Lucro presumido (comércio): presunção de 8% (IRPJ) e 12% (CSLL); IRPJ 15% mais 10% sobre o que passa de R$ 20 mil por mês; CSLL 9%
  presumidoTeto: 78_000_000, presIRPJ: 0.08, presCSLL: 0.12, irpjBase: 0.15, irpjAdicional: 0.1, adicionalAcima: 20_000, csll: 0.09,
  // Ganho de capital da pessoa física na venda da empresa (Lei 13.259/2016)
  ganhoDeCapital: [[5_000_000, 0.15], [10_000_000, 0.175], [30_000_000, 0.2], [Infinity, 0.225]],
};

// Imposto de renda do mês sobre o pró-labore (k acompanha a renda real da cidade).
export function irpfMensal(bruto, inss = 0, k = 1) {
  const b = bruto / k, base = Math.max(0, (bruto - inss) / k);
  if (b <= REGRAS.isentoIRPF) return 0;
  const f = REGRAS.irpf.find(([teto]) => base <= teto);
  let ir = Math.max(0, base * f[1] - f[2]);
  if (b <= REGRAS.reducaoAte) ir = Math.max(0, ir - (978.62 - 0.133145 * b));
  return ir * k;
}
// Imposto sobre o ganho de capital, por faixas.
export function impostoGanhoDeCapital(ganho) {
  let ir = 0, antes = 0;
  for (const [teto, aliq] of REGRAS.ganhoDeCapital) { if (ganho <= antes) break; ir += (Math.min(ganho, teto) - antes) * aliq; antes = teto; }
  return ir;
}

// Canais de divulgação e crescimento. O que cada um rende NÃO está escrito em
// lugar nenhum que o empresário leia: depende do negócio, da mensagem, da época
// e da sorte. Só se descobre testando e olhando o resultado.
export const CANAIS = {
  instagram_posts: 'Instagram: posts e reels próprios', instagram_anuncios: 'Instagram: anúncios pagos', influenciador: 'Parceria com influenciador local',
  whatsapp: 'Lista de clientes e pedidos por WhatsApp', google: 'Perfil no Google e avaliações', app_de_entrega: 'Aplicativos de entrega',
  fidelidade: 'Programa de fidelidade', panfleto: 'Panfleto e carro de som no bairro', degustacao: 'Degustação e eventos na loja',
  produto_novo: 'Lançamento de produto novo', empresas: 'Venda para empresas, escolas e condomínios', radio_e_jornal: 'Rádio e jornal local', video_curto: 'Vídeos curtos em outras redes',
};
export const ABORDAGENS = ['produto', 'preco', 'bastidores', 'clientes', 'humor', 'bairro'];

// Quem governa muda as regras do jogo para o empresário. Eleição federal em
// outubro de 2026, 2030, ...; municipal em 2028, 2032, ... Posse em janeiro.
export const GOVERNO = {
  federal: {
    esquerda: { irpj: 0.03, encargos: 0.04, fiscalizacao: 1.3, salarioMercado: 1.04, demanda: 1.03, jurosPequenos: -0.015, texto: 'mais imposto sobre lucro e encargos, fiscalização mais dura, piso salarial maior; consumo popular e crédito público para pequenos também sobem' },
    direita: { irpj: -0.03, encargos: -0.05, fiscalizacao: 0.8, salarioMercado: 1, demanda: 1, jurosPequenos: 0, texto: 'menos imposto sobre lucro e encargos, fiscalização mais leve, piso salarial parado; sem empurrão no consumo nem crédito subsidiado' },
  },
  municipal: {
    esquerda: { fixos: 1.06, fiscalizacao: 1.2, licitacao: 2.5, movimento: 1.02, capex: 1, assalto: 1, texto: 'taxas municipais mais altas e mais fiscalização; mais compras públicas (merenda) e mais movimento nos bairros' },
    direita: { fixos: 0.95, fiscalizacao: 0.9, licitacao: 1, movimento: 1, capex: 0.95, assalto: 0.85, texto: 'taxas menores, alvará mais rápido e barato, mais policiamento; menos compras públicas' },
  },
};

// O que um empresário pode ter. Valores por unidade, por ANO, a preços de 2026.
export const NEGOCIOS = {
  padaria: { nome: 'Padaria de bairro', capex: 350_000, receita: 900_000, insumo: 0.3, func: 8, aluguel: 60_000, S: 150, complexidade: 1 },
  cafeteria: { nome: 'Cafeteria e confeitaria', capex: 380_000, receita: 900_000, insumo: 0.29, func: 7, aluguel: 110_000, S: 80, complexidade: 1.1, requer: { qualidade: 0.55 } },
  minimercado: { nome: 'Minimercado de bairro', capex: 600_000, receita: 2_400_000, insumo: 0.72, func: 10, aluguel: 120_000, S: 120, complexidade: 1.3 },
  restaurante: { nome: 'Restaurante', capex: 550_000, receita: 1_500_000, insumo: 0.33, func: 14, aluguel: 130_000, S: 100, complexidade: 1.5, requer: { qualidade: 0.5 } },
  delivery: { nome: 'Cozinha de entrega e aplicativo próprio', capex: 220_000, receita: 700_000, insumo: 0.36, func: 5, aluguel: 30_000, S: 60, complexidade: 1.2, digital: 1, requer: { tecnologia: 0.4 } },
  fabrica: { nome: 'Padaria industrial (pães e congelados para mercados)', capex: 6_000_000, receita: 9_000_000, insumo: 0.5, func: 40, aluguel: 250_000, S: 12, complexidade: 4, requer: { unidades: 3 } },
  distribuidora: { nome: 'Distribuidora de farinha e insumos', capex: 1_200_000, receita: 6_000_000, insumo: 0.8, func: 12, aluguel: 150_000, S: 10, complexidade: 2, requer: { unidades: 4 } },
  marca_nacional: { nome: 'Indústria de alimentos com marca nacional', capex: 60_000_000, receita: 60_000_000, insumo: 0.52, func: 180, aluguel: 900_000, S: 6, complexidade: 12, requer: { fabricas: 2, marca: 0.6 } },
};
export const FRANQUIA = { lancamento: 150_000, royalties: 0.06, taxa: 60_000, requer: { padarias: 5, marca: 0.5 } };

// O acaso do dia a dia. chance: probabilidade por mês (por unidade, por
// funcionário ou para a cidade inteira). Os sorteios são os mesmos para os
// três; o que muda é o quanto cada um se preparou.
export const EVENTOS = {
  clima: { nome: 'Evento climático sério', chance: 0.02, base: 'cidade', texto: 'Temporal, enchente ou vendaval: unidades danificadas e mês fraco. Seguro cobre 80% do dano.' },
  assalto: { nome: 'Assalto', chance: 0.05, base: 'unidade', texto: 'Leva o caixa do dia e assusta a equipe. Segurança reduz a chance; seguro cobre a perda.' },
  pedido_demissao: { nome: 'Funcionário pediu para sair', chance: 0.15, base: 'equipe de 8', texto: 'Salário, treinamento e clima da equipe mudam a chance. Exige resposta.' },
  equipamento: { nome: 'Forno ou equipamento quebrou', chance: 0.04, base: 'unidade', texto: 'Manutenção reduz a chance. Exige resposta: consertar, trocar ou improvisar.' },
  fiscalizacao: { nome: 'Fiscalização (sanitária, trabalho, Receita)', chance: 0.03, base: 'empresa', texto: 'Com controles fracos vem multa; com controles bons, nada.' },
  concorrente: { nome: 'Novo concorrente no bairro', chance: 0.025, base: 'unidade', texto: 'Tira cerca de 6% das vendas da unidade por um ano e meio.' },
  obra: { nome: 'Obra na rua', chance: 0.015, base: 'unidade', texto: 'Vendas da unidade 15% menores por três meses.' },
  redes: { nome: 'Viralizou nas redes', chance: 0.02, base: 'empresa', texto: 'Para o bem (qualidade alta) ou para o mal (qualidade baixa).' },
  encomenda: { nome: 'Encomenda grande', chance: 0.06, base: 'empresa', texto: 'Festa, casamento ou empresa. Exige resposta: aceitar (com equipe incompleta pode falhar) ou recusar.' },
  trabalhista: { nome: 'Ação trabalhista', chance: 0.015, base: 'empresa', texto: 'Mais provável com salário baixo, demissões ou gente sem registro. Exige resposta: acordo ou contestar.' },
  furto: { nome: 'Furto interno', chance: 0.015, base: 'empresa', texto: 'Gestão e controles reduzem a chance.' },
  energia: { nome: 'Falta de energia ou água', chance: 0.02, base: 'cidade', texto: 'Vendas 8% menores no mês.' },
  ponto: { nome: 'Ponto comercial bom vagou', chance: 0.03, base: 'empresa', texto: 'Oportunidade: abrir uma padaria ali neste mês custa 25% menos.' },
  licitacao: { nome: 'Licitação de pão para a merenda', chance: 0.02, base: 'cidade', texto: 'Contrato de 12 meses com a prefeitura. Exige resposta e controles em ordem.' },
  cliente: { nome: 'Cliente passou mal', chance: 0.008, base: 'empresa', texto: 'Mais provável com qualidade e controles fracos: multa do Procon e dano à reputação.' },
  aluguel: { nome: 'Renovação do aluguel', chance: 1, base: 'a cada 36 meses', texto: 'O proprietário pede reajuste. Exige resposta: aceitar, negociar ou brigar.' },
  trigo: { nome: 'Preço do trigo', chance: 1, base: 'todo mês', texto: 'O custo dos insumos sobe e desce com o trigo e o dólar.' },
  dissidio: { nome: 'Dissídio', chance: 1, base: 'todo maio', texto: 'O salário de mercado é reajustado.' },
  eleicao: { nome: 'Eleições', chance: 1, base: 'a cada 4 anos', texto: 'Federal em 2026, 2030...; municipal em 2028, 2032... O lado que vence muda impostos e incentivos.' },
};

// As valências de uma empresa. Todas começam iguais e medianas; ninguém nasce
// melhor em nada. Cada real investido em uma área (pela agenda do mês) melhora
// a área, com retorno decrescente, e sem cuidado ela volta devagar ao piso.
// campo: onde o nível fica guardado no empresário; escala: quanto custa evoluir.
export const VALENCIAS = {
  vendas: { nome: 'Vendas e comercial', campo: 'vendas', inicio: 0.3, piso: 0.25, escala: 60_000, efeito: 'mais volume, encomendas e contratos; pesa em licitação' },
  marketing: { nome: 'Marketing e marca', campo: 'marca', inicio: 0.33, piso: 0.33, escala: 140_000, efeito: 'marca forte atrai cliente e é exigida para franquear' },
  design: { nome: 'Design (loja, vitrine, embalagem)', campo: 'design', inicio: 0.3, piso: 0.25, escala: 50_000, efeito: 'cliente aceita pagar mais: preço alto derruba menos as vendas' },
  produto: { nome: 'Produto e receitas', campo: 'produto', inicio: 0.3, piso: 0.25, escala: 70_000, efeito: 'cardápio melhor e novidades atraem cliente' },
  atendimento: { nome: 'Atendimento ao cliente', campo: 'atendimento', inicio: 0.35, piso: 0.3, escala: 40_000, efeito: 'cliente volta, reputação sobe, menos reclamação' },
  operacoes: { nome: 'Produção e operações', campo: 'operacoes', inicio: 0.35, piso: 0.3, escala: 60_000, efeito: 'cada unidade consegue produzir e vender mais' },
  compras: { nome: 'Compras e logística', campo: 'compras', inicio: 0.3, piso: 0.25, escala: 50_000, efeito: 'insumo mais barato e menos susto com o preço do trigo' },
  pessoas: { nome: 'Pessoas (RH e treinamento)', campo: 'treinamento', inicio: 0.3, piso: 0.2, escala: 40_000, efeito: 'menos gente pede para sair e a equipe rende mais' },
  gestao: { nome: 'Gestão e liderança', campo: 'gestao', inicio: 0.2, piso: 0.15, escala: 110_000, efeito: 'quantas unidades a empresa dá conta de tocar' },
  financas: { nome: 'Finanças e tesouraria', campo: 'financas', inicio: 0.25, piso: 0.2, escala: 50_000, efeito: 'juros menores, mais crédito, caixa parado rende' },
  contabilidade: { nome: 'Contabilidade e fiscal', campo: 'contabilidade', inicio: 0.3, piso: 0.25, escala: 35_000, efeito: 'paga menos imposto dentro da lei e erra menos com o fisco' },
  juridico: { nome: 'Jurídico e conformidade', campo: 'compliance', inicio: 0.5, piso: 0.35, escala: 25_000, efeito: 'menos multa e processo; exigido em licitação' },
  tecnologia: { nome: 'Tecnologia e dados', campo: 'tecnologia', inicio: 0.2, piso: 0.12, escala: 150_000, efeito: 'eficiência, canais digitais e gestão de rede grande' },
  seguranca: { nome: 'Segurança', campo: 'seguranca', inicio: 0.2, piso: 0.1, escala: 30_000, efeito: 'menos assaltos' },
  manutencao: { nome: 'Manutenção', campo: 'manutencao', inicio: 0.4, piso: 0.2, escala: 25_000, efeito: 'menos equipamento quebrado' },
};
const AREA = { ...Object.fromEntries(Object.keys(VALENCIAS).map((k) => [k, k])), treinamento: 'pessoas', compliance: 'juridico', marca: 'marketing' };
const PADRAO = Object.fromEntries(Object.values(VALENCIAS).map((v) => [v.campo, v.inicio]));
PADRAO.reputacao = 0.6;

export const ACOES = {
  contratar_talentos: { nome: 'Contratar gerentes e padeiros da rival', lei: 'legal: exige pagar salário melhor que o dela', alvo: 'ceo' },
  campanha_comparativa: { nome: 'Propaganda comparativa', lei: 'legal se for verdadeira: exige qualidade maior que a da rival', alvo: 'ceo' },
  processo_judicial: { nome: 'Processo por concorrência desleal', lei: 'legal; quem perde paga as custas', alvo: 'ceo' },
  denunciar_vigilancia: { nome: 'Denunciar a rival à Vigilância Sanitária', lei: 'legal; só dá interdição se o controle dela for fraco', alvo: 'ceo' },
  oferta_de_compra: { nome: 'Oferta para comprar um negócio da rival', lei: 'legal: só fecha se ela aceitou vender por esse valor ("vendo_por")', alvo: 'ceo' },
  propor_cartel: { nome: 'Combinar preços com a rival', lei: 'ILÍCITA: cartel (Lei 12.529/2011; crime da Lei 8.137/1990). Só vale se as duas propõem no mesmo mês', alvo: 'ceo', ilicita: 0.04 },
  delatar_cartel: { nome: 'Delatar o cartel (acordo de leniência)', lei: 'legal: quem delata primeiro fica imune e as outras são multadas', alvo: 'nenhum' },
  espionagem: { nome: 'Roubar receitas e processos da rival', lei: 'ILÍCITA: concorrência desleal (Lei 9.279/1996, art. 195)', alvo: 'ceo', ilicita: 0.35 },
  difamacao: { nome: 'Espalhar boatos contra a rival', lei: 'ILÍCITA: concorrência desleal e Código de Defesa do Consumidor', alvo: 'ceo', ilicita: 0.35 },
  sabotagem_cibernetica: { nome: 'Derrubar os sistemas da rival', lei: 'ILÍCITA: Lei 12.737/2012; processo criminal e afastamento por três anos', alvo: 'ceo', ilicita: 0.4 },
  sonegacao: { nome: 'Vender sem nota neste mês', lei: 'ILÍCITA: Lei 8.137/1990; multa de 150% do imposto sonegado', alvo: 'nenhum', ilicita: 0.08 },
  trabalho_sem_registro: { nome: 'Manter funcionários sem carteira neste mês', lei: 'ILÍCITA: CLT; multas e ações trabalhistas', alvo: 'nenhum', ilicita: 0.08 },
  propaganda_enganosa: { nome: 'Propaganda enganosa', lei: 'ILÍCITA: Código de Defesa do Consumidor, art. 37', alvo: 'nenhum', ilicita: 0.4 },
  suborno: { nome: 'Subornar fiscal', lei: 'ILÍCITA: Lei Anticorrupção (12.846/2013)', alvo: 'nenhum', ilicita: 0.3 },
  uso_indevido_de_dados: { nome: 'Usar dados de clientes sem consentimento', lei: 'ILÍCITA: LGPD (Lei 13.709/2018)', alvo: 'nenhum', ilicita: 0.3 },
};

const lim = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, pad = 0) => (Number.isFinite(+v) ? +v : pad);
const texto = (v, n) => String(v ?? '').slice(0, n);
export const reais = (v) => (Math.abs(v) >= 1e9 ? `R$ ${(v / 1e9).toFixed(2)} bi` : Math.abs(v) >= 1e6 ? `R$ ${(v / 1e6).toFixed(2)} mi` : Math.abs(v) >= 1e4 ? `R$ ${(v / 1e3).toFixed(0)} mil` : `R$ ${Math.round(v).toLocaleString('pt-BR')}`);
export const anoDe = (j) => ANO_INICIAL + Math.floor(j.t / 12);
export const mesDe = (j) => j.t % 12;
export const dataDe = (t) => `${NOME_MES[t % 12]}/${ANO_INICIAL + Math.floor(t / 12)}`;

// Sorteio comum: depende só da semente, do mês e da chave. Os três empresários
// recebem os mesmos números; o que muda é a probabilidade que cada um construiu.
function sorte(j, chave, n = 0) {
  let h = (j.semente ^ 0x9e3779b9) | 0;
  const s = `${j.t}|${chave}|${n}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Número fixo da partida: depende só da semente e da chave. É como o mundo "é".
function fixo(j, chave) {
  let h = (j.semente ^ 0x51ed270b) | 0;
  for (let i = 0; i < chave.length; i++) h = Math.imul(h ^ chave.charCodeAt(i), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Quanto um canal funciona para um tipo de negócio com uma mensagem. Oculto; muda devagar a cada oito anos.
function afinidade(j, canal, tipo, abordagem) {
  const fase = Math.floor(j.t / 96);
  const a = 0.6 * fixo(j, `af|${canal}|${tipo}`) + 0.4 * fixo(j, `af|${canal}|${tipo}|${fase}`);
  return (0.12 + 1.7 * a * a) * (0.5 + fixo(j, `ab|${canal}|${tipo}|${abordagem}|${fase}`));
}
// Quantas vezes algo acontece quando há n chances de probabilidade p.
function quantos(j, chave, n, p) {
  const esperado = n * p, base = Math.floor(esperado);
  return base + (sorte(j, chave) < esperado - base ? 1 : 0);
}

const novaOperacao = (tipo, unidades = 0, local = 'centro') => ({ tipo, unidades, fora: 0, locais: unidades ? { [local]: unidades } : {}, preco: 1, qualidade: 0.5, salario: 1, func: NEGOCIOS[tipo].func, equipe: unidades * NEGOCIOS[tipo].func, experiencia: 0.6, receita: 0, lucro: 0, lucros12: [], vendoPor: 0, efeitos: [], aluguel: 1, contrato: 0, publico: 0, impulso: 1, fadiga: {} });

function novoCEO(id) {
  const c = {
    id, nome: CEOS[id].nome, marcaNome: CEOS[id].marca,
    caixa: CAIXA_INICIAL, divida: 0, lucrosRetidos: 0, capital: 160_000, empresasVendidas: 0, herdados: [],
    pessoal: { caixa: 3_000, rendaFixa: 0, bolsa: 0, imoveis: 0, divida: 0 }, proLabore: 3_500,
    franqueados: 0, franquia: false, contratos: [],
    ...PADRAO, seguro: false, reposicao: 'manual',
    ops: { padaria: novaOperacao('padaria', 1, PONTO_INICIAL[id] || 'taquaral') },
    receita: 65_000, lucro: 3_500, receitas12: [], regime: 'Simples Nacional', prejuizoFiscal: 0, patrimonio: 0, funcionarios: 8,
    recuperacao: 0, afastado: 0, cartel: false, ilicitos: 0, flagrantes: 0, quebrou: null, fim: '', falencias: 0,
    tokens: 0, mediaTokens: 0, dolares: 0, chamadas: 0, invalidas: 0, proximoDespacho: 0,
    sala: [], memoria: '', fala: '', estrategia: '', pauta: null, pendencias: [], proxPendencia: 1, hist: [], marcos: [],
  };
  // A padaria já existia: tem um histórico de lucro modesto, que entra no valor dela.
  c.ops.padaria.lucros12 = Array(12).fill(3_000);
  c.receitas12 = Array(12).fill(75_000);
  return c;
}

export function criarJogo(semente = 1, ids = Object.keys(CEOS)) {
  const j = {
    versao: 3, semente, anuncios: [], proxAnuncio: 1, t: 0, cidade: criarMunicipio(semente, 'Campinas', { escala: 9.5, produtividade: 150 }), ceos: ids.map(novoCEO), log: [],
    politica: { federal: { lado: 'esquerda', desde: 2023 }, municipal: { lado: 'direita', desde: 2021 } },
    trigo: 1, juros: 0.06, bolsaMes: 0, cen: null,
  };
  j.base = { renda: j.cidade.renda, pop: j.cidade.pop };
  j.cen = cenarioDoAno(semente, ANO_INICIAL);
  for (const c of j.ceos) { c.patrimonio = patrimonio(j, c); c.hist.push(ponto(j, c)); }
  return j;
}

// Um ponto da série histórica de cada empresário, para os gráficos.
function ponto(j, c) {
  const R = Math.round;
  return { t: j.t, p: R(c.patrimonio), cx: R(c.caixa), dv: R(c.divida), rec: R(c.receita), luc: R(c.lucro), bol: R(c.quebrou ? 0 : bensPessoais(c)), emp: R(c.quebrou ? 0 : Math.max(0, valorDaEmpresa(j, c))), un: totalUnidades(c), fun: R(c.funcionarios), pl: R(c.proLabore) };
}

export const ceo = (j, id) => j.ceos.find((c) => c.id === id);
export const ativos = (j) => j.ceos.filter((c) => !c.quebrou);
// O jogo vai sempre até dezembro de 2075: fracassar faz parte, e quem sobrou continua jogando.
export const terminou = (j) => j.t >= MESES || ativos(j).length === 0;
export const naVez = (j, c) => !c.quebrou && !c.afastado && j.t >= c.proximoDespacho;
export const temTokens = (c) => c.tokens + (c.mediaTokens || 4500) <= TOKENS_JOGO;
export const classificacao = (j) => [...j.ceos].sort((a, b) => (a.quebrou ? 1 : 0) - (b.quebrou ? 1 : 0) || b.patrimonio - a.patrimonio);
export function vencedor(j) {
  const v = ativos(j);
  if (!v.length) return { ceo: null, motivo: 'ninguem' };
  if (j.t >= MESES) return { ceo: classificacao(j)[0], motivo: 'patrimonio' };
  return null;
}

function registrar(j, txt, tipo, de) {
  j.log.push({ t: j.t, texto: txt, tipo, de });
  if (j.log.length > 800) j.log.shift();
}
export function registrarTokens(c, tokens, dolares = 0) {
  c.tokens += tokens; c.dolares += dolares; c.chamadas++;
  c.mediaTokens = c.mediaTokens ? c.mediaTokens * 0.8 + tokens * 0.2 : tokens;
}

const fed = (j) => GOVERNO.federal[j.politica.federal.lado];
const mun = (j) => GOVERNO.municipal[j.politica.municipal.lado];
const unidadesDe = (c, tipo) => (c.ops[tipo] ? c.ops[tipo].unidades + c.ops[tipo].fora : 0);
const totalUnidades = (c) => Object.keys(c.ops).reduce((s, t) => s + unidadesDe(c, t), 0);
const temNegocio = (c) => totalUnidades(c) > 0 || c.franqueados > 0;
// Salário mensal de mercado de um funcionário (já com 13º embutido), em reais.
export const salarioMensal = (j) => 2_330 * (j.cidade.renda / j.base.renda) * fed(j).salarioMercado;
export const custoDeVida = (j) => 3_500 * (j.cidade.renda / j.base.renda);
const receita12 = (c) => (c.receitas12.length ? (c.receitas12.reduce((s, v) => s + v, 0) * 12) / c.receitas12.length : 900_000);
const lucro12 = (op) => (op.lucros12.length ? (op.lucros12.reduce((s, v) => s + v, 0) * 12) / op.lucros12.length : 0);

// Valor de um negócio: múltiplo do lucro dos últimos 12 meses, mais parte dos equipamentos.
function valorDaOperacao(c, op) {
  const def = NEGOCIOS[op.tipo], u = op.unidades + op.fora;
  if (!u) return 0;
  const r = receita12(c), multiplo = r > 500e6 ? 10 : r > 50e6 ? 7 : r > 5e6 ? 5.5 : 4;
  return Math.max(0, lucro12(op)) * multiplo + u * def.capex * 0.4;
}
export function valorDaEmpresa(j, c) {
  const negocios = Object.values(c.ops).reduce((s, op) => s + valorDaOperacao(c, op), 0);
  const franquia = c.franqueados * NEGOCIOS.padaria.receita * FRANQUIA.royalties * 5;
  return negocios + franquia + c.caixa - c.divida;
}
export const bensPessoais = (c) => c.pessoal.caixa + c.pessoal.rendaFixa + c.pessoal.bolsa + c.pessoal.imoveis - c.pessoal.divida;
// O placar: o que o empresário tem em seu nome mais o valor da empresa (se ela vale menos que zero, conta zero).
export function patrimonio(j, c) {
  if (c.quebrou) return 0;
  return bensPessoais(c) + Math.max(0, valorDaEmpresa(j, c));
}
export function composicao(j, c) {
  const p = c.pessoal;
  const o = { 'bolso: conta': p.caixa, 'bolso: renda fixa': p.rendaFixa, 'bolso: bolsa': p.bolsa, 'bolso: imóveis': p.imoveis, 'bolso: dívida': -p.divida, 'empresa: caixa': c.caixa, 'empresa: dívida': -c.divida, 'empresa: franquia': c.franqueados * NEGOCIOS.padaria.receita * FRANQUIA.royalties * 5 };
  for (const op of Object.values(c.ops)) if (op.unidades + op.fora) o[`empresa: ${NEGOCIOS[op.tipo].nome.toLowerCase()}`] = valorDaOperacao(c, op);
  return Object.fromEntries(Object.entries(o).filter(([, v]) => Math.abs(v) >= 1).map(([k, v]) => [k, Math.round(v)]));
}

// Quantas unidades de um tipo de negócio há em cada lugar, somando os três.
function ocupacao(j, tipo) {
  const o = {};
  for (const c of ativos(j)) for (const [l, n] of Object.entries(c.ops[tipo]?.locais || {})) o[l] = (o[l] || 0) + n;
  return o;
}
// Quanto um lugar comporta de um tipo de negócio antes de as unidades dividirem a clientela.
const cabe = (tipo, local) => Math.max(1, LOCAIS[local].gente * (NEGOCIOS[tipo].S / 150) * (LOCAIS[local].fora ? 1 : 1.2));
// Fator de vendas de uma unidade em um lugar: renda do público e concorrência entre as três redes.
const fatorLocal = (tipo, local, ocup) => (LOCAIS[local].renda * (LOCAIS[local].fora ? 0.9 : 1)) / (1 + Math.max(0, (ocup[local] || 0) - 1) / cabe(tipo, local));
// Onde abrir quando o empresário não escolhe: o lugar livre com melhor relação entre público e aluguel.
function melhorLocal(j, tipo, fora, ocup = ocupacao(j, tipo)) {
  let melhor = null, nota = -1;
  for (const [id, l] of Object.entries(LOCAIS)) { if (!!l.fora !== fora) continue; const n = fatorLocal(tipo, id, { ...ocup, [id]: (ocup[id] || 0) + 1 }) / Math.pow(l.aluguel, 0.35); if (n > nota) { nota = n; melhor = id; } }
  return melhor;
}
export const locaisDe = (c) => { const o = []; for (const op of Object.values(c.ops)) for (const [l, n] of Object.entries(op.locais || {})) if (n > 0) o.push({ local: l, negocio: op.tipo, n }); return o; };

const capacidadeDeGestao = (c) => (2 + 400 * Math.pow(c.gestao, 3)) * (1 + 0.5 * c.tecnologia);
const cargaDeGestao = (c) => Object.values(c.ops).reduce((s, op) => s + (op.unidades + op.fora * 1.3) * NEGOCIOS[op.tipo].complexidade, 0) + c.franqueados * 0.25;
const limiteDeCredito = (c) => Math.max(0, receita12(c) * 0.35 * (0.85 + 0.6 * c.financas) - c.divida);
export const jurosAoAno = (j, c) => lim(j.juros + 0.1 - 0.012 * Math.log10(Math.max(1, receita12(c) / 500_000)) * 2.2 + (receita12(c) < 4.8e6 ? fed(j).jurosPequenos : 0) - 0.04 * (c.financas - 0.25), 0.05, 0.22);

export function aliquotaSimples(receitaAnual) {
  const f = REGRAS.simples.find(([teto]) => receitaAnual <= teto) || REGRAS.simples[REGRAS.simples.length - 1];
  return Math.max(0, (receitaAnual * f[1] - f[2]) / Math.max(1, receitaAnual));
}

// ---------- o que o empresário lê todo mês ----------

export function dossie(j, c) {
  const cid = j.cidade, r2 = (v) => +(+v).toFixed(2), R = Math.round;
  const ult = c.sala[c.sala.length - 1];
  return {
    voce: c.nome, marca: c.marcaNome, data: dataDe(j.t), meses_restantes: MESES - j.t,
    patrimonio_total: R(c.patrimonio),
    seu_bolso: { conta: R(c.pessoal.caixa), renda_fixa: R(c.pessoal.rendaFixa), bolsa: R(c.pessoal.bolsa), imoveis: R(c.pessoal.imoveis), divida_pessoal: R(c.pessoal.divida), pro_labore_atual: R(c.proLabore), custo_de_vida_mensal: R(custoDeVida(j)) },
    empresa: {
      caixa: R(c.caixa), divida: R(c.divida), limite_de_credito: R(limiteDeCredito(c)), juros_ao_ano: r2(jurosAoAno(j, c)), lucros_que_pode_distribuir: R(Math.max(0, Math.min(c.lucrosRetidos, c.caixa))),
      regime: c.regime, receita_ultimos_12_meses: R(receita12(c)), valor_estimado: R(valorDaEmpresa(j, c)), em_recuperacao_judicial: c.recuperacao > 0,
      seguro: c.seguro, reposicao_de_pessoal: c.reposicao,
      valencias: Object.fromEntries(Object.entries(VALENCIAS).map(([k, v]) => [k, r2(c[v.campo])])), reputacao: r2(c.reputacao), carga_de_gestao: r2(cargaDeGestao(c)), capacidade_de_gestao: r2(capacidadeDeGestao(c)),
      negocios: Object.values(c.ops).filter((o) => o.unidades + o.fora > 0).map((o) => ({
        negocio: o.tipo, unidades_em_campinas: o.unidades, unidades_fora: o.fora, onde: Object.entries(o.locais).map(([l, n]) => `${l}:${n}`).join(' '), preco_indice: r2(o.preco), qualidade: r2(o.qualidade), salario_indice: r2(o.salario),
        equipe: R(o.equipe), equipe_ideal: R((o.unidades + o.fora) * o.func), experiencia_da_equipe: r2(o.experiencia), receita_do_mes: R(o.receita), lucro_do_mes: R(o.lucro),
        publico_fiel_indice: r2(o.publico || 0), efeitos_em_curso: o.efeitos.map((e) => `${e.motivo} (${e.meses} meses)`),
      })),
      franqueados: c.franquia ? c.franqueados : 'franquia não lançada', contratos_publicos: c.contratos.length,
    },
    resultado_do_mes_passado: ult?.resultado || 'primeiro mês',
    retorno_das_suas_ordens: (ult?.notas || []).slice(-10).map((n) => `${n.ok ? 'ok' : 'não'}: ${n.texto.slice(0, 240)}`),
    resultado_das_apostas: ult?.apostas || [],
    aconteceu_agora: (ult?.eventos || []).slice(-8),
    negocios_a_venda: (j.anuncios || []).map((a) => anuncioPublico(a, j)),
    pendencias_para_responder: c.pendencias.map((p) => ({ id: p.id, o_que: p.texto, opcoes: p.opcoes })),
    cenario: {
      governo_federal: `${j.politica.federal.lado}: ${fed(j).texto}`, prefeitura: `${j.politica.municipal.lado}: ${mun(j).texto}`,
      proxima_eleicao: proximaEleicao(j), economia: j.cen.eventos.filter((e) => e.tipo === 'recessao' || e.tipo === 'boom').map((e) => e.texto)[0] || 'ano normal',
      preco_do_trigo_indice: r2(j.trigo), juros_basicos_ao_ano: r2(j.juros), salario_de_mercado_mensal: R(salarioMensal(j)),
      campinas: { populacao: R(cid.pop), renda_mensal_per_capita: R(cid.renda), desemprego: r2(cid.desemprego), homicidios_por_100_mil: r2(cid.ind.homicidios) },
    },
    rivais: ativos(j).filter((r) => r !== c).map((r) => ({
      ceo: r.nome, patrimonio: R(r.patrimonio), receita_12_meses: R(receita12(r)), regime: r.regime, ultima_fala: r.fala,
      negocios: Object.values(r.ops).filter((o) => o.unidades + o.fora > 0).map((o) => ({ negocio: o.tipo, unidades: o.unidades + o.fora, onde: Object.entries(o.locais).slice(0, 12).map(([l, n]) => `${l}:${n}`).join(' '), preco_indice: r2(o.preco), qualidade: r2(o.qualidade), salario_indice: r2(o.salario), vende_por: o.vendoPor || null })),
      franqueados: r.franqueados, valencias: Object.fromEntries(Object.entries(VALENCIAS).map(([k, v]) => [k, r2(r[v.campo])])),
    })),
    sua_estrategia: c.estrategia || '(ainda não escrita)', sua_memoria: c.memoria || '(vazia)',
    tokens: { restantes: Math.max(0, TOKENS_JOGO - c.tokens), media_por_despacho: R(c.mediaTokens || 0), suficiente_para_meses: c.mediaTokens ? Math.floor((TOKENS_JOGO - c.tokens) / c.mediaTokens) : null },
  };
}

function proximaEleicao(j) {
  const ano = anoDe(j), passou = mesDe(j) >= 9;
  for (let a = ano + (passou ? 1 : 0); ; a++) { if (a % 4 === 2) return `federal em out/${a}`; if (a % 4 === 0) return `municipal em out/${a}`; }
}

// ---------- o despacho do mês ----------

// Guarda a decisão inteira na sala do empresário e a deixa na pauta. A execução
// é no fechamento do mês, para os três ao mesmo tempo.
export function despachar(j, c, dec, modo, tokens = 0) {
  const reg = { t: j.t, modo, tokens, notas: [], eventos: [] };
  if (dec && typeof dec === 'object' && !c.quebrou) {
    const J = (o) => texto(o && o.justificativa, 600);
    const V = (o, k) => Math.max(0, num(o && o[k]));
    const movimentos = (Array.isArray(dec.movimentos) ? dec.movimentos : []).filter((m) => m && ['abrir', 'fechar', 'vender', 'lancar_franquia', 'vender_empresa', 'comprar_anuncio', 'auditar_anuncio'].includes(m.acao) && (!['abrir', 'fechar', 'vender'].includes(m.acao) || NEGOCIOS[m.negocio])).slice(0, 8)
      .map((m) => ({ acao: m.acao, negocio: m.negocio || 'padaria', quantidade: lim(Math.round(num(m.quantidade, 1)), 1, 500), onde: LOCAIS[m.onde] ? m.onde : m.onde === 'fora' ? 'fora' : 'campinas', anuncio: Math.round(num(m.anuncio)), oferta: Math.max(0, num(m.oferta)), justificativa: texto(m.justificativa, 500) }));
    // Apostas de crescimento: dinheiro em um canal, para um negócio, com uma mensagem.
    const apostas = (Array.isArray(dec.apostas) ? dec.apostas : []).filter((a) => a && CANAIS[a.canal] && NEGOCIOS[a.negocio]).slice(0, 6)
      .map((a) => ({ canal: a.canal, negocio: a.negocio, abordagem: ABORDAGENS.includes(a.abordagem) ? a.abordagem : 'produto', investimento: Math.max(0, num(a.investimento)), justificativa: texto(a.justificativa, 400) }));
    const brutas = Array.isArray(dec.operacoes) ? Object.fromEntries(dec.operacoes.filter((o) => o && o.negocio).map((o) => [o.negocio, o])) : dec.operacoes && typeof dec.operacoes === 'object' ? dec.operacoes : {};
    const operacoes = {};
    for (const [t, o] of Object.entries(brutas)) {
      if (!NEGOCIOS[t] || !o || typeof o !== 'object') continue;
      operacoes[t] = { preco: o.preco_indice, salario: o.salario_indice, func: o.funcionarios_por_unidade, contratar: Math.round(V(o, 'contratar')), demitir: Math.round(V(o, 'demitir')), qualidade: V(o, 'investir_em_qualidade'), vendoPor: V(o, 'vendo_por'), justificativa: J(o) };
    }
    const g = dec.gestao || {}, f = dec.financas || {}, b = dec.bolso || {};
    const acoes = (Array.isArray(dec.acoes_externas) ? dec.acoes_externas : []).filter((x) => x && ACOES[x.tipo]).slice(0, 3)
      .map((x) => ({ tipo: x.tipo, alvo: texto(x.alvo, 40), negocio: NEGOCIOS[x.negocio] ? x.negocio : 'padaria', recursos: V(x, 'recursos'), justificativa: texto(x.justificativa, 500) }));
    const respostas = (Array.isArray(dec.respostas) ? dec.respostas : []).filter((r) => r && r.id !== undefined).map((r) => ({ id: +r.id, opcao: texto(r.opcao, 40), justificativa: texto(r.justificativa, 400) }));
    // Agenda: até 31 ações datadas. Valores soltos em "gestao" (formato antigo) entram no dia 1.
    const agenda = (Array.isArray(dec.agenda) ? dec.agenda : []).filter((a) => a && AREA[a.area]).slice(0, 31)
      .map((a) => ({ dia: lim(Math.round(num(a.dia, 1)), 1, 30), area: AREA[a.area], acao: texto(a.acao, 200), investimento: V(a, 'investimento') }));
    for (const [k, area] of Object.entries(AREA)) if (V(g, k) > 0) agenda.push({ dia: 1, area, acao: '', investimento: V(g, k) });
    agenda.sort((x, y) => x.dia - y.dia);
    c.pauta = {
      movimentos, operacoes, acoes, respostas, agenda, apostas,
      seguro: typeof g.seguro === 'boolean' ? g.seguro : null, reposicao: ['manual', 'automatica'].includes(g.reposicao_de_pessoal) ? g.reposicao_de_pessoal : null,
      financas: Object.fromEntries(['tomar_emprestimo', 'amortizar_divida', 'distribuir_lucros', 'aporte_do_dono'].map((k) => [k, V(f, k)])),
      proLabore: Number.isFinite(+f.pro_labore) ? Math.max(0, +f.pro_labore) : null,
      bolso: Object.fromEntries(['aplicar_renda_fixa', 'resgatar_renda_fixa', 'aplicar_bolsa', 'resgatar_bolsa', 'comprar_imoveis', 'vender_imoveis', 'pagar_divida_pessoal'].map((k) => [k, V(b, k)])),
    };
    if (dec.estrategia) c.estrategia = texto(dec.estrategia, 700);
    c.memoria = texto(dec.memoria, 500) || c.memoria;
    c.fala = texto(dec.fala, 240) || c.fala;
    c.proximoDespacho = j.t + lim(Math.round(num(dec.proximo_despacho_em_meses, 1)), 1, 12);
    reg.diario = texto(dec.diario, 900);
    reg.agenda = agenda;
    reg.decisao = {
      estrategia: texto(dec.estrategia, 700), movimentos, operacoes, respostas, apostas, acoes_externas: acoes,
      gestao: { seguro: c.pauta.seguro, reposicao_de_pessoal: c.pauta.reposicao, justificativa: J(g) },
      financas: { ...c.pauta.financas, pro_labore: c.pauta.proLabore, justificativa: J(f) }, bolso: { ...c.pauta.bolso, justificativa: J(b) },
      acao_livre: texto(dec.acao_livre, 700), fala: texto(dec.fala, 240), memoria: texto(dec.memoria, 500), proximo_despacho_em_meses: c.proximoDespacho - j.t,
    };
  }
  c.sala.push(reg);
  return reg;
}

// ---------- execução ----------

const registroDoMes = (j, c) => { let s = c.sala[c.sala.length - 1]; if (!s || s.t !== j.t) { s = { t: j.t, modo: c.afastado ? 'afastado' : 'sem despacho', tokens: 0, notas: [], eventos: [] }; c.sala.push(s); } return s; };
// macro: movimento grande (abrir, fechar, comprar, vender, quebrar, mudar de regime).
const nota = (j, c, ok, t, macro = false) => registroDoMes(j, c).notas.push({ ok, texto: t, macro });
const evento = (j, c, t) => registroDoMes(j, c).eventos.push(t);

function investir(c, area, valor) {
  const v = VALENCIAS[area];
  if (!v || valor <= 0) return;
  const campo = v.campo, escala = v.escala;
  const tam = escala * Math.pow(Math.max(500_000, receita12(c)) / 900_000, 0.65);
  c[campo] = lim(c[campo] + (1 - c[campo]) * (1 - Math.exp(-valor / tam)) * 0.5, 0, 1);
}

function cumpre(c, def) {
  const r = def.requer || {};
  if (r.qualidade && !Object.values(c.ops).some((o) => o.unidades + o.fora > 0 && o.qualidade >= r.qualidade)) return `exige qualidade ${r.qualidade} em algum negócio`;
  if (r.tecnologia && c.tecnologia < r.tecnologia) return `exige tecnologia ${r.tecnologia}`;
  if (r.marca && c.marca < r.marca) return `exige marca ${r.marca}`;
  if (r.unidades && totalUnidades(c) < r.unidades) return `exige ao menos ${r.unidades} unidades em operação`;
  if (r.fabricas && unidadesDe(c, 'fabrica') < r.fabricas) return `exige ${r.fabricas} padarias industriais`;
  return null;
}

// Cada pendência tem opções; a primeira é o que acontece se o empresário não responder.
const RESOLVER = {
  pedido_demissao(j, c, p, opcao) {
    const op = c.ops[p.negocio]; if (!op) return;
    const sal = salarioMensal(j) * op.salario;
    if (opcao === 'contraproposta') {
      const fica = Math.round(p.n * (sorte(j, 'contra', p.id) < 0.65 ? 1 : 0.4));
      c.caixa -= p.n * sal * 1.5; op.equipe -= p.n - fica; op.experiencia = lim(op.experiencia - 0.02 * (p.n - fica), 0, 1);
      nota(j, c, fica === p.n, `Contraproposta a ${p.n} que queriam sair: ${fica} ficam (custo ${reais(p.n * sal * 1.5)}).`);
    } else if (opcao === 'repor') {
      c.caixa -= p.n * sal * 0.6; op.experiencia = lim(op.experiencia - 0.5 * (p.n / Math.max(1, op.equipe)), 0, 1);
      nota(j, c, true, `${p.n} ${p.n > 1 ? 'saem e são repostos' : 'sai e é reposto'} (recrutamento ${reais(p.n * sal * 0.6)}); a equipe perde experiência.`);
    } else { op.equipe = Math.max(0, op.equipe - p.n); nota(j, c, false, `${p.n} ${p.n > 1 ? 'saem' : 'sai'} e a vaga fica aberta: o atendimento piora.`); }
  },
  equipamento(j, c, p, opcao) {
    const op = c.ops[p.negocio]; if (!op) return;
    if (opcao === 'trocar' && c.caixa >= 45_000 * p.n) { c.caixa -= 45_000 * p.n; op.qualidade = lim(op.qualidade + 0.02, 0, 1); c.manutencao = lim(c.manutencao + 0.1, 0, 1); nota(j, c, true, `Troca ${p.n} equipamento(s) por novos (${reais(45_000 * p.n)}).`); }
    else if (opcao === 'consertar' || opcao === 'trocar') { c.caixa -= 6_000 * p.n; op.efeitos.push({ fator: 1 - 0.2 * p.fracao, meses: 1, motivo: 'forno em conserto' }); nota(j, c, opcao === 'consertar', `${opcao === 'trocar' ? 'Sem caixa para trocar: conserta' : 'Conserta'} ${p.n} equipamento(s) (${reais(6_000 * p.n)}); uma semana de produção perdida.`); }
    else { op.efeitos.push({ fator: 1 - 0.12 * p.fracao, meses: 4, motivo: 'forno improvisado' }); nota(j, c, false, 'Improvisa com o equipamento quebrado: produção menor por quatro meses.'); }
  },
  encomenda(j, c, p, opcao) {
    if (opcao !== 'aceitar') { nota(j, c, true, 'Recusa a encomenda grande.'); return; }
    const op = c.ops.padaria || Object.values(c.ops).find((o) => o.unidades + o.fora > 0);
    const lotacao = op ? op.equipe / Math.max(1, (op.unidades + op.fora) * op.func) : 0;
    if (lotacao > 0.85 && sorte(j, 'enc', p.id) < 0.4 + 0.4 * (op?.qualidade ?? 0) + 0.3 * c.vendas) { c.caixa += p.valor * 0.45; c.reputacao = lim(c.reputacao + 0.01, 0, 1); nota(j, c, true, `Entrega a encomenda de ${reais(p.valor)} e ganha ${reais(p.valor * 0.45)} limpos.`); }
    else { c.caixa -= p.valor * 0.15; c.reputacao = lim(c.reputacao - 0.04, 0, 1); nota(j, c, false, `Aceita a encomenda de ${reais(p.valor)} e não dá conta: prejuízo de ${reais(p.valor * 0.15)} e cliente insatisfeito.`); }
  },
  trabalhista(j, c, p, opcao) {
    if (opcao === 'acordo') { c.caixa -= p.valor * 0.6; nota(j, c, true, `Faz acordo na ação trabalhista: ${reais(p.valor * 0.6)}.`); }
    else if (sorte(j, 'trab', p.id) < 0.4) nota(j, c, true, 'Contesta a ação trabalhista e ganha.');
    else { c.caixa -= p.valor * 1.3; nota(j, c, false, `Contesta a ação trabalhista e perde: ${reais(p.valor * 1.3)}.`); }
  },
  licitacao(j, c, p, opcao) {
    if (opcao !== 'participar') return;
    if (c.compliance < 0.5) { nota(j, c, false, 'Inabilitado na licitação da merenda: documentação e controles fracos.'); return; }
    const op = c.ops.padaria || c.ops.fabrica;
    if (op && sorte(j, 'lic', 0) < 0.25 + 0.4 * op.qualidade + 0.3 * c.vendas - 0.5 * (op.preco - 1)) { c.contratos.push({ meses: 12, mensal: p.valor }); nota(j, c, true, `Vence a licitação: ${reais(p.valor)} por mês durante um ano.`, true); registrar(j, `${c.nome} vence a licitação de pão para a merenda.`, 'bom', c.id); }
    else nota(j, c, false, 'Perde a licitação da merenda.');
  },
  aluguel(j, c, p, opcao) {
    const op = c.ops[p.negocio]; if (!op) return;
    if (opcao === 'negociar') {
      const s = sorte(j, 'alug', p.id);
      if (s < 0.5) { op.aluguel *= 1.05; nota(j, c, true, 'Negocia o aluguel: reajuste de 5% em vez de 12%.'); }
      else if (s < 0.82) { op.aluguel *= 1.12; nota(j, c, false, 'O proprietário não cede: reajuste de 12%.'); }
      else { c.caixa -= NEGOCIOS[p.negocio].capex * 0.3; op.efeitos.push({ fator: 1 - 0.3 / Math.max(1, op.unidades + op.fora), meses: 6, motivo: 'unidade mudou de ponto' }); nota(j, c, false, `Perde um ponto na negociação e precisa mudar uma unidade de lugar (${reais(NEGOCIOS[p.negocio].capex * 0.3)}).`, true); }
    } else { op.aluguel *= 1.12; nota(j, c, true, 'Aceita o reajuste de 12% no aluguel.'); }
  },
};

function executarPauta(j, c) {
  const p = c.pauta;
  // Pendências: respondidas ou resolvidas pela primeira opção.
  for (const pend of c.pendencias) {
    const r = p?.respostas.find((x) => x.id === pend.id);
    const opcao = r && pend.opcoes.includes(r.opcao) ? r.opcao : c.reposicao === 'automatica' && pend.tipo === 'pedido_demissao' ? 'repor' : pend.opcoes[0];
    RESOLVER[pend.tipo](j, c, pend, opcao);
  }
  c.pendencias = [];
  if (!p) return;
  const f = p.financas, sal = salarioMensal(j);
  if (p.seguro !== null && p.seguro !== c.seguro) { c.seguro = p.seguro; nota(j, c, true, c.seguro ? 'Contrata seguro (0,4% da receita por mês).' : 'Cancela o seguro.'); }
  if (p.reposicao) c.reposicao = p.reposicao;
  if (p.proLabore !== null && Math.abs(p.proLabore - c.proLabore) > 1) { nota(j, c, true, `Pró-labore: de ${reais(c.proLabore)} para ${reais(p.proLabore)} por mês.`); c.proLabore = p.proLabore; }
  if (f.aporte_do_dono > 0) { const v = Math.min(f.aporte_do_dono, Math.max(0, c.pessoal.caixa)); if (v >= 100) { c.pessoal.caixa -= v; c.caixa += v; c.capital = (c.capital || 0) + v; nota(j, c, true, `O dono põe ${reais(v)} do próprio bolso na empresa.`, v > c.patrimonio * 0.1); } }
  if (f.tomar_emprestimo > 0) {
    const v = c.recuperacao || !temNegocio(c) ? 0 : Math.min(f.tomar_emprestimo, limiteDeCredito(c));
    if (v >= 500) { c.divida += v; c.caixa += v; nota(j, c, true, `Toma ${reais(v)} emprestados a ${(jurosAoAno(j, c) * 100).toFixed(0)}% ao ano.`, v > c.patrimonio * 0.2); }
    else nota(j, c, false, c.recuperacao ? 'Banco nega crédito: em recuperação judicial.' : 'Banco nega crédito: sem limite disponível.');
  }
  for (const [t, o] of Object.entries(p.operacoes)) {
    const op = c.ops[t];
    if (!op || op.unidades + op.fora < 1) continue;
    const mud = [], u = op.unidades + op.fora;
    if (Number.isFinite(+o.preco)) { const v = lim(+o.preco, 0.5, 2.5); if (Math.abs(v - op.preco) > 0.004) mud.push(`preço ${op.preco.toFixed(2)}→${v.toFixed(2)}`); op.preco = v; }
    if (Number.isFinite(+o.salario)) { const v = lim(+o.salario, REGRAS.pisoSalarial, 3); if (Math.abs(v - op.salario) > 0.004) mud.push(`salário ${(op.salario * 100).toFixed(0)}→${(v * 100).toFixed(0)}% do mercado`); op.salario = v; }
    if (Number.isFinite(+o.func)) { const d = NEGOCIOS[t], v = lim(+o.func, d.func * (0.6 - 0.25 * c.tecnologia), d.func * 2); if (Math.abs(v - op.func) > 0.05) mud.push(`equipe ideal por unidade ${op.func.toFixed(1)}→${v.toFixed(1)}`); op.func = v; }
    if (o.demitir > 0) { const n = Math.min(o.demitir, Math.max(0, op.equipe - 1)); if (n > 0) { op.equipe -= n; c.caixa -= n * sal * op.salario * 12 * REGRAS.rescisao; c.demitidos = (c.demitidos || 0) + n; mud.push(`demite ${n} (rescisões ${reais(n * sal * op.salario * 12 * REGRAS.rescisao)})`); } }
    if (o.contratar > 0) {
      const fila = Math.ceil(j.cidade.pop * 0.45 * (j.cidade.desemprego + 0.02) * 0.004 * lim(op.salario, 0.6, 1.6));
      const n = Math.min(o.contratar, fila, Math.max(0, Math.ceil(u * op.func * 1.3 - op.equipe)));
      if (n > 0) { op.equipe += n; c.caixa -= n * sal * op.salario * 0.6; op.experiencia = lim(op.experiencia * (op.equipe - n) / op.equipe + 0.25 * n / op.equipe, 0, 1); mud.push(`contrata ${n}`); }
      else mud.push('não consegue contratar: equipe já completa ou falta gente para esse salário');
    }
    if (o.qualidade > 0 && !c.recuperacao) { const v = Math.min(o.qualidade, Math.max(0, c.caixa)); if (v >= 100) { c.caixa -= v; const tam = 120_000 * Math.pow(Math.max(1, u), 0.7) * (NEGOCIOS[t].capex / 350_000) ** 0.5; op.qualidade = lim(op.qualidade + (1 - op.qualidade) * (1 - Math.exp(-v / tam)) * 0.5, 0, 1); mud.push(`${reais(v)} em qualidade`); } }
    op.vendoPor = o.vendoPor || 0;
    if (mud.length) nota(j, c, true, `${NEGOCIOS[t].nome}: ${mud.join(', ')}.`);
  }
  // A agenda do mês: cada ação tem dia, área e, se quiser, dinheiro investido na área.
  if (!c.recuperacao) {
    const porArea = {};
    for (const a of p.agenda) { const v = Math.min(a.investimento, Math.max(0, c.caixa)); if (v >= 50) { c.caixa -= v; a.aplicado = Math.round(v); investir(c, a.area, v); porArea[a.area] = (porArea[a.area] || 0) + v; } }
    const feitos = Object.entries(porArea).map(([k, v]) => `${VALENCIAS[k].nome.split(' ')[0].toLowerCase()} ${reais(v)}`);
    if (feitos.length) nota(j, c, true, `Investe no mês: ${feitos.join(', ')}.`);
  } else if (p.agenda.some((a) => a.investimento > 0)) nota(j, c, false, 'Em recuperação judicial, a empresa não pode investir.');
  // Apostas de crescimento: o resultado só aparece depois de gastar.
  for (const a of p.apostas || []) {
    const op = c.ops[a.negocio];
    if (!op || op.unidades + op.fora < 1 || c.recuperacao) continue;
    const v = Math.min(a.investimento, Math.max(0, c.caixa));
    if (v < 50) continue;
    c.caixa -= v;
    const def = NEGOCIOS[a.negocio], u = op.unidades + op.fora;
    op.fadiga ||= {};
    const cansaco = op.fadiga[a.canal] || 0;
    const escala = u * (def.receita / 12) * 0.03;
    const efeito = afinidade(j, a.canal, a.negocio, a.abordagem) * (1 - Math.exp(-v / escala)) * (0.6 + 0.8 * sorte(j, `ap|${a.canal}|${a.negocio}`)) * (1 - 0.5 * cansaco) * (0.6 + 0.8 * op.qualidade);
    op.publico = Math.min(2, (op.publico || 0) + 0.12 * efeito); op.impulso = (op.impulso || 1) * (1 + 0.1 * efeito);
    op.fadiga[a.canal] = Math.min(1, cansaco + 0.25);
    const clientes = Math.round(efeito * u * 220 * (0.85 + 0.3 * sorte(j, `apr|${a.canal}|${a.negocio}`)));
    const alcance = Math.round(v * (6 + 30 * fixo(j, `alc|${a.canal}`)) * (0.8 + 0.4 * sorte(j, `alc|${a.canal}`)));
    // Muita gente nova com produto fraco: a reclamação também se espalha.
    const queixa = efeito > 0.8 && op.qualidade < 0.42;
    if (queixa) c.reputacao = lim(c.reputacao - 0.03, 0, 1);
    a.resultado = { alcance, clientes_novos: clientes };
    (registroDoMes(j, c).apostas ||= []).push({ canal: a.canal, negocio: a.negocio, abordagem: a.abordagem, investimento: Math.round(v), alcance, clientes_novos: clientes });
    nota(j, c, clientes * 25 > v, `${CANAIS[a.canal]} (${def.nome.toLowerCase()}, mensagem "${a.abordagem}"): ${reais(v)} → cerca de ${alcance.toLocaleString('pt-BR')} pessoas alcançadas e ${clientes} clientes novos${queixa ? '; vieram também reclamações públicas sobre a qualidade' : ''}.`);
  }
  for (const m of p.movimentos) {
    const def = NEGOCIOS[m.negocio];
    if (m.acao === 'comprar_anuncio') continue;          // resolvido para os três juntos, em mercadoDeNegocios
    if (m.acao === 'auditar_anuncio') {
      const an = (j.anuncios || []).find((x) => x.id === m.anuncio);
      if (!an) nota(j, c, false, `Anúncio ${m.anuncio} não existe mais.`);
      else if (c.caixa < 6_000) nota(j, c, false, 'Sem caixa para pagar a auditoria (R$ 6.000).');
      else {
        c.caixa -= 6_000;
        const erro = (k) => 0.9 + 0.2 * sorte(j, `aud|${an.id}|${k}`);
        nota(j, c, true, `Auditoria do anúncio ${an.id} (${NEGOCIOS[an.tipo].nome.toLowerCase()}, ${LOCAIS[an.local].nome}), R$ 6.000: receita mensal real perto de ${reais(an.receitaReal * erro('r'))} (anunciam ${reais(an.declarada)}); passivo trabalhista e fiscal estimado em ${reais(an.passivo * erro('p'))}; estado da operação: ${an.q > 0.6 ? 'bom' : an.q > 0.45 ? 'regular' : 'ruim'}.`);
      }
      continue;
    }
    if (m.acao === 'vender_empresa') {
      const valor = valorDaEmpresa(j, c);
      if (!temNegocio(c) || c.recuperacao || valor <= 0) { nota(j, c, false, c.recuperacao ? 'Em recuperação judicial, a empresa não pode ser vendida.' : 'Não apareceu comprador para a empresa.', true); continue; }
      // O comprador faz a própria conta: a proposta fica entre 70% e 100% do valor estimado.
      const preco = valor * (0.7 + 0.3 * sorte(j, 'venda-empresa'));
      const ganho = Math.max(0, preco - (c.capital || 0)), ir = impostoGanhoDeCapital(ganho);
      c.pessoal.caixa += preco - ir;
      for (const op of Object.values(c.ops)) { op.unidades = 0; op.fora = 0; op.equipe = 0; op.lucros12 = []; op.efeitos = []; op.locais = {}; op.publico = 0; op.vendoPor = 0; }
      c.caixa = 0; c.divida = 0; c.franqueados = 0; c.franquia = false; c.lucrosRetidos = 0; c.contratos = []; c.capital = 0; c.receitas12 = []; c.prejuizoFiscal = 0; c.pendencias = [];
      // O que a empresa sabia fazer fica com ela; o dono leva parte do que aprendeu.
      for (const v of Object.values(VALENCIAS)) c[v.campo] = v.inicio + (c[v.campo] - v.inicio) * 0.4;
      c.empresasVendidas = (c.empresasVendidas || 0) + 1;
      nota(j, c, true, `Vende a empresa inteira por ${reais(preco)} (valor estimado ${reais(valor)}); paga ${reais(ir)} de imposto sobre o ganho de capital e fica com ${reais(preco - ir)} no próprio nome.`, true);
      registrar(j, `${c.nome} vende a empresa inteira por ${reais(preco)}.`, 'era', c.id);
      c.marcos.push({ t: j.t, texto: `Vende a empresa por ${reais(preco)}` });
      break;
    }
    if (m.acao === 'lancar_franquia') {
      if (c.franquia) continue;
      if (unidadesDe(c, 'padaria') < FRANQUIA.requer.padarias || c.marca < FRANQUIA.requer.marca) nota(j, c, false, 'Franquia ainda não: exige 5 padarias próprias e marca forte (0,5).', true);
      else if (c.caixa < FRANQUIA.lancamento) nota(j, c, false, `Sem caixa para lançar a franquia (${reais(FRANQUIA.lancamento)}).`, true);
      else { c.caixa -= FRANQUIA.lancamento; c.franquia = true; nota(j, c, true, 'Lança a franquia da marca (Lei 13.966/2019).', true); registrar(j, `${c.nome} lança a franquia ${c.marcaNome}.`, 'bom', c.id); c.marcos.push({ t: j.t, texto: 'Lança a franquia' }); }
    } else if (m.acao === 'abrir') {
      const falta = cumpre(c, def);
      if (c.recuperacao) { nota(j, c, false, 'Em recuperação judicial, não pode abrir unidades.', true); continue; }
      if (falta && totalUnidades(c) > 0) { nota(j, c, false, `${def.nome}: ${falta}.`, true); continue; }
      const custo = def.capex * mun(j).capex * (m.negocio === 'padaria' && c.pontoBom === j.t ? 0.75 : 1);
      const q = Math.min(m.quantidade, Math.floor(Math.max(0, c.caixa) / custo));
      if (q < 1) { nota(j, c, false, `Sem caixa para abrir ${def.nome.toLowerCase()} (${reais(custo)} por unidade).`, true); continue; }
      const novo = unidadesDe(c, m.negocio) === 0;
      c.ops[m.negocio] ||= novaOperacao(m.negocio);
      const op = c.ops[m.negocio];
      c.caixa -= q * custo;
      op.experiencia = lim((op.experiencia * op.equipe + 0.3 * q * op.func) / Math.max(1, op.equipe + q * op.func), 0, 1);
      // Cada unidade vai para um lugar: o escolhido, ou o melhor disponível.
      // A ocupação é a do começo do mês, igual para os três: quem é processado antes não leva o melhor ponto.
      const ocup = { ...j.ocupNoMes[m.negocio] }, onde = [];
      for (const [l, n] of Object.entries(op.locais)) ocup[l] = Math.max(ocup[l] || 0, n);
      for (let i = 0; i < q; i++) { const l = LOCAIS[m.onde] ? m.onde : melhorLocal(j, m.negocio, m.onde === 'fora', ocup); ocup[l] = (ocup[l] || 0) + 1; op.locais[l] = (op.locais[l] || 0) + 1; op[LOCAIS[l].fora ? 'fora' : 'unidades']++; if (!onde.includes(l)) onde.push(l); }
      op.equipe += Math.round(q * op.func); if (novo) op.contrato = j.t;
      c.pulsos = [...(c.pulsos || []).slice(-20), ...onde.slice(0, 4).map((l) => ({ t: j.t, local: l, tipo: 'abriu' }))];
      // Unidade nova leva um ano para formar clientela.
      op.efeitos.push({ fator: 1 - 0.4 * (q / (op.unidades + op.fora)), meses: 12, motivo: 'unidades novas formando clientela' });
      nota(j, c, q === m.quantidade, `Abre ${q} ${def.nome.toLowerCase()} em ${onde.slice(0, 3).map((l) => LOCAIS[l].nome).join(', ')}${onde.length > 3 ? ` e mais ${onde.length - 3} lugares` : ''} (${reais(q * custo)})${q < m.quantidade ? `; queria ${m.quantidade}, o caixa não deu` : ''}.`, true);
      if (novo) { registrar(j, `${c.nome} entra em um novo negócio: ${def.nome.toLowerCase()}.`, 'bom', c.id); c.marcos.push({ t: j.t, texto: `Entra em ${def.nome.toLowerCase()}` }); }
    } else {
      const op = c.ops[m.negocio];
      if (!op || op.unidades + op.fora < 1) continue;
      const total = op.unidades + op.fora, q = Math.min(m.quantidade, total), porUnid = op.equipe / total;
      const valorUnit = m.acao === 'vender' ? (valorDaOperacao(c, op) / total) * 0.8 : def.capex * 0.2 - porUnid * sal * op.salario * 12 * REGRAS.rescisao;
      // Sai primeiro do lugar pedido; senão, dos lugares que rendem menos.
      const ocup = ocupacao(j, m.negocio);
      for (let i = 0; i < q; i++) { const l = op.locais[m.onde] > 0 ? m.onde : Object.keys(op.locais).filter((x) => op.locais[x] > 0).sort((x, y) => fatorLocal(m.negocio, x, ocup) / LOCAIS[x].aluguel - fatorLocal(m.negocio, y, ocup) / LOCAIS[y].aluguel)[0]; op.locais[l]--; if (!op.locais[l]) delete op.locais[l]; op[LOCAIS[l].fora ? 'fora' : 'unidades']--; }
      op.equipe = Math.max(0, op.equipe - Math.round(porUnid * q));
      c.caixa += valorUnit * q;
      nota(j, c, true, `${m.acao === 'vender' ? 'Vende' : 'Fecha'} ${q} ${def.nome.toLowerCase()} (${valorUnit >= 0 ? 'entra' : 'custa'} ${reais(Math.abs(valorUnit * q))}).`, true);
    }
  }
  if (f.amortizar_divida > 0) { const v = Math.min(f.amortizar_divida, Math.max(0, c.caixa), c.divida); if (v >= 100) { c.divida -= v; c.caixa -= v; nota(j, c, true, `Amortiza ${reais(v)} da dívida da empresa.`); } }
  if (f.distribuir_lucros > 0) {
    const v = c.recuperacao ? 0 : Math.min(f.distribuir_lucros, Math.max(0, c.caixa), Math.max(0, c.lucrosRetidos));
    if (v >= 100) { const ir = Math.max(0, v - REGRAS.lucrosIsentos) * REGRAS.irLucros; c.caixa -= v; c.lucrosRetidos -= v; c.pessoal.caixa += v - ir; nota(j, c, true, `Distribui ${reais(v)} de lucros para o dono${ir > 0 ? ` (imposto de ${reais(ir)})` : ''}.`, v > c.patrimonio * 0.15); }
    else nota(j, c, false, 'Não há lucro acumulado em caixa para distribuir.');
  }
  // O bolso do dono: aplicações, imóveis e dívida pessoal.
  const b = p.bolso, pes = c.pessoal;
  for (const [de, campo, nomeA] of [['resgatar_renda_fixa', 'rendaFixa', 'renda fixa'], ['resgatar_bolsa', 'bolsa', 'bolsa'], ['vender_imoveis', 'imoveis', 'imóveis']]) { const v = Math.min(b[de], pes[campo]); if (v >= 100) { pes[campo] -= v; pes.caixa += v * (campo === 'imoveis' ? 0.94 : 1); nota(j, c, true, `Bolso: resgata ${reais(v)} de ${nomeA}.`); } }
  if (b.pagar_divida_pessoal > 0) { const v = Math.min(b.pagar_divida_pessoal, Math.max(0, pes.caixa), pes.divida); if (v >= 100) { pes.divida -= v; pes.caixa -= v; nota(j, c, true, `Bolso: paga ${reais(v)} da dívida pessoal.`); } }
  for (const [para, campo, nomeA] of [['aplicar_renda_fixa', 'rendaFixa', 'renda fixa'], ['aplicar_bolsa', 'bolsa', 'bolsa'], ['comprar_imoveis', 'imoveis', 'imóveis']]) { const v = Math.min(b[para], Math.max(0, pes.caixa)); if (v >= 100) { pes.caixa -= v; pes[campo] += v * (campo === 'imoveis' ? 0.96 : 1); nota(j, c, true, `Bolso: aplica ${reais(v)} em ${nomeA}.`, v > c.patrimonio * 0.2); } }
  // Tudo acima vale só para este mês; preço, salário, equipe ideal, pró-labore e seguro ficam.
  c.pauta = { ...p, comprasDoMes: p.movimentos.filter((m) => m.acao === 'comprar_anuncio'), movimentos: [], operacoes: {}, respostas: [], agenda: [], apostas: [], financas: Object.fromEntries(Object.keys(f).map((k) => [k, 0])), bolso: Object.fromEntries(Object.keys(b).map((k) => [k, 0])), seguro: null, reposicao: null, proLabore: null };
}

function acoesExternas(j) {
  const lista = ativos(j), efeitos = {};
  const ef = (c) => (efeitos[c.id] ||= { vendas: 1, tributo: 1, encargos: 1, fixo: 1, cartel: 1 });
  for (const c of lista) ef(c);
  const das = (c, tipo) => (c.pauta?.acoes || []).filter((a) => a.tipo === tipo);
  const punir = (c, def, pct, extra = '') => {
    const multa = receita12(c) * pct;
    c.caixa -= multa; c.reputacao = lim(c.reputacao - 0.18, 0, 1); c.marca = lim(c.marca - 0.06, 0, 1); c.flagrantes++;
    nota(j, c, false, `DESCOBERTO: ${def.nome.toLowerCase()}. Multa de ${reais(multa)} e dano à reputação.${extra}`, true);
    registrar(j, `Escândalo: ${c.nome} é flagrado em ${def.nome.toLowerCase()} e multado em ${reais(multa)}.`, 'ruim', c.id);
  };
  const dentro = new Set();
  for (const c of lista) for (const a of das(c, 'propor_cartel')) {
    const par = lista.find((q) => q !== c && q.nome === a.alvo);
    if (par && (das(par, 'propor_cartel').some((x) => x.alvo === c.nome) || (par.cartel && c.cartel))) { dentro.add(c); dentro.add(par); }
    else if (par) nota(j, c, false, `${par.nome} não aceitou combinar preços.`);
  }
  for (const c of lista) if (c.cartel && !das(c, 'delatar_cartel').length && [...lista].some((q) => q !== c && q.cartel)) dentro.add(c);   // cartel em vigor continua até alguém sair ou delatar
  const delatores = lista.filter((c) => das(c, 'delatar_cartel').length && (c.cartel || dentro.has(c)));
  const caiu = (dentro.size && sorte(j, 'cade') < ACOES.propor_cartel.ilicita) || delatores.length;
  for (const c of lista) {
    const membro = dentro.has(c);
    if (membro && !caiu) { ef(c).cartel = 1.12; if (!c.cartel) { c.ilicitos++; nota(j, c, true, 'Preços combinados com a concorrência: margem maior.', true); } }
    if ((membro || c.cartel) && caiu) {
      if (delatores[0] === c) { nota(j, c, true, 'Acordo de leniência: delata o cartel ao CADE e fica imune.', true); registrar(j, `${c.nome} delata um cartel ao CADE em troca de imunidade.`, 'guerra', c.id); }
      else punir(c, ACOES.propor_cartel, 0.12, ' O CADE condena o cartel.');
    }
    c.cartel = membro && !caiu;
  }
  for (const c of lista) {
    const acoes = c.pauta?.acoes || [];
    if (c.pauta) c.pauta.acoes = [];
    for (const a of acoes) {
      const def = ACOES[a.tipo];
      if (a.tipo === 'propor_cartel' || a.tipo === 'delatar_cartel' || c.quebrou) continue;
      const alvo = def.alvo === 'ceo' ? lista.find((q) => q !== c && !q.quebrou && q.nome === a.alvo) : null;
      if (def.alvo === 'ceo' && !alvo) continue;
      const forca = lim(a.recursos / Math.max(1500, receita12(c) * 0.01), 0.3, 2);
      const melhorOp = (x) => Object.values(x.ops).filter((o) => o.unidades + o.fora > 0).sort((p, q) => q.receita - p.receita)[0];
      if (a.tipo !== 'oferta_de_compra') c.caixa -= Math.min(a.recursos, receita12(c) * 0.04);
      if (a.tipo === 'contratar_talentos') {
        const meu = melhorOp(c), dele = melhorOp(alvo);
        if (meu && dele && meu.salario > dele.salario * 1.05) { const k = 0.02 * forca; alvo.gestao = lim(alvo.gestao - k, 0, 1); dele.qualidade = lim(dele.qualidade - k, 0, 1); dele.experiencia = lim(dele.experiencia - k * 2, 0, 1); c.gestao = lim(c.gestao + k, 0, 1); meu.qualidade = lim(meu.qualidade + k, 0, 1); meu.experiencia = lim(meu.experiencia + k, 0, 1); nota(j, c, true, `Gerentes e padeiros de ${alvo.nome} vêm trabalhar aqui.`); evento(j, alvo, `${c.nome} levou gente boa da sua equipe pagando mais.`); registrar(j, `${c.nome} leva gente de ${alvo.nome} pagando mais.`, 'guerra', c.id); }
        else nota(j, c, false, `Ninguém troca ${alvo.nome} por aqui: o salário não é melhor.`);
      } else if (a.tipo === 'campanha_comparativa') {
        const meu = melhorOp(c), dele = melhorOp(alvo);
        if (meu && dele && meu.qualidade > dele.qualidade + 0.02) { c.marca = lim(c.marca + 0.02 * forca, 0, 1); alvo.marca = lim(alvo.marca - 0.015 * forca, 0, 1); nota(j, c, true, `Propaganda comparativa convence: o produto é mesmo melhor que o de ${alvo.nome}.`); }
        else { c.marca = lim(c.marca - 0.02, 0, 1); nota(j, c, false, 'O Conar suspende a propaganda comparativa: o produto não é melhor.'); }
      } else if (a.tipo === 'processo_judicial') {
        if (sorte(j, 'proc', c.id.length) < 0.2 + (alvo.ilicitos > 0 ? 0.2 : 0)) { const v = receita12(alvo) * 0.02; c.caixa += v; alvo.caixa -= v; nota(j, c, true, `Ganha na Justiça: ${alvo.nome} paga ${reais(v)}.`); evento(j, alvo, `Perdeu processo movido por ${c.nome}: ${reais(v)}.`); registrar(j, `${c.nome} vence ${alvo.nome} na Justiça.`, 'guerra', c.id); }
        else nota(j, c, false, `Processo contra ${alvo.nome} julgado improcedente; ficam as custas.`);
      } else if (a.tipo === 'denunciar_vigilancia') {
        if (sorte(j, 'vig', c.id.length) < 0.75 * (1 - alvo.compliance)) { ef(alvo).vendas *= 0.8; alvo.reputacao = lim(alvo.reputacao - 0.04, 0, 1); nota(j, c, true, `A Vigilância Sanitária interdita unidades de ${alvo.nome}.`); evento(j, alvo, 'Vigilância Sanitária interditou unidades após denúncia: vendas 20% menores no mês.'); registrar(j, `Vigilância Sanitária interdita unidades de ${alvo.nome} após denúncia.`, 'guerra', c.id); }
        else nota(j, c, false, `A fiscalização não encontra nada errado em ${alvo.nome}.`);
      } else if (a.tipo === 'oferta_de_compra') {
        const op = alvo.ops[a.negocio], fundos = Math.max(0, c.caixa) + limiteDeCredito(c);
        if (!op || op.unidades + op.fora < 1) nota(j, c, false, `${alvo.nome} não tem esse negócio para vender.`, true);
        else if (!op.vendoPor || a.recursos < op.vendoPor) nota(j, c, false, `${alvo.nome} não vende ${NEGOCIOS[a.negocio].nome.toLowerCase()} por ${reais(a.recursos)}${op.vendoPor ? ` (pede ${reais(op.vendoPor)})` : ' (não está à venda)'}.`, true);
        else if (fundos < a.recursos) nota(j, c, false, 'Oferta cai: sem caixa nem crédito para pagar.', true);
        else {
          const doCaixa = Math.min(Math.max(0, c.caixa), a.recursos);
          c.caixa -= doCaixa; c.divida += a.recursos - doCaixa; alvo.caixa += a.recursos * 0.85; alvo.lucrosRetidos += a.recursos * 0.85;
          c.ops[a.negocio] ||= novaOperacao(a.negocio);
          const meu = c.ops[a.negocio], nMeu = meu.unidades + meu.fora, nDele = op.unidades + op.fora;
          meu.qualidade = (meu.qualidade * nMeu + op.qualidade * nDele) / Math.max(1, nMeu + nDele);
          for (const [l, n] of Object.entries(op.locais)) meu.locais[l] = (meu.locais[l] || 0) + n;
          meu.unidades += op.unidades; meu.fora += op.fora; meu.equipe += op.equipe; op.unidades = 0; op.fora = 0; op.equipe = 0; op.vendoPor = 0; op.locais = {};
          nota(j, c, true, `Compra ${NEGOCIOS[a.negocio].nome.toLowerCase()} de ${alvo.nome} por ${reais(a.recursos)}.`, true);
          registroDoMes(j, alvo).notas.push({ ok: true, texto: `Vende ${NEGOCIOS[a.negocio].nome.toLowerCase()} a ${c.nome} por ${reais(a.recursos)}.`, macro: true });
          registrar(j, `${c.nome} compra ${NEGOCIOS[a.negocio].nome.toLowerCase()} de ${alvo.nome} por ${reais(a.recursos)}.`, 'guerra', c.id);
        }
      } else if (def.ilicita) {
        c.ilicitos++;
        let multa = 0.04, extra = '';
        const dele = alvo && melhorOp(alvo), meu = melhorOp(c);
        if (a.tipo === 'espionagem' && dele && meu) { meu.qualidade = lim(meu.qualidade + Math.max(0.02, (dele.qualidade - meu.qualidade) * 0.5) * Math.min(1, forca), 0, 1); nota(j, c, true, `Receitas e processos de ${alvo.nome} chegam à cozinha.`); }
        if (a.tipo === 'difamacao') { alvo.marca = lim(alvo.marca - 0.05 * forca, 0, 1); alvo.reputacao = lim(alvo.reputacao - 0.03 * forca, 0, 1); nota(j, c, true, `Boatos derrubam a imagem de ${alvo.nome}.`); evento(j, alvo, 'Boatos nas redes derrubaram a imagem da marca. Origem desconhecida.'); }
        if (a.tipo === 'sabotagem_cibernetica') { ef(alvo).vendas *= 1 - 0.25 * Math.min(1.5, forca) * (0.3 + alvo.tecnologia); nota(j, c, true, `Os sistemas de ${alvo.nome} param.`); evento(j, alvo, 'Ataque derrubou os sistemas da empresa neste mês.'); multa = 0.06; extra = ' Afastado dos negócios por três anos.'; }
        if (a.tipo === 'sonegacao') { ef(c).tributo = 0.6; nota(j, c, true, 'Parte das vendas do mês sai sem nota.'); multa = 0.05; }
        if (a.tipo === 'trabalho_sem_registro') { ef(c).encargos = 0.5; c.semRegistro = j.t; nota(j, c, true, 'Parte da equipe trabalha sem carteira neste mês.'); multa = 0.04; }
        if (a.tipo === 'propaganda_enganosa') { c.marca = lim(c.marca + 0.05 * forca, 0, 1); nota(j, c, true, 'A campanha promete mais do que entrega, e vende.'); multa = 0.03; }
        if (a.tipo === 'suborno') { ef(c).fixo = 0.6; c.subornou = j.t; nota(j, c, true, 'A fiscalização deixa de ser problema por um tempo.'); multa = 0.08; }
        if (a.tipo === 'uso_indevido_de_dados') { c.marca = lim(c.marca + 0.03 * forca, 0, 1); nota(j, c, true, 'Dados de clientes alimentam a publicidade.'); multa = 0.02; }
        if (sorte(j, `pego:${a.tipo}`, c.id.length) < Math.min(0.9, def.ilicita * fed(j).fiscalizacao + 0.02 * c.ilicitos + (alvo ? alvo.compliance * 0.15 : 0))) {
          punir(c, def, multa, extra);
          if (a.tipo === 'sabotagem_cibernetica') c.afastado = 36;
          if (alvo && (a.tipo === 'espionagem' || a.tipo === 'difamacao')) { const ind = receita12(c) * 0.02; c.caixa -= ind; alvo.caixa += ind; evento(j, alvo, `${c.nome} foi condenado a indenizar você em ${reais(ind)}.`); }
        }
      }
    }
  }
  return efeitos;
}

// Negócios de terceiros à venda em Campinas e região. O anúncio mostra o que o
// vendedor quer mostrar; a verdade (receita real, estado da operação, contas
// escondidas) só aparece com auditoria ou depois da compra.
const MOTIVOS = ['o dono vai se aposentar', 'a família vai mudar de cidade', 'os sócios brigaram', 'o dono quer investir em outro ramo', 'problemas de saúde na família', 'o dono diz que cansou'];
function atualizarAnuncios(j) {
  j.anuncios = (j.anuncios || []).filter((a) => a.ate > j.t + 1);
  if (j.anuncios.length >= 5 || sorte(j, 'anuncio') > 0.55) return;
  const S = (k) => sorte(j, `anuncio|${k}`);
  const tipos = ['padaria', 'padaria', 'cafeteria', 'minimercado', 'restaurante', 'delivery'], tipo = tipos[Math.floor(S('tipo') * tipos.length)], def = NEGOCIOS[tipo];
  const ids = Object.keys(LOCAIS), local = ids[Math.floor(S('local') * ids.length)];
  const q = 0.3 + 0.45 * S('q'), ponto = 0.8 + 0.45 * S('ponto'), inflado = 1 + 0.4 * S('inf') ** 2;
  const receitaReal = (def.receita / 12) * LOCAIS[local].renda * (j.cidade.renda / j.base.renda) * (0.55 + 0.9 * q) * ponto;
  const declarada = Math.round(receitaReal * inflado / 100) * 100;
  const pede = Math.round(declarada * 12 * (0.32 + 0.22 * S('pede')) / 1000) * 1000;
  j.anuncios.push({
    id: j.proxAnuncio++, tipo, local, pede, declarada, motivo: MOTIVOS[Math.floor(S('motivo') * MOTIVOS.length)], anos: 2 + Math.floor(S('anos') * 25), ate: j.t + 5,
    q, ponto, receitaReal: Math.round(receitaReal), exp: 0.4 + 0.5 * S('exp'), minimo: Math.round(pede * (0.72 + 0.23 * S('min'))), passivo: S('pas') < 0.3 ? Math.round(pede * (0.08 + 0.3 * S('pas2'))) : 0,
  });
}
const anuncioPublico = (a, j) => ({ anuncio: a.id, negocio: a.tipo, onde: a.local, pede: a.pede, receita_mensal_declarada: a.declarada, funcionarios: NEGOCIOS[a.tipo].func, anos_de_casa: a.anos, motivo_da_venda: a.motivo, meses_no_ar: a.ate - j.t });

// Ofertas pelos anúncios: vale para os três ao mesmo tempo. Leva quem oferece mais; empate, o vendedor espera.
function mercadoDeNegocios(j) {
  const ofertas = {};
  for (const c of ativos(j)) for (const m of c.pauta?.comprasDoMes || []) {
    const an = (j.anuncios || []).find((x) => x.id === m.anuncio);
    if (!an) { nota(j, c, false, `Anúncio ${m.anuncio} não existe mais.`); continue; }
    if (c.recuperacao) { nota(j, c, false, 'Em recuperação judicial, não pode comprar negócios.', true); continue; }
    if (m.oferta < an.minimo) { nota(j, c, false, `O vendedor do anúncio ${an.id} recusou ${reais(m.oferta)} (pede ${reais(an.pede)}).`, true); continue; }
    if (Math.max(0, c.caixa) + limiteDeCredito(c) < m.oferta) { nota(j, c, false, `Oferta de ${reais(m.oferta)} pelo anúncio ${an.id} cai: sem caixa nem crédito para pagar.`, true); continue; }
    (ofertas[an.id] ||= []).push({ c, valor: m.oferta });
  }
  for (const [id, lista] of Object.entries(ofertas)) {
    const an = j.anuncios.find((x) => x.id === +id), maior = Math.max(...lista.map((o) => o.valor)), melhores = lista.filter((o) => o.valor === maior);
    for (const o of lista) if (o.valor < maior) nota(j, o.c, false, `Perde o anúncio ${an.id} para uma oferta maior.`, true);
    if (melhores.length > 1) { for (const o of melhores) nota(j, o.c, false, `Duas ofertas iguais pelo anúncio ${an.id}: o vendedor pediu uma nova rodada.`, true); continue; }
    const { c, valor } = melhores[0], def = NEGOCIOS[an.tipo];
    const doCaixa = Math.min(Math.max(0, c.caixa), valor);
    c.caixa -= doCaixa; c.divida += valor - doCaixa;
    const novo = unidadesDe(c, an.tipo) === 0;
    c.ops[an.tipo] ||= novaOperacao(an.tipo);
    const op = c.ops[an.tipo], n = op.unidades + op.fora;
    op.qualidade = (op.qualidade * n + an.q) / (n + 1);
    op.experiencia = lim((op.experiencia * op.equipe + an.exp * def.func) / Math.max(1, op.equipe + def.func), 0, 1);
    op.locais[an.local] = (op.locais[an.local] || 0) + 1; op[LOCAIS[an.local].fora ? 'fora' : 'unidades']++; op.equipe += def.func;
    if (novo) op.contrato = j.t;
    // A clientela vem junto, para o bem ou para o mal, e vai se diluindo.
    op.efeitos.push({ fator: 1 + (an.ponto - 1) / (n + 1), meses: 18, motivo: 'clientela herdada do negócio comprado' });
    if (an.passivo > 0) (c.herdados ||= []).push({ em: j.t + 3 + Math.floor(sorte(j, `herd|${an.id}`) * 8), valor: an.passivo, onde: LOCAIS[an.local].nome });
    c.pulsos = [...(c.pulsos || []).slice(-20), { t: j.t, local: an.local, tipo: 'abriu' }];
    j.anuncios = j.anuncios.filter((x) => x !== an);
    nota(j, c, true, `Compra ${def.nome.toLowerCase()} em ${LOCAIS[an.local].nome} por ${reais(valor)} (pediam ${reais(an.pede)}): leva o ponto, a equipe e a clientela.`, true);
    registrar(j, `${c.nome} compra ${def.nome.toLowerCase()} em ${LOCAIS[an.local].nome} por ${reais(valor)}.`, 'bom', c.id);
    if (novo) c.marcos.push({ t: j.t, texto: `Compra e entra em ${def.nome.toLowerCase()}` });
  }
}

// O apelo de um negócio para o cliente: qualidade, marca, preço e, onde importa, tecnologia.
const apelo = (c, op, cartel = 1) => Math.exp(1.5 * op.qualidade + 1.2 * c.marca + (NEGOCIOS[op.tipo].digital ? 1.2 * c.tecnologia : 0.3 * c.tecnologia) + 0.5 * c.produto + 0.4 * c.design + 0.4 * c.atendimento
  - (3 - 1.4 * c.design) * (op.preco * cartel - 1)) * Math.pow(0.4 + c.reputacao, 0.5);

function fecharMes(j, c, ef, foto0, cidadeMes) {
  const cid = j.cidade, sal = salarioMensal(j), mes = mesDe(j), F = fed(j), M = mun(j);
  const renda = (cid.renda / j.base.renda) * (1 + j.cen.crescimento * 1.5) * F.demanda * M.movimento, povo = cid.pop / j.base.pop;
  const carga = cargaDeGestao(c), capGestao = capacidadeDeGestao(c);
  const folga = Math.pow(Math.min(1, capGestao / Math.max(0.1, carga)), 0.6);
  const melhora = Math.pow(1.002, j.t / 12);          // o resto do mercado também evolui
  const sinergia = unidadesDe(c, 'distribuidora') > 0 ? 0.06 : 0;
  let receita = 0, insumos = 0, folha = 0, alugueis = 0, fixos = 0, funcionarios = 0;
  const porOp = {};
  for (const op of Object.values(c.ops)) {
    const def = NEGOCIOS[op.tipo], u = op.unidades + op.fora;
    op.receita = 0; op.lucro = 0;
    if (!u) continue;
    const rivais = ativos(j).filter((r) => r !== c && unidadesDe(r, op.tipo) > 0);
    const unRivais = rivais.reduce((s, r) => s + unidadesDe(r, op.tipo), 0);
    const referencia = apelo(PADRAO, { tipo: op.tipo, qualidade: 0.5, preco: 1 }) * melhora;
    const mediaRivais = unRivais ? rivais.reduce((s, r) => s + foto0[r.id][op.tipo] * unidadesDe(r, op.tipo), 0) / unRivais : referencia;
    // Uma rede forte por perto tira clientes, mas a cidade tem mais de mil outras padarias:
    // o estrago de um rival sobre as suas vendas tem teto (cerca de 17%).
    const peso = Math.min(0.2, unRivais / (def.S * 0.8));
    const rel = apelo(c, op, ef.cartel) / ((1 - peso) * referencia + peso * Math.min(mediaRivais, referencia * 2));
    // Cada unidade vende conforme o lugar onde está: renda do público e quantas das três redes dividem a clientela ali.
    const ocup = ocupacao(j, op.tipo);
    const pontos = Object.entries(op.locais).reduce((s, [l, n]) => s + n * fatorLocal(op.tipo, l, ocup), 0);
    const aluguelLocal = Object.entries(op.locais).reduce((s, [l, n]) => s + n * LOCAIS[l].aluguel, 0);
    const digital = def.digital ? 0.6 + 0.9 * lim(j.t / 360, 0, 1) : 1;
    const lotacao = Math.pow(lim(op.equipe / Math.max(1, u * def.func), 0.3, 1.6), 0.5);          // equipe incompleta atende pior
    const moral = lim(0.55 + 0.45 * op.salario, 0.6, 1.25) * (0.85 + 0.3 * c.treinamento) * (0.82 + 0.3 * op.experiencia);
    const atendimento = lotacao * moral;
    const greve = op.salario < 0.85 && sorte(j, `greve:${op.tipo}`) < 0.05;
    const choques = op.efeitos.reduce((s, e) => s * e.fator, 1) * cidadeMes.vendas * ef.vendas * (greve ? 0.6 : 1);
    const base = (def.receita / 12) * renda * Math.pow(rel, 0.85) * SAZONAL[mes] * digital * atendimento * folga * choques * (0.94 + 0.2 * c.vendas) * (1 + 0.22 * Math.min(1.5, op.publico || 0)) * (op.impulso || 1);
    const limite = u * (def.receita / 12) * renda * 1.4 * atendimento * SAZONAL[mes] * (0.895 + 0.3 * c.operacoes);
    const volume = Math.min(limite, base * pontos);
    const rec = volume * op.preco * ef.cartel;
    const ins = volume * def.insumo * Math.pow(j.trigo, 1 - 0.5 * c.compras) * (1.03 - 0.1 * c.compras) * (1 - sinergia) * (1 - 0.1 * c.tecnologia) / folga ** 0.3;
    const fol = op.equipe * sal * op.salario;
    const alu = aluguelLocal * (def.aluguel / 12) * Math.pow(cid.renda / j.base.renda, 0.7) * op.aluguel;
    const fix = u * (def.receita / 12) * 0.05 * ef.fixo * M.fixos;
    op.receita = rec; porOp[op.tipo] = { rec, direto: ins + fol + alu + fix, fol };
    receita += rec; insumos += ins; folha += fol; alugueis += alu; fixos += fix; funcionarios += op.equipe;
    if (greve) { nota(j, c, false, `Greve por salários em ${def.nome.toLowerCase()}: mês com 40% menos vendas.`); evento(j, c, `Greve em ${def.nome.toLowerCase()}: salário abaixo do mercado.`); }
    op.efeitos = op.efeitos.filter((e) => --e.meses > 0);
    // Cliente conquistado se perde aos poucos; o canal descansa quando não é usado.
    op.publico = (op.publico || 0) * 0.94; op.impulso = 1;
    for (const k of Object.keys(op.fadiga || {})) { op.fadiga[k] -= 0.1; if (op.fadiga[k] <= 0) delete op.fadiga[k]; }
    // A equipe ganha experiência com o tempo de casa.
    op.experiencia = lim(op.experiencia + 0.02 * (1 - op.experiencia), 0, 1);
  }
  let royalties = 0;
  if (c.franquia) {
    const novos = quantos(j, 'franq', 1, lim(c.marca * folga * (3 + c.franqueados * 0.12) * (c.reputacao + 0.4), 0, 60) / 12);
    const saem = quantos(j, 'franqsai', c.franqueados, 0.04 * (1.3 - c.reputacao) / 12);
    c.franqueados = Math.max(0, c.franqueados + novos - saem);
    royalties = (c.franqueados * NEGOCIOS.padaria.receita * renda * FRANQUIA.royalties) / 12 * SAZONAL[mes] + novos * FRANQUIA.taxa;
  }
  const contratos = c.contratos.reduce((s, k) => s + k.mensal, 0);
  c.contratos = c.contratos.filter((k) => --k.meses > 0);
  receita += royalties + contratos; insumos += contratos * 0.55;
  const premio = c.seguro ? receita * 0.004 : 0;
  // Regime pela receita dos últimos 12 meses (regra do Simples).
  c.receitas12 = [...c.receitas12.slice(-11), receita];
  const r12 = receita12(c), simples = r12 <= REGRAS.simplesTeto;
  const encargos = folha * lim((simples ? REGRAS.encargosSimples : REGRAS.encargos) + F.encargos, 0.2, 0.9) * ef.encargos;
  const presumido = !simples && r12 <= REGRAS.presumidoTeto;
  const tribVendas = (simples ? receita * aliquotaSimples(r12) : anoDe(j) < REGRAS.anoIVA ? receita * REGRAS.tributoVendas : Math.max(0, receita - insumos) * REGRAS.iva * REGRAS.ivaAlimentos) * ef.tributo * (1.03 - 0.1 * c.contabilidade);
  // Em recuperação judicial as dívidas ficam suspensas: não correm juros.
  const juros = c.recuperacao ? 0 : (c.divida * jurosAoAno(j, c)) / 12;
  // O pró-labore sai do movimento do mês; sem caixa, o dono tira no máximo 15% da receita.
  const proLabore = temNegocio(c) ? Math.min(c.proLabore, Math.max(receita * 0.15, c.caixa + receita)) : 0;
  const inssEmpresa = simples ? 0 : proLabore * 0.2;
  const rendeCaixa = Math.max(0, c.caixa) * (j.juros / 12) * c.financas * 0.8;        // tesouraria: caixa parado rende
  const base = receita + rendeCaixa - insumos - folha - encargos - alugueis - fixos - tribVendas - premio - juros - proLabore - inssEmpresa;
  let ir = 0;
  if (presumido) ir = (receita * REGRAS.presIRPJ * REGRAS.irpjBase + Math.max(0, receita * REGRAS.presIRPJ - REGRAS.adicionalAcima) * REGRAS.irpjAdicional + receita * REGRAS.presCSLL * REGRAS.csll) * (1 + F.irpj / REGRAS.irpj) * ef.tributo;
  else if (!simples) { if (base > 0) { const abate = Math.min(c.prejuizoFiscal, base * 0.3); c.prejuizoFiscal -= abate; ir = (base - abate) * (REGRAS.irpj + F.irpj); } else c.prejuizoFiscal += -base; }
  const lucro = base - ir;
  c.caixa += lucro; c.lucrosRetidos += lucro;
  const antigo = c.regime;
  c.regime = simples ? 'Simples Nacional' : presumido ? 'Lucro presumido' : 'Lucro real';
  if (antigo !== c.regime) { nota(j, c, simples, simples ? 'Volta ao Simples Nacional.' : antigo === 'Simples Nacional' ? 'A receita de 12 meses passa de R$ 4,8 milhões: sai do Simples, com imposto e encargos bem maiores.' : `Muda de regime: ${c.regime.toLowerCase()}.`, true); if (antigo === 'Simples Nacional') c.marcos.push({ t: j.t, texto: 'Sai do Simples Nacional' }); }
  for (const op of Object.values(c.ops)) {
    const x = porOp[op.tipo];
    if (!x) { if (op.unidades + op.fora === 0) op.lucros12 = []; continue; }
    const parte = receita > 0 ? x.rec / receita : 0;
    op.lucro = x.rec - x.direto - x.fol * lim((simples ? REGRAS.encargosSimples : REGRAS.encargos) + F.encargos, 0.2, 0.9) * ef.encargos - (tribVendas + ir + premio) * parte;
    op.lucros12 = [...op.lucros12.slice(-11), op.lucro];
  }

  // O bolso do dono: pró-labore líquido, custo de vida, rendimentos.
  const pes = c.pessoal, vida = custoDeVida(j);
  const inss = Math.min(proLabore * REGRAS.inssProLabore, REGRAS.tetoInss * (cid.renda / j.base.renda));
  const irpf = irpfMensal(proLabore, inss, cid.renda / j.base.renda);
  const ganhoRF = pes.rendaFixa * (j.juros / 12) * (1 - REGRAS.irAplicacao);
  const ganhoBolsa = pes.bolsa * j.bolsaMes * (j.bolsaMes > 0 ? 1 - REGRAS.irAplicacao : 1);
  const aluguelRecebido = (pes.imoveis * 0.05) / 12 * (1 - REGRAS.irAplicacao);
  pes.rendaFixa += ganhoRF; pes.bolsa = Math.max(0, pes.bolsa + ganhoBolsa); pes.imoveis *= 1 + 0.01 / 12 + cidadeMes.valorizacao;
  pes.caixa += proLabore - inss - irpf + aluguelRecebido - vida;
  if (pes.divida > 0) pes.divida *= 1.035;                             // dívida pessoal (cartão, cheque especial): 3,5% ao mês
  if (pes.caixa < 0) {
    for (const campo of ['rendaFixa', 'bolsa']) { const v = Math.min(pes[campo], -pes.caixa); pes[campo] -= v; pes.caixa += v; }
    // Faltou no bolso e a empresa tem lucro em caixa: o dono faz uma retirada para cobrir.
    if (pes.caixa < 0 && c.caixa > 0 && c.lucrosRetidos > 0 && !c.recuperacao) { const v = Math.min(-pes.caixa, c.caixa, c.lucrosRetidos); c.caixa -= v; c.lucrosRetidos -= v; pes.caixa += v; }
    if (pes.caixa < 0) { pes.divida += -pes.caixa; pes.caixa = 0; if (!c.avisoBolso || j.t - c.avisoBolso > 6) { c.avisoBolso = j.t; evento(j, c, 'O pró-labore não cobre o custo de vida: a diferença virou dívida pessoal a 3,5% ao mês.'); } }
  }

  c.receita = receita; c.lucro = lucro; c.funcionarios = funcionarios;
  const R = Math.round;
  registroDoMes(j, c).resultado = {
    receita: R(receita), insumos: R(insumos), salarios: R(folha), encargos: R(encargos), alugueis: R(alugueis), custos_fixos: R(fixos + premio), tributos_sobre_vendas: R(tribVendas), juros: R(juros),
    pro_labore: R(proLabore), imposto_sobre_lucro: R(ir + inssEmpresa), lucro_liquido: R(lucro), regime: c.regime, gestao_dando_conta: +folga.toFixed(2),
    bolso: { pro_labore_liquido: R(proLabore - inss - irpf), custo_de_vida: R(vida), rendimentos: R(ganhoRF + ganhoBolsa + aluguelRecebido) },
  };
  if (folga < 0.85 && mes === 0) nota(j, c, false, `A rede cresceu além da gestão (carga ${carga.toFixed(0)}, capacidade ${capGestao.toFixed(0)}): vendas e custos pioram.`);

  // Sem cuidado, cada valência volta devagar ao piso.
  for (const v of Object.values(VALENCIAS)) if (c[v.campo] > v.piso) c[v.campo] += (v.piso - c[v.campo]) * (0.06 / 12);
  for (const op of Object.values(c.ops)) if (op.qualidade > 0.5) op.qualidade += (0.5 - op.qualidade) * (0.04 / 12);
  c.reputacao = lim(c.reputacao + (0.02 * (0.6 - c.reputacao) + 0.01 * c.compliance + 0.03 * (c.atendimento - 0.35)) / 4, 0, 1);

  // Empresa sem caixa: crédito de emergência; sem crédito, recuperação judicial; sem saída, falência.
  if (c.caixa < 0) {
    const credito = limiteDeCredito(c);
    if (!c.recuperacao && credito >= -c.caixa) { c.divida += -c.caixa; c.caixa = 0; }
    else if (!c.recuperacao) {
      c.recuperacao = 24; c.divida = c.divida * 0.6 + -c.caixa * 0.6; c.caixa = 0; c.reputacao = lim(c.reputacao - 0.2, 0, 1);
      nota(j, c, false, 'Sem caixa e sem crédito: a empresa pede recuperação judicial (Lei 11.101/2005). Dois anos para se reerguer.', true);
      registrar(j, `A empresa de ${c.nome} entra em recuperação judicial.`, 'ruim', c.id);
    }
  }
  if (c.recuperacao && --c.recuperacao === 0) {
    const anual = Object.values(c.ops).reduce((s, op) => s + lucro12(op), 0);
    if (c.caixa < 0 || anual < 0) {
      // Falência da empresa: os negócios acabam, as dívidas dela também. O dono segue com o que tem no bolso.
      for (const op of Object.values(c.ops)) { op.unidades = 0; op.fora = 0; op.equipe = 0; op.lucros12 = []; op.efeitos = []; op.locais = {}; }
      c.caixa = 0; c.divida = 0; c.franqueados = 0; c.franquia = false; c.lucrosRetidos = 0; c.contratos = []; c.capital = 0; c.falencias++; c.reputacao = 0.3; c.marca = 0.2;
      nota(j, c, false, 'Falência da empresa decretada. Os negócios fecham. O dono fica com o que tem no próprio nome e pode recomeçar.', true);
      registrar(j, `A empresa de ${c.nome} vai à falência.`, 'guerra', c.id);
      c.marcos.push({ t: j.t, texto: 'Falência da empresa' });
    } else { nota(j, c, true, 'Sai da recuperação judicial.', true); registrar(j, `A empresa de ${c.nome} sai da recuperação judicial.`, 'bom', c.id); }
  }
  if (c.afastado) c.afastado--;
  c.patrimonio = patrimonio(j, c);
  // Fora do jogo: sem negócio e com dívida pessoal que não tem como pagar (insolvência civil).
  if (bensPessoais(c) + Math.max(0, valorDaEmpresa(j, c)) < -vida * 24) { c.quebrou = anoDe(j); c.fim = 'insolvência pessoal: dívidas maiores que tudo o que tem'; c.patrimonio = 0; nota(j, c, false, `Fim de jogo: ${c.fim}.`, true); registrar(j, `${c.nome} está fora do jogo: ${c.fim}.`, 'guerra', c.id); return; }
  const reg = registroDoMes(j, c);
  reg.numeros = { caixa_empresa: R(c.caixa), divida_empresa: R(c.divida), pro_labore: R(c.proLabore), salario_pago: +(Object.values(c.ops).find((o) => o.unidades + o.fora > 0)?.salario ?? 1).toFixed(2), funcionarios: R(funcionarios), bolso: R(bensPessoais(c)), empresa_vale: R(valorDaEmpresa(j, c)), patrimonio: R(c.patrimonio) };
  for (const marco of [1e6, 1e7, 1e8, 1e9, 1e10, 1e11]) if (c.patrimonio >= marco && !c.marcos.some((m) => m.valor === marco)) { c.marcos.push({ t: j.t, valor: marco, texto: `Patrimônio passa de ${reais(marco)}` }); registrar(j, `${c.nome} passa de ${reais(marco)} de patrimônio.`, 'era', c.id); }
}

// ---------- o acaso do mês seguinte ----------

function sortearEventos(j, c) {
  if (c.quebrou) return;
  for (const h of (c.herdados || []).filter((x) => x.em <= j.t + 1)) { c.caixa -= h.valor; evento(j, c, `Apareceu uma conta antiga do negócio comprado em ${h.onde}: ${reais(h.valor)} em ações trabalhistas e impostos atrasados do dono anterior.`); }
  c.herdados = (c.herdados || []).filter((x) => x.em > j.t + 1);
  if (!temNegocio(c)) return;
  const F = fed(j), M = mun(j), cid = j.cidade, sal = salarioMensal(j);
  const pend = (tipo, txt, opcoes, dados = {}) => { c.pendencias.push({ id: c.proxPendencia++, tipo, texto: txt, opcoes, ...dados }); evento(j, c, txt); };
  const ops = Object.values(c.ops).filter((o) => o.unidades + o.fora > 0);
  const u = totalUnidades(c), principal = [...ops].sort((a, b) => b.receita - a.receita)[0];
  // 1. Clima sério: 2% ao mês, na cidade inteira.
  if (sorte(j, 'clima') < EVENTOS.clima.chance) {
    const dano = ops.reduce((s, o) => s + o.unidades * NEGOCIOS[o.tipo].capex * 0.05, 0), paga = dano * (c.seguro ? 0.2 : 1);
    c.caixa -= paga; for (const o of ops) o.efeitos.push({ fator: 0.7, meses: 1, motivo: 'estragos do temporal' });
    evento(j, c, `Evento climático sério em Campinas: estragos de ${reais(dano)}${c.seguro ? `, o seguro cobre 80% (você paga ${reais(paga)})` : ', sem seguro'}; próximo mês com 30% menos vendas.`);
  }
  // 2. Assaltos: 5% por unidade por mês; segurança e policiamento reduzem.
  const lugares = locaisDe(c), lugar = (k) => (lugares.length ? lugares[Math.floor(sorte(j, `lugar:${k}`) * lugares.length)].local : null);
  const pulso = (k, tipo) => { const l = lugar(k); if (l) c.pulsos = [...(c.pulsos || []).slice(-20), { t: j.t + 1, local: l, tipo }]; return l ? LOCAIS[l].nome : 'uma unidade'; };
  const nAssaltos = quantos(j, 'assalto', u, EVENTOS.assalto.chance * (1.3 - c.seguranca * 1.1) * M.assalto * lim(cid.ind.homicidios / 22, 0.5, 2));
  if (nAssaltos > 0) {
    const perda = nAssaltos * (c.receita / Math.max(1, u)) * 0.07, paga = c.seguro ? perda * 0.2 : perda;
    c.caixa -= paga; for (const o of ops) o.experiencia = lim(o.experiencia - 0.01 * nAssaltos / Math.max(1, u), 0, 1);
    evento(j, c, `${nAssaltos > 1 ? `${nAssaltos} assaltos` : 'Assalto'} (${pulso('assalto', 'assalto')}): levaram ${reais(perda)}${c.seguro ? ` (seguro cobre 80%)` : ''} e a equipe ficou abalada.`);
  }
  // 3. Pedidos de demissão: 15% ao mês para uma equipe de 8, por operação.
  for (const o of ops) {
    const p = (EVENTOS.pedido_demissao.chance / 8) * lim(1.9 - o.salario * 0.9, 0.3, 2.5) * (1.25 - 0.5 * c.treinamento) * (o.equipe > (o.unidades + o.fora) * o.func * 1.02 ? 0.8 : 1);
    const n = quantos(j, `sair:${o.tipo}`, o.equipe, p);
    if (n > 0) pend('pedido_demissao', `${n} funcionário${n > 1 ? 's' : ''} de ${NEGOCIOS[o.tipo].nome.toLowerCase()} pedi${n > 1 ? 'ram' : 'u'} para sair (salário em ${(o.salario * 100).toFixed(0)}% do mercado).`, ['nao_repor', 'repor', 'contraproposta'], { negocio: o.tipo, n });
  }
  // 5. Equipamento quebrado: 4% por unidade por mês; manutenção reduz.
  for (const o of ops) {
    const n = quantos(j, `forno:${o.tipo}`, o.unidades + o.fora, EVENTOS.equipamento.chance * (1.4 - c.manutencao * 1.2));
    if (n > 0) pend('equipamento', `${n > 1 ? `${n} equipamentos quebraram` : 'O forno quebrou'} em ${NEGOCIOS[o.tipo].nome.toLowerCase()}. Consertar custa ${reais(6_000 * n)} e uma semana; trocar custa ${reais(45_000 * n)}.`, ['improvisar', 'consertar', 'trocar'], { negocio: o.tipo, n, fracao: n / (o.unidades + o.fora) });
  }
  // Fiscalização: com controles fracos, multa.
  if (sorte(j, 'fiscal') < EVENTOS.fiscalizacao.chance * F.fiscalizacao * M.fiscalizacao && !(c.subornou && j.t - c.subornou < 12)) {
    if (sorte(j, 'fiscal2') > (c.compliance + c.contabilidade) / 2 + 0.2) { const multa = c.receita * 0.25 * (1 - (c.compliance + c.contabilidade) / 2); c.caixa -= multa; evento(j, c, `Fiscalização encontrou irregularidades: multa de ${reais(multa)}.`); }
    else evento(j, c, 'Fiscalização passou e não encontrou nada.');
  }
  // Concorrente novo e obra na rua, por unidade.
  if (principal) {
    const nConc = quantos(j, 'conc', u, EVENTOS.concorrente.chance);
    if (nConc > 0) { principal.efeitos.push({ fator: 1 - 0.06 * Math.min(1, nConc / Math.max(1, principal.unidades + principal.fora)), meses: 18, motivo: 'concorrente novo no bairro' }); evento(j, c, `${nConc > 1 ? `${nConc} concorrentes novos abriram` : 'Um concorrente novo abriu'} perto da sua unidade (${pulso('conc', 'concorrente')}).`); }
    const nObra = quantos(j, 'obra', u, EVENTOS.obra.chance);
    if (nObra > 0) { principal.efeitos.push({ fator: 1 - 0.15 * Math.min(1, nObra / Math.max(1, principal.unidades + principal.fora)), meses: 3, motivo: 'obra na rua' }); evento(j, c, `A prefeitura abriu obra na rua da unidade (${pulso('obra', 'obra')}): três meses de movimento menor.`); }
  }
  // Redes sociais: para o bem ou para o mal.
  if (sorte(j, 'redes') < EVENTOS.redes.chance && principal) {
    if (principal.qualidade > 0.55 && sorte(j, 'redes2') < 0.4 + principal.qualidade * 0.5) { c.marca = lim(c.marca + 0.05, 0, 1); evento(j, c, 'Um vídeo elogiando o produto viralizou: a marca ganha força.'); }
    else if (principal.qualidade < 0.5) { c.marca = lim(c.marca - 0.04, 0, 1); c.reputacao = lim(c.reputacao - 0.03, 0, 1); evento(j, c, 'Uma reclamação viralizou nas redes: a marca sofre.'); }
  }
  if (sorte(j, 'enc') < EVENTOS.encomenda.chance && (c.ops.padaria?.unidades || c.ops.cafeteria?.unidades)) { const valor = 6_000 + sorte(j, 'encv') * 16_000 * (cid.renda / j.base.renda); pend('encomenda', `Pedido de encomenda grande para o mês que vem: ${reais(valor)}. Exige equipe completa.`, ['recusar', 'aceitar'], { valor }); }
  // Ação trabalhista: mais provável com salário baixo, demissões e gente sem registro.
  const risco = EVENTOS.trabalhista.chance * (1 + (c.demitidos || 0) * 0.5 + (c.semRegistro !== undefined && j.t - c.semRegistro < 24 ? 3 : 0) + (principal && principal.salario < 0.95 ? 1 : 0)) * F.fiscalizacao * Math.sqrt(Math.max(1, c.funcionarios / 8));
  if (sorte(j, 'trab') < Math.min(0.5, risco)) { const valor = sal * (3 + sorte(j, 'trabv') * 6); pend('trabalhista', `Ex-funcionário entrou com ação trabalhista pedindo ${reais(valor)}.`, ['contestar', 'acordo'], { valor }); }
  c.demitidos = 0;
  if (sorte(j, 'furto') < EVENTOS.furto.chance * (1.5 - c.gestao) * Math.sqrt(Math.max(1, u))) { const v = c.receita * 0.03; c.caixa -= v; evento(j, c, `Furto interno descoberto no fechamento do caixa: ${reais(v)}.`); }
  if (sorte(j, 'energia') < EVENTOS.energia.chance) { for (const o of ops) o.efeitos.push({ fator: 0.92, meses: 1, motivo: 'falta de energia' }); evento(j, c, 'Falta de energia e água em Campinas: vendas menores no próximo mês.'); }
  if (sorte(j, 'ponto') < EVENTOS.ponto.chance && !c.recuperacao) { c.pontoBom = j.t + 1; evento(j, c, 'Um ponto comercial muito bom vagou: abrir uma padaria ali no mês que vem custa 25% menos.'); }
  if (sorte(j, 'licit') < EVENTOS.licitacao.chance * M.licitacao && (c.ops.padaria?.unidades || c.ops.fabrica?.unidades)) pend('licitacao', `A prefeitura abriu licitação de pão para a merenda: ${reais(9_000 * (cid.renda / j.base.renda))} por mês durante um ano, margem apertada. Exige controles em ordem (compliance 0,5).`, ['nao_participar', 'participar'], { valor: 9_000 * (cid.renda / j.base.renda) });
  if (principal && sorte(j, 'cliente') < EVENTOS.cliente.chance * (2.5 - principal.qualidade - c.compliance - c.atendimento * 0.8) * Math.sqrt(Math.max(1, u))) { const multa = c.receita * 0.15; c.caixa -= multa; c.reputacao = lim(c.reputacao - 0.06, 0, 1); evento(j, c, `Um cliente passou mal e denunciou ao Procon: multa de ${reais(multa)} e a reputação sofre.`); }
  // Renovação do aluguel: a cada 36 meses de cada negócio.
  for (const o of ops) if ((j.t + 1 - o.contrato) % 36 === 0 && j.t + 1 > o.contrato) pend('aluguel', `Renovação do aluguel de ${NEGOCIOS[o.tipo].nome.toLowerCase()}: o proprietário pede reajuste de 12% acima da inflação.`, ['aceitar', 'negociar'], { negocio: o.tipo });
}

// Avança um mês: executa o que foi despachado, fecha as contas e sorteia o mês seguinte.
export function avancarMes(j) {
  const cid = j.cidade, mes = mesDe(j), ano = anoDe(j);
  // Humor da bolsa e preço do trigo: iguais para todos.
  const z = Math.sqrt(-2 * Math.log(Math.max(1e-9, sorte(j, 'b1')))) * Math.cos(2 * Math.PI * sorte(j, 'b2'));
  j.bolsaMes = lim(0.0053 + j.cen.crescimento * 0.15 + z * 0.052, -0.3, 0.3);
  j.trigo = lim(j.trigo * (1 + (sorte(j, 'trigo') - 0.5) * 0.05 + (sorte(j, 'trigo2') < 0.03 ? (sorte(j, 'trigo3') - 0.4) * 0.3 : 0)) + (1 - j.trigo) * 0.03, 0.7, 1.6);
  const empregosAntes = ativos(j).reduce((s, c) => s + c.funcionarios, 0);
  j.ocupNoMes = Object.fromEntries(Object.keys(NEGOCIOS).map((t) => [t, ocupacao(j, t)]));
  for (const c of ativos(j)) executarPauta(j, c);
  delete j.ocupNoMes;
  mercadoDeNegocios(j);
  for (const c of ativos(j)) if (c.pauta) c.pauta.comprasDoMes = [];
  const efeitos = acoesExternas(j);
  const neutro = { vendas: 1, tributo: 1, encargos: 1, fixo: 1, cartel: 1 };
  const foto0 = Object.fromEntries(ativos(j).map((c) => [c.id, Object.fromEntries(Object.values(c.ops).map((op) => [op.tipo, apelo(c, op, (efeitos[c.id] || neutro).cartel)]))]));
  const cidadeMes = { vendas: 1, valorizacao: ((cid.renda / (cid.rendaAnterior || cid.renda) - 1) * 0.6) / 12 };
  for (const c of ativos(j)) fecharMes(j, c, efeitos[c.id] || neutro, foto0, cidadeMes);
  cid.bonus.empresas = (cid.bonus.empresas || 0) + (ativos(j).reduce((s, c) => s + c.funcionarios, 0) - empregosAntes) / cid.formais;

  // Eleições em outubro: federal em 2026, 2030...; municipal em 2028, 2032... Posse em janeiro.
  if (mes === 9 && ano % 2 === 0) {
    const nivel = ano % 4 === 2 ? 'federal' : 'municipal', gov = j.politica[nivel];
    const pTroca = 0.3 + (cid.desemprego > 0.1 ? 0.2 : 0) + (ano - gov.desde >= 8 ? 0.2 : 0) + (j.cen.crescimento < 0 ? 0.15 : 0);
    const troca = sorte(j, `eleicao:${nivel}`) < pTroca;
    gov.eleito = troca ? (gov.lado === 'esquerda' ? 'direita' : 'esquerda') : gov.lado;
    registrar(j, `Eleição ${nivel}: vence a ${gov.eleito}${troca ? ', e o governo muda de lado em janeiro' : ', que continua no poder'}.`, 'lei');
    for (const c of ativos(j)) evento(j, c, `Eleição ${nivel}: vence a ${gov.eleito}${troca ? `. A partir de janeiro: ${GOVERNO[nivel][gov.eleito].texto}` : ', nada muda'}.`);
  }
  if (mes === 4) for (const c of ativos(j)) if (temNegocio(c)) evento(j, c, `Dissídio de maio: o salário de mercado está em ${reais(salarioMensal(j))} por mês.`);

  // Virada de ano: a cidade avança um ano, governos tomam posse, o cenário nacional muda.
  if (mes === 11) {
    cid.rendaAnterior = cid.renda;
    aplicarDecisao(cid, prefeitoPorRegras(cid, 'tecnico'));
    avancarAno(cid, j.cen);
    for (const nivel of ['federal', 'municipal']) { const g = j.politica[nivel]; if (g.eleito) { if (g.eleito !== g.lado) { g.lado = g.eleito; g.desde = ano + 1; } delete g.eleito; } }
    j.cen = cenarioDoAno(j.semente, ano + 1);
    j.juros = lim(0.025 + sorte(j, 'juros') * 0.035 + (j.cen.crescimento < 0 ? 0.01 : 0), 0.02, 0.07);
    for (const ev of j.cen.eventos.filter((e) => e.tipo === 'recessao' || e.tipo === 'boom' || e.tipo === 'lei')) { registrar(j, ev.texto, ev.tipo); for (const c of ativos(j)) evento(j, c, ev.texto); }
  }
  for (const c of ativos(j)) sortearEventos(j, c);
  atualizarAnuncios(j);
  j.t++;
  for (const c of j.ceos) c.hist.push(ponto(j, c));
}
export const avancarJogo = avancarMes;
export const retratoDaCidade = (j) => retrato(j.cidade);

// ---------- empresários de regras: linha de base e demonstração sem chave ----------

export function ceoPorRegras(j, c, perfil = 'padeiro') {
  const d = { diario: '', movimentos: [], operacoes: {}, gestao: {}, financas: {}, bolso: {}, respostas: [], acoes_externas: [], proximo_despacho_em_meses: 1 };
  if (perfil === 'inercia') return d;
  const P = { padeiro: { margem: 1, sal: 1, reinveste: 0.5 }, expansionista: { margem: 0.98, sal: 1, reinveste: 0.9 }, diversificador: { margem: 1.02, sal: 1, reinveste: 0.75 } }[perfil] || { margem: 1, sal: 1, reinveste: 0.5 };
  // Respostas de bom senso às pendências.
  for (const p of c.pendencias) {
    const opcao = { pedido_demissao: 'repor', equipamento: c.caixa > 60_000 * (p.n || 1) ? 'trocar' : 'consertar', encomenda: 'aceitar', trabalhista: 'acordo', licitacao: c.compliance >= 0.5 ? 'participar' : 'nao_participar', aluguel: 'negociar' }[p.tipo];
    d.respostas.push({ id: p.id, opcao });
  }
  const mensal = c.receita || 65_000, reserva = mensal * 0.35;
  const livre = Math.max(0, c.caixa - reserva) / 3;                    // gasta o excedente aos poucos
  for (const op of Object.values(c.ops)) {
    const u = op.unidades + op.fora;
    if (!u) continue;
    d.operacoes[op.tipo] = { preco_indice: P.margem, salario_indice: P.sal, investir_em_qualidade: livre * 0.12 * P.reinveste, contratar: Math.max(0, Math.round(u * op.func - op.equipe)) };
  }
  const pesos = { padeiro: { produto: 3, atendimento: 3, operacoes: 2, compras: 2, marketing: 1, contabilidade: 1, manutencao: 1, pessoas: 1, gestao: 1 }, expansionista: { marketing: 3, gestao: 3, vendas: 2, operacoes: 2, financas: 2, tecnologia: 1, pessoas: 1, compras: 1, manutencao: 1, seguranca: 1 }, diversificador: { produto: 2, design: 2, marketing: 2, gestao: 2, tecnologia: 2, atendimento: 1, contabilidade: 1, financas: 1, pessoas: 1, juridico: 1, manutencao: 1 } }[perfil] || {};
  const somaPesos = Object.values(pesos).reduce((s, v) => s + v, 0) || 1;
  d.agenda = Object.entries(pesos).map(([area, peso], i) => ({ dia: 2 + i * 3, area, acao: '', investimento: (livre * 0.4 * P.reinveste * peso) / somaPesos }));
  Object.assign(d.gestao, { seguro: mensal > 80_000, reposicao_de_pessoal: 'automatica' });
  // Divulgação: o jogador de regras só roda os canais em sequência, sem aprender com o resultado.
  { const canais = Object.keys(CANAIS), ops = Object.values(c.ops).filter((o) => o.unidades + o.fora > 0).sort((x, y) => y.receita - x.receita); if (ops[0] && livre > 0 && perfil !== 'inercia') d.apostas = [{ canal: canais[j.t % canais.length], negocio: ops[0].tipo, abordagem: ABORDAGENS[Math.floor(j.t / canais.length) % ABORDAGENS.length], investimento: Math.min(livre * 0.1, ops[0].receita * 0.02) }]; }
  d.financas.pro_labore = Math.round(custoDeVida(j) * 1.15);
  if (c.pessoal.divida > 0 && c.lucrosRetidos > 0 && c.caixa > reserva) d.financas.distribuir_lucros = Math.min(c.pessoal.divida * 1.1, c.caixa - reserva);
  const sobra = livre * 3 * (1 - 0.52 * P.reinveste);
  const folga = capacidadeDeGestao(c) - cargaDeGestao(c);
  const rende = (t) => unidadesDe(c, t) === 0 || lucro12(c.ops[t]) > 0;
  const quer = (t) => !cumpre(c, NEGOCIOS[t]) && folga > NEGOCIOS[t].complexidade && rende(t);
  const abrir = (t) => d.movimentos.push({ acao: 'abrir', negocio: t, quantidade: Math.max(1, Math.min(Math.floor(folga / NEGOCIOS[t].complexidade), Math.floor(sobra / NEGOCIOS[t].capex), 1 + Math.ceil(unidadesDe(c, t) * 0.1))), onde: (c.ops[t]?.unidades || 0) > 18 + 6 * NEGOCIOS[t].S / 150 ? 'fora' : 'campinas' });
  for (const op of Object.values(c.ops)) if (op.unidades + op.fora > 1 && op.lucros12.length === 12 && lucro12(op) < 0 && mesDe(j) === 0) d.movimentos.push({ acao: 'fechar', negocio: op.tipo, quantidade: Math.ceil((op.unidades + op.fora) * 0.15) });
  if (!temNegocio(c)) { if (c.pessoal.caixa > NEGOCIOS.padaria.capex * 1.2) { d.financas.aporte_do_dono = c.pessoal.caixa * 0.9; d.movimentos.push({ acao: 'abrir', negocio: 'padaria', quantidade: 1 }); } return d; }
  if (perfil === 'padeiro') {
    if (sobra > NEGOCIOS.padaria.capex && quer('padaria') && receita12(c) * (1 + 1.2 / Math.max(1, unidadesDe(c, 'padaria'))) < REGRAS.simplesTeto * 0.9) d.movimentos.push({ acao: 'abrir', negocio: 'padaria', quantidade: 1, onde: 'campinas' });
    else if (c.caixa > mensal * 4 && c.lucrosRetidos > 0) { d.financas.distribuir_lucros = (c.caixa - mensal * 3) * 0.5; }
    if (c.pessoal.caixa > custoDeVida(j) * 6) d.bolso.aplicar_renda_fixa = c.pessoal.caixa - custoDeVida(j) * 4;
  } else if (perfil === 'expansionista') {
    if (c.divida < receita12(c) * 0.15 && c.lucro > 0 && mesDe(j) % 6 === 0) d.financas.tomar_emprestimo = limiteDeCredito(c) * 0.6;
    if (!c.franquia && unidadesDe(c, 'padaria') >= 5 && c.marca >= 0.5 && c.caixa > FRANQUIA.lancamento + reserva) d.movimentos.push({ acao: 'lancar_franquia' });
    else if (quer('fabrica') && sobra > NEGOCIOS.fabrica.capex) abrir('fabrica');
    else if (quer('padaria') && sobra > NEGOCIOS.padaria.capex) abrir('padaria');
    if (sorte(j, 'bot') < 0.012 && ativos(j).length > 1) d.acoes_externas.push({ tipo: 'difamacao', alvo: classificacao(j).find((r) => r !== c && !r.quebrou).nome, recursos: mensal * 0.02 });
  } else {
    const fila = ['cafeteria', 'delivery', 'minimercado', 'restaurante', 'distribuidora', 'fabrica', 'marca_nacional'];
    const novo = fila.find((t) => unidadesDe(c, t) === 0 && quer(t) && sobra > NEGOCIOS[t].capex);
    if (novo) abrir(novo);
    else { const melhor = Object.values(c.ops).filter((o) => o.unidades + o.fora > 0 && lucro12(o) > 0).sort((a, b) => lucro12(b) / (b.unidades + b.fora) / NEGOCIOS[b.tipo].capex - lucro12(a) / (a.unidades + a.fora) / NEGOCIOS[a.tipo].capex)[0]; if (melhor && quer(melhor.tipo) && sobra > NEGOCIOS[melhor.tipo].capex) abrir(melhor.tipo); else if (c.caixa > mensal * 5 && c.lucrosRetidos > 0) d.financas.distribuir_lucros = (c.caixa - mensal * 4) * 0.4; }
    if (c.divida > 0 && c.caixa > c.divida * 2) d.financas.amortizar_divida = c.divida;
    if (c.pessoal.caixa > custoDeVida(j) * 6) { const v = c.pessoal.caixa - custoDeVida(j) * 4; d.bolso.aplicar_bolsa = v * 0.5; d.bolso.comprar_imoveis = v * 0.5; }
  }
  return d;
}
