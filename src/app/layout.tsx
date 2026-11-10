import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { loja } from "@/lib/loja";
import { WhatsappProvider } from "@/components/whatsapp/WhatsappProvider";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${loja.nome} — Seminovos premium com procedência`,
    template: `%s · ${loja.nome}`,
  },
  description: loja.descricao,
  openGraph: {
    title: `${loja.nome} — Seminovos premium com procedência`,
    description: loja.descricao,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: o tema da gestão é escrito em <html data-tema>
    // por um script inline ANTES do React (anti-flash), então o cliente sempre
    // difere do HTML do servidor nesse atributo. É a única diferença esperada;
    // o aviso aqui seria ruído permanente no console.
    <html
      lang="pt-BR"
      className={`${poppins.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <WhatsappProvider>{children}</WhatsappProvider>
      </body>
    </html>
  );
}
