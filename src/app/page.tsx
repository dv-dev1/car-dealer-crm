import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsappFab } from "@/components/WhatsappFab";
import { Hero } from "@/components/home/Hero";
import { SelosBar } from "@/components/home/SelosBar";
import { Fundador } from "@/components/home/Fundador";
import { Destaques } from "@/components/home/Destaques";
import { Diferenciais } from "@/components/home/Diferenciais";
import { Garantia } from "@/components/home/Garantia";
import { Equipe } from "@/components/home/Equipe";
import { Contato } from "@/components/home/Contato";
import { getDestaques, contarVeiculos } from "@/lib/veiculos";

/**
 * Ordem da home pela escada de decisão de compra:
 * Hero (atenção + promessa) → Selos (remove medo) → Estoque (o que ele veio
 * ver, o coração da conversão) → Fundador (quem está por trás, cara da marca e
 * presença nas redes — confiança depois de ver o produto) → Diferenciais (por
 * que aqui) → Garantia 90 dias (remove o maior medo de seminovo) → Equipe (prova
 * de estrutura + voz do dono, confiança) → Contato (a ação: WhatsApp).
 * Sem showroom decorativo — foco em ver carro e chamar no WhatsApp.
 */
export default async function HomePage() {
  const [destaques, total] = await Promise.all([
    getDestaques(),
    contarVeiculos(),
  ]);

  return (
    <>
      <Header />
      <main>
        <Hero />
        <SelosBar />
        <Destaques veiculos={destaques} total={total} />
        <Fundador />
        <Diferenciais />
        <Garantia />
        <Equipe />
        <Contato />
      </main>
      <Footer />
      <WhatsappFab />
    </>
  );
}
