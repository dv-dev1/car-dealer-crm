# Design

Sistema visual da Cassiano Veículos. Composição e ritmo seguem a referência
bellonimotors.com; cores, tipografia e voz são da Cassiano.

## Theme

Claro, quente-neutro premium. Superfície cinza areia clara (#F5F3EE) que deixa
o marrom caramelo saltar; seções de contraste em grafite quase-preto (fundador,
showroom, contato) pra dar peso e drama, como na referência. Estratégia de cor:
**Committed** — o marrom caramelo é a voz da marca, aplicado com intenção em
CTAs, destaques, ícones e números; o grafite ancora títulos e as seções
escuras. Neutros carregam o respiro; o carro (foto real) carrega o visual.

## Color

Tokens (do design-guide da marca — não inventar cor fora desta paleta):

- `--primary` **#B56E35** — Marrom Caramelo Premium. CTAs, destaques, ícones,
  números/estatísticas, palavra em destaque no headline, hover states.
- `--secondary` **#2F3136** — Grafite Escuro. Títulos, texto importante, fundo
  das seções de contraste (fundador, showroom, contato, footer).
- `--background` **#F5F3EE** — Cinza Areia claro. Fundo do site.
- `--sand` **#E7E4DD** — Cinza Areia. Superfícies alternativas, divisórias suaves.
- `--surface` **#FFFFFF** — Branco. Cards, áreas de respiro, contraste.
- `--text` **#222222** — Texto de corpo sobre fundo claro.
- `--muted` **#7C7C7C** — Cinza médio. Metadados (ano · km), labels — nunca
  corpo de texto longo sobre fundo tingido.
- `--line` **#D8D8D8** — Cinza claro. Bordas, separadores.

Proibido: vermelho de liquidação, gradiente roxo, qualquer cor fora da paleta.
Nas seções escuras (grafite), texto branco/areia; o marrom caramelo continua
sendo o destaque. Contraste AA obrigatório no corpo.

## Typography

- **Família única: Poppins** (400/500/600/700). Fixada pela identidade da marca
  — identity-preservation vence a reflex-reject list. A personalidade vem do
  contraste de peso, não de um segundo tipo.
- Títulos/display: Poppins 600–700, `clamp()` fluido, `text-wrap: balance`,
  letter-spacing ligeiramente negativo em tamanhos grandes (≥ -0.02em, nunca
  além de -0.04em). Teto de display ~ 4.5rem.
- Corpo: Poppins 400, medida 65–75ch, `text-wrap: pretty`.
- Labels/eyebrows: Poppins 500–600, caixa alta com tracking — usar com
  parcimônia (a referência usa "ESTOQUE ATUAL", "POR QUE"; replicar sem
  transformar em grammar de toda seção).
- A logo tem tipografia própria (futurista automotiva) e vive só no PNG.

## Spacing & Layout

- Border-radius **12px** em cards, botões e containers (fixado pela identidade).
- Sombra suave de assinatura: `0 4px 20px rgba(0,0,0,.06)`.
- Grid de veículos: `repeat(auto-fit, minmax(260px, 1fr))`, 4 colunas no desktop.
- Ritmo por `clamp()`; seções escuras full-bleed pra contraste (fundador,
  showroom). Header sticky que encolhe e ganha fundo ao rolar.
- Container central ~1200–1280px.

## Components

- **Card de veículo:** foto (zoom suave no hover) + nome + ano · km + preço +
  "Ver detalhes". Radius 12px, sombra suave, borda hover marrom.
- **Botão primário:** fundo marrom caramelo, texto claro, levanta no hover
  (`translateY` + sombra). **Botão WhatsApp:** verde (convenção universal do
  WhatsApp — mantido mesmo fora da paleta da marca), com ícone.
- **Selos de confiança:** linha/marquee com ícones outline (procedência,
  documentação, financiamento, troca, test drive).
- **Barra de specs (detalhe):** grid 2×3 de tiles com ícone outline + label +
  valor. **Ficha técnica:** tabela zebrada de 2 colunas.
- Ícones: outline, minimalistas, monocromáticos, um único set (lucide).

## Motion

Padrão capturado ao vivo da referência (replicar fielmente):

- **Easing de assinatura:** `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-expo) em
  praticamente tudo. Sem bounce, sem elastic.
- **Scroll reveal:** `opacity` + `translateY` em ~0.6–0.9s, com stagger por
  seção (delays d1/d2/d3). O conteúdo é visível por padrão; o reveal realça,
  não esconde (sem gate de visibilidade em classe).
- **Header:** transição de background/padding em 0.4s ao rolar.
- **Botões:** `transform` + `box-shadow` em ~0.3s no hover.
- **Card de veículo:** imagem com zoom (`transform`) em ~0.7s no hover.
- **Showroom:** crossfade de slides (`opacity` 0.9s).
- `prefers-reduced-motion`: reveals viram crossfade/instantâneo; movimento
  removido, opacidade e cor mantidas ("gentler, not zero").
- Biblioteca: framer-motion (já instalada) para orquestração; CSS para hovers.

## Imagery

Site image-led: o carro e o showroom carregam o visual. Fotos reais sempre —
nunca bloco de cor no lugar de foto. Placeholders na construção usam Unsplash
verificado (SUVs/sedãs premium, showroom com piso claro, paleta neutra —
branco/preto/cinza/prata pra o marrom saltar). O usuário troca pelo estoque
real depois. Alt text descritivo faz parte da voz.
