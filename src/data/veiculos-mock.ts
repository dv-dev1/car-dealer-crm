import { MODELS } from "@/features/demo/catalog";
import type { Veiculo } from "@/types/veiculo";

// Estoque do site público até a etapa 5, quando ele passa a ler o banco: carros fictícios da
// Maré Veículos tirados do catálogo da demo, sem foto (o site mostra "Sem foto").

const ESCOLHIDOS = ["Onix Plus", "Tracker", "HB20", "Creta", "Strada", "Polo", "Compass", "Corolla"];
const CORES = ["Branco", "Prata", "Preto", "Cinza"];

const slug = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const veiculosMock: Veiculo[] = ESCOLHIDOS.map((nome, i) => {
  const m = MODELS.find((model) => model.model === nome)!;
  const ano = m.years[1];
  const km = 12000 + i * 9000;
  const titulo = `${m.brand} ${m.model} ${m.version}`;
  return {
    id: String(i + 1),
    slug: slug(titulo),
    marca: m.brand,
    modelo: m.model,
    titulo,
    ano,
    km,
    preco: m.prices[1] - 10,
    cambio: m.transmission,
    combustivel: m.fuel,
    cor: CORES[i % CORES.length],
    portas: m.doors,
    carroceria: m.bodyType,
    potencia: m.power,
    motor: m.engine,
    descricao: `${m.model} ${m.version} ${ano}, ${km.toLocaleString("pt-BR")} km. Revisado, com garantia de 90 dias e documentação conferida pela loja.`,
    fotos: [],
    equipamentos: m.features,
    fichaTecnica: { Motor: m.engine, Câmbio: m.transmission, "Tipo de carroceria": m.bodyType, Potência: m.power },
    status: i === 3 ? "reservado" : "disponivel",
    destaque: i < 4,
  };
});
