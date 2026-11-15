// Bairros de Campinas e cidades vizinhas onde uma unidade pode abrir.
// Coordenadas aproximadas do centro de cada lugar. renda e aluguel são fatores
// em relação à média da cidade (estimativas, não dados oficiais); gente é o
// tamanho do público, que define quantas unidades cabem antes de dividir clientela.
const b = (nome, lat, lng, renda, aluguel, gente, fora = false) => ({ nome, lat, lng, renda, aluguel, gente, fora });

export const LOCAIS = {
  centro: b('Centro', -22.9056, -47.0608, 1.0, 1.25, 4),
  cambui: b('Cambuí', -22.8953, -47.0528, 1.4, 1.75, 3),
  taquaral: b('Taquaral', -22.8736, -47.0513, 1.0, 1.0, 3),
  guanabara: b('Guanabara', -22.8887, -47.0643, 1.0, 1.0, 3),
  bonfim: b('Bonfim', -22.8962, -47.0787, 1.0, 1.0, 3),
  botafogo: b('Botafogo', -22.9005, -47.0712, 0.95, 0.95, 2),
  nova_campinas: b('Nova Campinas', -22.9008, -47.0405, 1.45, 1.6, 2),
  flamboyant: b('Jardim Flamboyant', -22.8885, -47.0335, 1.25, 1.3, 2),
  chapadao: b('Jardim Chapadão', -22.8845, -47.0855, 1.1, 1.05, 3),
  castelo: b('Castelo', -22.8782, -47.0775, 1.1, 1.05, 2),
  vila_nova: b('Vila Nova', -22.8848, -47.0562, 1.05, 1.1, 2),
  barao_geraldo: b('Barão Geraldo', -22.8253, -47.0812, 1.3, 1.25, 4),
  cidade_universitaria: b('Cidade Universitária', -22.8172, -47.0695, 1.2, 1.15, 2),
  santa_genebra: b('Santa Genebra', -22.8452, -47.0605, 1.15, 1.05, 2),
  mansoes: b('Mansões Santo Antônio', -22.8592, -47.0445, 1.25, 1.2, 3),
  sao_quirino: b('São Quirino', -22.8605, -47.0352, 0.95, 0.9, 2),
  parque_imperador: b('Parque Imperador', -22.8505, -47.0305, 1.15, 1.05, 2),
  alphaville: b('Alphaville Campinas', -22.8375, -47.0305, 1.5, 1.5, 2),
  sousas: b('Sousas', -22.8785, -46.9655, 1.2, 1.0, 2),
  proenca: b('Jardim Proença', -22.9182, -47.0502, 1.05, 1.0, 3),
  ponte_preta: b('Ponte Preta', -22.9162, -47.0572, 0.9, 0.85, 2),
  vila_industrial: b('Vila Industrial', -22.9122, -47.0792, 0.85, 0.8, 3),
  sao_bernardo: b('São Bernardo', -22.9272, -47.0702, 0.85, 0.8, 3),
  swift: b('Swift', -22.9302, -47.0502, 1.0, 0.95, 2),
  nova_europa: b('Jardim Nova Europa', -22.9332, -47.0382, 0.9, 0.85, 3),
  parque_prado: b('Parque Prado', -22.9432, -47.0582, 1.15, 1.05, 3),
  jardim_do_lago: b('Jardim do Lago', -22.9402, -47.0752, 0.8, 0.75, 3),
  aurelia: b('Jardim Aurélia', -22.8962, -47.0892, 0.9, 0.85, 2),
  eulina: b('Jardim Eulina', -22.8882, -47.0982, 0.85, 0.8, 3),
  vila_teixeira: b('Vila Teixeira', -22.9052, -47.0952, 0.85, 0.8, 2),
  garcia: b('Jardim Garcia', -22.9202, -47.1002, 0.8, 0.75, 3),
  campos_eliseos: b('Campos Elíseos', -22.9352, -47.1052, 0.75, 0.7, 4),
  nova_aparecida: b('Nova Aparecida', -22.8572, -47.1302, 0.7, 0.65, 3),
  ouro_verde: b('Ouro Verde', -22.9802, -47.1302, 0.65, 0.6, 5),
  campo_grande: b('Campo Grande', -22.9502, -47.1702, 0.65, 0.6, 5),
  dic: b('DICs', -22.9652, -47.1102, 0.7, 0.62, 4),
  // Fora de Campinas: cidades da região e além. Público grande, mais gestão.
  valinhos: b('Valinhos', -22.9706, -46.9958, 1.15, 0.95, 10, true),
  vinhedo: b('Vinhedo', -23.0298, -46.9753, 1.25, 1.0, 7, true),
  paulinia: b('Paulínia', -22.7612, -47.1542, 1.2, 0.95, 9, true),
  sumare: b('Sumaré', -22.8219, -47.2669, 0.8, 0.7, 20, true),
  hortolandia: b('Hortolândia', -22.8585, -47.2200, 0.8, 0.7, 18, true),
  indaiatuba: b('Indaiatuba', -23.0903, -47.2181, 1.1, 0.9, 20, true),
  americana: b('Americana', -22.7392, -47.3314, 1.0, 0.85, 20, true),
  jundiai: b('Jundiaí', -23.1857, -46.8978, 1.15, 1.0, 35, true),
  piracicaba: b('Piracicaba', -22.7253, -47.6492, 1.0, 0.85, 35, true),
  sorocaba: b('Sorocaba', -23.5015, -47.4526, 1.0, 0.9, 60, true),
  ribeirao_preto: b('Ribeirão Preto', -21.1775, -47.8103, 1.1, 0.95, 60, true),
  sao_paulo: b('São Paulo', -23.5505, -46.6333, 1.3, 1.7, 900, true),
  rio_de_janeiro: b('Rio de Janeiro', -22.9068, -43.1729, 1.15, 1.5, 500, true),
  belo_horizonte: b('Belo Horizonte', -19.9167, -43.9345, 1.05, 1.1, 220, true),
  curitiba: b('Curitiba', -25.4284, -49.2733, 1.15, 1.1, 170, true),
  brasilia: b('Brasília', -15.7939, -47.8828, 1.35, 1.3, 250, true),
};
export const CENTRO_DO_MAPA = { lat: -22.9, lng: -47.07, zoom: 12 };
// Os três começam em bairros de classe média com os mesmos números.
export const PONTO_INICIAL = { anthropic: 'taquaral', xai: 'guanabara', gemini: 'bonfim' };
