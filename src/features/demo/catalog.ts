// What a multimarcas used-car store in João Pessoa sells, for the demo store's data. Prices are the asking
// price of the oldest and newest year in `years`, in reais.
export type CatalogModel = {
  brand: string;
  model: string;
  version: string;
  bodyType: string;
  fuel: string;
  transmission: string;
  engine: string;
  power: string;
  doors: number;
  years: [number, number];
  prices: [number, number];
  features: string[];
};

const BASIC = ["Ar condicionado", "Direção elétrica", "Vidros elétricos", "Travas elétricas"];
const MEDIUM = [...BASIC, "Central multimídia", "Apple CarPlay / Android Auto", "Câmera de ré", "Rodas de liga leve"];
const FULL = [...MEDIUM, "Piloto automático", "Sensor de estacionamento", "Banco de couro", "Keyless Entry / Start"];

export const MODELS: CatalogModel[] = [
  { brand: "Chevrolet", model: "Onix", version: "LT 1.0 Turbo", bodyType: "Hatch", fuel: "Flex", transmission: "Automático", engine: "1.0 Turbo", power: "116 cv", doors: 4, years: [2020, 2024], prices: [62000, 88000], features: MEDIUM },
  { brand: "Chevrolet", model: "Onix Plus", version: "Premier 1.0 Turbo", bodyType: "Sedã", fuel: "Flex", transmission: "Automático", engine: "1.0 Turbo", power: "116 cv", doors: 4, years: [2020, 2024], prices: [70000, 98000], features: FULL },
  { brand: "Chevrolet", model: "Tracker", version: "LT 1.0 Turbo", bodyType: "SUV", fuel: "Flex", transmission: "Automático", engine: "1.0 Turbo", power: "116 cv", doors: 4, years: [2021, 2024], prices: [95000, 125000], features: FULL },
  { brand: "Hyundai", model: "HB20", version: "Comfort 1.0", bodyType: "Hatch", fuel: "Flex", transmission: "Manual", engine: "1.0", power: "80 cv", doors: 4, years: [2019, 2024], prices: [52000, 76000], features: MEDIUM },
  { brand: "Hyundai", model: "HB20S", version: "Platinum 1.0 Turbo", bodyType: "Sedã", fuel: "Flex", transmission: "Automático", engine: "1.0 Turbo", power: "120 cv", doors: 4, years: [2021, 2024], prices: [78000, 102000], features: FULL },
  { brand: "Hyundai", model: "Creta", version: "Action 1.6", bodyType: "SUV", fuel: "Flex", transmission: "Automático", engine: "1.6", power: "130 cv", doors: 4, years: [2020, 2023], prices: [85000, 108000], features: MEDIUM },
  { brand: "Fiat", model: "Strada", version: "Volcano 1.3 Cabine Dupla", bodyType: "Picape", fuel: "Flex", transmission: "Automático CVT", engine: "1.3", power: "107 cv", doors: 4, years: [2021, 2024], prices: [88000, 118000], features: FULL },
  { brand: "Fiat", model: "Argo", version: "Drive 1.0", bodyType: "Hatch", fuel: "Flex", transmission: "Manual", engine: "1.0", power: "75 cv", doors: 4, years: [2019, 2023], prices: [52000, 72000], features: MEDIUM },
  { brand: "Fiat", model: "Mobi", version: "Like 1.0", bodyType: "Hatch", fuel: "Flex", transmission: "Manual", engine: "1.0", power: "75 cv", doors: 4, years: [2018, 2023], prices: [37000, 56000], features: BASIC },
  { brand: "Fiat", model: "Toro", version: "Volcano 2.0 Diesel 4x4", bodyType: "Picape", fuel: "Diesel", transmission: "Automático", engine: "2.0 Turbo Diesel", power: "170 cv", doors: 4, years: [2019, 2022], prices: [118000, 150000], features: FULL },
  { brand: "Volkswagen", model: "Polo", version: "Highline 200 TSI", bodyType: "Hatch", fuel: "Flex", transmission: "Automático", engine: "1.0 TSI", power: "128 cv", doors: 4, years: [2019, 2023], prices: [72000, 98000], features: FULL },
  { brand: "Volkswagen", model: "T-Cross", version: "Comfortline 200 TSI", bodyType: "SUV", fuel: "Flex", transmission: "Automático", engine: "1.0 TSI", power: "128 cv", doors: 4, years: [2020, 2024], prices: [95000, 128000], features: FULL },
  { brand: "Volkswagen", model: "Gol", version: "1.0", bodyType: "Hatch", fuel: "Flex", transmission: "Manual", engine: "1.0", power: "84 cv", doors: 4, years: [2017, 2022], prices: [38000, 58000], features: BASIC },
  { brand: "Jeep", model: "Renegade", version: "Longitude 1.3 Turbo", bodyType: "SUV", fuel: "Flex", transmission: "Automático", engine: "1.3 Turbo", power: "185 cv", doors: 4, years: [2019, 2023], prices: [82000, 112000], features: FULL },
  { brand: "Jeep", model: "Compass", version: "Longitude 1.3 Turbo", bodyType: "SUV", fuel: "Flex", transmission: "Automático", engine: "1.3 Turbo", power: "185 cv", doors: 4, years: [2020, 2023], prices: [115000, 148000], features: FULL },
  { brand: "Toyota", model: "Hilux", version: "SRV 2.8 Diesel 4x4", bodyType: "Picape", fuel: "Diesel", transmission: "Automático", engine: "2.8 Turbo Diesel", power: "177 cv", doors: 4, years: [2016, 2018], prices: [135000, 150000], features: FULL },
  { brand: "Toyota", model: "Corolla", version: "XEi 2.0", bodyType: "Sedã", fuel: "Flex", transmission: "Automático CVT", engine: "2.0", power: "177 cv", doors: 4, years: [2018, 2022], prices: [92000, 128000], features: FULL },
  { brand: "Honda", model: "HR-V", version: "EX 1.8", bodyType: "SUV", fuel: "Flex", transmission: "Automático CVT", engine: "1.8", power: "140 cv", doors: 4, years: [2017, 2021], prices: [82000, 112000], features: FULL },
  { brand: "Renault", model: "Kwid", version: "Zen 1.0", bodyType: "Hatch", fuel: "Flex", transmission: "Manual", engine: "1.0", power: "71 cv", doors: 4, years: [2019, 2023], prices: [37000, 50000], features: BASIC },
  { brand: "Nissan", model: "Kicks", version: "SV 1.6", bodyType: "SUV", fuel: "Flex", transmission: "Automático CVT", engine: "1.6", power: "114 cv", doors: 4, years: [2018, 2022], prices: [78000, 102000], features: MEDIUM },
];

export const COLORS = ["Branco", "Prata", "Preto", "Cinza", "Vermelho", "Azul"];

export const FIRST_NAMES = [
  "Ana", "Bruna", "Camila", "Daniela", "Eduarda", "Fernanda", "Gabriela", "Helena", "Isabela", "Juliana",
  "Larissa", "Mariana", "Natália", "Patrícia", "Raquel", "Sabrina", "Tatiane", "Vanessa", "André", "Carlos",
  "Diego", "Eduardo", "Felipe", "Gustavo", "Henrique", "Igor", "João", "Lucas", "Marcelo", "Paulo",
  "Rafael", "Rodrigo", "Thiago", "Vinícius", "Wesley",
];

export const LAST_NAMES = [
  "Almeida", "Andrade", "Araújo", "Barbosa", "Batista", "Cavalcanti", "Costa", "Diniz", "Fernandes", "Ferreira",
  "Freitas", "Gomes", "Lima", "Lins", "Lopes", "Macedo", "Medeiros", "Melo", "Monteiro", "Nascimento",
  "Nóbrega", "Oliveira", "Pereira", "Queiroz", "Ribeiro", "Rocha", "Santos", "Silva", "Souza", "Toscano",
  "Vasconcelos", "Vieira",
];

export const BANKS = ["BV", "Santander", "Itaú", "Bradesco", "Pan"];

export const LOST_REASONS = [
  "Comprou em outra loja",
  "Achou o preço alto",
  "Financiamento não aprovado",
  "Não aceitamos a troca pelo valor pedido",
  "Parou de responder",
  "Desistiu de trocar de carro",
];

// [category, description, min, max] of a preparation expense.
export const EXPENSES: [string, string, number, number][] = [
  ["mechanical", "Revisão e troca de óleo", 350, 1800],
  ["detailing", "Higienização e polimento", 250, 600],
  ["tires", "Dois pneus novos", 700, 1400],
  ["body_paint", "Pintura do para-choque", 600, 1500],
  ["documents", "Vistoria e laudo cautelar", 200, 450],
  ["transport", "Guincho da compra", 150, 400],
];
