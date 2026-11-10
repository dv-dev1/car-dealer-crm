// Listas de opções do cadastro de veículo (form "Adicionar carro").
// Centralizadas aqui pra o form e, no futuro, os filtros beberem da mesma fonte.

export const CATEGORIAS = [
  "SUV", "Sedã", "Hatch", "Picape", "Coupé", "Minivan", "Utilitário",
] as const;

export const CAMBIOS = [
  "Manual", "Automático", "Automático CVT", "Automatizado",
] as const;

export const COMBUSTIVEIS = [
  "Flex", "Gasolina", "Diesel", "Elétrico", "Híbrido", "GNV",
] as const;

export const CORES = [
  "Branco", "Preto", "Prata", "Cinza", "Grafite",
  "Vermelho", "Azul", "Verde", "Marrom", "Bege", "Dourado",
] as const;

export const PORTAS = ["2", "3", "4", "5"] as const;

// Opcionais marcáveis — mesma lista da referência, ordem por relevância.
export const OPCIONAIS = [
  "Ar condicionado", "Ar digital", "Direção elétrica", "Direção hidráulica",
  "Vidros elétricos", "Travas elétricas", "Retrovisores elétricos",
  "Câmera de ré", "Sensor de estacionamento", "Sensor de chuva",
  "Central multimídia", "Bluetooth", "GPS / Navegador", "Banco de couro",
  "Bancos aquecidos", "Teto solar", "Teto panorâmico", "Rodas de liga leve",
  "Airbag duplo", "Airbag lateral", "ABS", "Controle de tração",
  "Controle de estabilidade", "Piloto automático", "Freio a disco nas 4 rodas",
  "Volante multifuncional", "Keyless Entry / Start", "Computador de bordo",
  "Start/Stop automático", "Carregador wireless", "Apple CarPlay / Android Auto",
  "Kit multimídia original", "4x4 / AWD / Tração integral", "Blindagem",
] as const;
