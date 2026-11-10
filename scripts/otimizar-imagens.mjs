/**
 * Otimizador de imagens do site — PADRÃO DE QUALIDADE NATIVO.
 *
 * Toda imagem do site (foto de veículo, equipe, loja, fundador) DEVE passar
 * por aqui antes de entrar em public/. Garante resolução alta e nitidez, pra
 * o site nunca renderizar imagem borrada.
 *
 * Por que existe: o next/image otimiza qualidade e formato no servidor, mas
 * não recupera resolução que o arquivo não tem. Se a foto entrar pequena, ela
 * borra quando exibida grande. Este script garante o teto de resolução certo
 * na ORIGEM (o arquivo em public/), e o next.config cuida da entrega (AVIF q90).
 *
 * ── Uso ──────────────────────────────────────────────────────────────────
 *   # Uma pasta de fotos de um carro (gera foto-01.webp, foto-02.webp, ...):
 *   node scripts/otimizar-imagens.mjs --carro <slug> --fonte "C:/caminho/pasta"
 *
 *   # Uma imagem avulsa (equipe, loja, fundador):
 *   node scripts/otimizar-imagens.mjs --foto "C:/caminho/foto.jpg" --saida public/equipe-hd.webp
 *
 * Padrão de saída: WebP, largura máx 2400px (não amplia além do original),
 * qualidade 88, com sharpen leve. Fotos pequenas (Instagram/IA) são mantidas
 * no tamanho real — o script nunca infla resolução falsa.
 * ──────────────────────────────────────────────────────────────────────────
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const LARGURA_MAX = 2400; // teto de largura (px)
const QUALIDADE = 88; // WebP quality
const SHARPEN = { sigma: 1.0, m1: 0.4, m2: 0.7 }; // realce sutil de bordas

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, "")] = a[i + 1];
  return o;
}

async function otimizar(entrada, saida) {
  await sharp(entrada)
    .rotate() // respeita orientação EXIF
    .resize({ width: LARGURA_MAX, withoutEnlargement: true })
    .sharpen(SHARPEN)
    .webp({ quality: QUALIDADE })
    .toFile(saida);
  const m = await sharp(saida).metadata();
  const kb = Math.round(fs.statSync(saida).size / 1024);
  const aviso = m.width < 1200 ? "  ⚠️ origem baixa (Instagram/IA), teto do arquivo" : "";
  console.log(`  ✓ ${path.basename(saida)}  ${m.width}x${m.height}  ${kb}KB${aviso}`);
}

const o = args();

if (o.carro && o.fonte) {
  // Pasta de fotos de um carro → public/veiculos/<slug>/foto-NN.webp
  const outDir = path.join("public", "veiculos", o.carro);
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs
    .readdirSync(o.fonte)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  console.log(`Otimizando ${files.length} fotos de "${o.carro}":`);
  let n = 1;
  for (const f of files) {
    const saida = path.join(outDir, `foto-${String(n).padStart(2, "0")}.webp`);
    await otimizar(path.join(o.fonte, f), saida);
    n++;
  }
  console.log("Pronto. Ordem = ordem alfabética dos arquivos da pasta.");
} else if (o.foto && o.saida) {
  // Imagem avulsa
  console.log(`Otimizando "${o.foto}":`);
  await otimizar(o.foto, o.saida);
  console.log("Pronto.");
} else {
  console.log(`Uso:
  node scripts/otimizar-imagens.mjs --carro <slug> --fonte "<pasta>"
  node scripts/otimizar-imagens.mjs --foto "<arquivo>" --saida public/<nome>.webp`);
  process.exit(1);
}
