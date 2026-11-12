# Landing do AutoHub: direção, decisões e estado

Atualizado em 2026-11-12. Escrito pelo Cauê (com o Claude) para o sócio e para quem chegar depois.
Este documento diz **o que decidimos e por quê**. Detalhes de execução estão em
[`plano-implementacao.md`](plano-implementacao.md) e a especificação da logo em
[`../marca/autohub/README.md`](../marca/autohub/README.md).

## Em 30 segundos

- **Produto:** site da loja e gestão para revendas independentes de seminovos (João Pessoa, Cabedelo e Campina Grande).
  O contexto do produto e a pesquisa de mercado estão no documento de contexto de 2026-11-10 (do sócio).
- **Nome da marca: AutoHub.** Antes era "Giro", provisório. Definido pelo Cauê em 2026-11-12.
- **Logo: opção 04, "O aberto"** (o "o" de AutoHub é um anel com um vão). Arquivos em `docs/marca/autohub/`.
- **Landing:** direção visual **"Noite"** (preto, branco e cinza; vermelho só no que está parado; sem fotos), site
  **estático**, sem backend. **Está no ar:** https://autohub-site.pedidos-jp.workers.dev (Cloudflare Workers).
  Sai com `noindex` e com **valores genéricos de propósito** (WhatsApp de teste, preços a confirmar).
- **O código da landing ainda não está neste repositório.** Mora no workspace do Cauê (`landing/site/`). Onde ele vai
  morar é uma decisão em aberto (ver "Em aberto").

## A direção que seguimos

O que o Cauê pediu, nas palavras dele:

- "Moderno e ao mesmo tempo minimalista."
- Sem "cara de vibe coding e muita informação".
- "Enxuto, mas que tenha as informações mais importantes, principalmente pra conversão e pro que vai agregar na vida do
  nosso cliente."

Como isso virou regra:

1. **Identidade "Noite".** Fundo `#0B0C0E`, texto `#F4F5F6`, cinza de apoio `#9BA1A8`, filetes `#26292D`, faixa `#131518`.
   **Vermelho `#D3261C` só para o que está parado** (carro com mais de 90 dias, o fio do topo, a linha antes do
   fechamento). Fonte **Archivo** variável, servida pelo próprio site (nada de Google Fonts).
2. **Sem fotos e sem metáfora.** O produto aparece como ele é: o painel "Loja agora" e o celular de uma loja fictícia
   (**Brisa Seminovos**). Nada de conceito (placa, estúdio, jornal, conversa): as rodadas que tentaram isso foram
   rejeitadas.
3. **Página enxuta, movimento só no topo.** Seções: topo (marca, links, botão) com o painel e o celular; faixa de
   quatro números; Itens de série; Versões (tabela Loja x Loja+); Sem letra miúda; fechamento; rodapé.
4. **Conversão sem backend.** Os botões "Agendar test-drive" e "Falar no WhatsApp" abrem o WhatsApp com mensagem pronta.
   Sem número configurado, caem em `#agendar`.
5. **Não prometer número** ("venda 5x mais") e **nenhum dado real da Cassiano Veículos** em nada que vá para fora.
   Na demo, a loja é a fictícia Brisa Seminovos.
6. **Todo o texto, os números e os preços ficam em um arquivo só** (`src/content/site.ts`). Nenhum componente escreve
   texto próprio. A logo fica em um componente só (`Logo.tsx`).

**`DESIGN.md` na raiz deste repositório é o sistema visual da Cassiano** (caramelo `#B56E35`, Poppins), do protótipo.
**A marca e a landing do AutoHub têm identidade própria** e não herdam essas cores nem essa fonte.

## Decisões (com o porquê)

| Data | Decisão | Por quê |
|---|---|---|
| 2026-11-11 | Método: o Cauê escolhe **referências reais** antes de qualquer construção | Três direções conceituais foram rejeitadas ("achei bem ruim"); o sócio já tinha rejeitado duas rodadas antes |
| 2026-11-11 | Base visual: artefato "Showroom Giro Variações" (branco); personalidade e estrutura do "Giro Estúdio" entram por cima | É o que o Cauê disse gostar: "minimalista e moderno, sem muitas informações e só com o que é necessário" |
| 2026-11-11 | Escolhida a direção **"Noite"** entre duas ("Estúdio claro" e "Noite") | Escolha do Cauê: gostou do vermelho e de abrir com o celular e a tabela |
| 2026-11-11 | **Next 16 + React 19 + TypeScript, CSS Modules, exportação estática** | Mesma base do app; o site é só HTML, CSS e JS prontos |
| 2026-11-11 | Hospedar no **Cloudflare Workers (Static Assets)** agora e numa **VPS simples depois do 5º cliente** | Custo zero agora; migrar é copiar a pasta `out/` e servir com Caddy ou nginx, sem mudar código |
| 2026-11-11 | **Sem backend** na landing; formulário de leads fica para depois | Menos peças para quebrar; o WhatsApp já converte |
| 2026-11-11 | **`noindex` por padrão** (`NEXT_PUBLIC_INDEXAR=sim` liga) | Preços e textos ainda são provisórios |
| 2026-11-12 | Skill de design (Taste Skill) usada **só como conferência** (`copy-lint` e `check.mjs`), nunca para construir | Foi auditada (segura com ressalvas); as regras dela (4 fotos, 8 elementos em movimento) contradizem o combinado |
| 2026-11-12 | **Valores genéricos de propósito**: WhatsApp de teste, preços (R$ 299 e R$ 449; anual R$ 249 e R$ 374; fundadoras R$ 199) e a barra 20/6/3/1 carros | O Cauê quer ver a página no ar antes de fechar os números; os preços vieram de prints pequenos e precisam de conferência |
| 2026-11-12 | **Nome: AutoHub** | Definido pelo Cauê. **O aval do sócio e as checagens (INPI, domínio `.com.br`, @ no Instagram) ainda não estão registrados** |
| 2026-11-12 | **Logo: opção 04, "O aberto"** | Escolhida pelo Cauê entre 6 propostas minimalistas; o anel dá um símbolo próprio e um ícone de app simples |
| 2026-11-12 | **Publicado** em `autohub-site.pedidos-jp.workers.dev` | Primeira versão no ar para o sócio e amigos conferirem; continua `noindex` |

## Como a landing é montada

- **Conteúdo:** `src/content/site.ts` (nome, textos, preços, mensagens do WhatsApp, SEO). Trocar o nome ou um preço é
  mudar só esse arquivo.
- **Marca:** `src/components/Logo.tsx` (SVG em contorno, pinta com a cor do texto) usada no topo e no h1 do hero (com o
  nome para leitor de tela). Favicon em `src/app/icon.svg`; imagem de compartilhamento em `public/og.png`, gerada por
  `npm run gerar-og` a partir do próprio hero.
- **Seções:** um componente por seção em `src/components/` (Topo, Hero, PainelLoja, CelularLoja, Numeros,
  ItensDeSerie, Versoes, SemLetraMiuda, Fechamento, Rodape), cada um com seu CSS Module.
- **WhatsApp:** `NEXT_PUBLIC_WHATSAPP_NUMBER` (só dígitos, com o país). `src/lib/whatsapp.ts` monta o link.
- **Cabeçalhos de segurança:** `public/_headers` (Cloudflare) e `deploy/Caddyfile.exemplo` (VPS), os mesmos.

### Rodar, testar e publicar (no workspace do Cauê, em `landing/site/`)

```
npm run build && npm run preview     # http://localhost:3000
npm run lint && npm run typecheck && npm test
npm run test:e2e                     # Playwright, porta 4173
npm run build && npm run deploy      # publica no Cloudflare (wrangler logado)
```

Como `NEXT_PUBLIC_SITE_URL` precisa ser a URL final, o fluxo de publicação é: build, deploy, ler a URL, **build de novo
com a URL**, deploy de novo, conferir com `curl -I`.

**Estado dos testes em 2026-11-12:** lint e tipos sem erro; 22 testes unitários; e2e 110 ok e 1 ignorado de propósito;
Lighthouse móvel 98 (desempenho), 100 (acessibilidade), 100 (boas práticas) e 66 de SEO (só por causa do `noindex`).

## Histórico das rodadas (o que não repetir)

| Rodada | Quem | Resultado |
|---|---|---|
| 1 | sócio: 5 direções (painel escuro, para-brisa, classificados, conversa, ficha técnica) | só a conversa agradou |
| 2 | sócio: 5 variações da conversa | rejeitada: artesanal |
| 3 | Cauê/Claude: Estúdio, Sinalização (placa da BR-230), Balanço (demonstrativo) | rejeitada: "achei bem ruim" |
| Prancha | 8 sites reais (Fresha, Attio, Ramp, Square, Toast, Shopmonkey, InfinitePay, Mercury) | apoio; o Cauê escolheu o "Showroom Giro Variações" |
| 4 | duas direções sobre o Showroom: Estúdio claro e **Noite** | **Noite** escolhida |
| Código | 4 etapas, aprovadas pelo Cauê nas paradas 1 a 3 | no ar; falta a parada 4 (conferir a URL) |
| Marca | 6 logos minimalistas | **04, "O aberto"** |

Lição do histórico: **mostrar referências reais e deixar o Cauê escolher antes de construir**; direção-conceito com
metáfora foi rejeitada todas as vezes.

## Em aberto

1. **Aval do sócio ao nome AutoHub**, mais INPI, domínio `.com.br` e @ no Instagram.
2. **Onde mora o código da landing:** uma pasta `landing/` neste repositório (com `package.json` próprio e deploy
   independente do app) ou um repositório separado. Sugestão: pasta `landing/` aqui, para o sócio ver e revisar, quando
   o nome e o domínio fecharem. A decidir.
3. **Parada 4 do plano:** o Cauê conferir a URL publicada em 390 e 1440 px.
4. **Valores reais:** número de WhatsApp, preços definitivos (299, 449, 199) e domínio próprio.
5. **Indexação:** `NEXT_PUBLIC_INDEXAR=sim` quando os valores forem reais.
6. **Etapa futura:** formulário de leads (Worker pequeno ou Supabase só com inserção, com proteção contra spam e aviso
   de LGPD), medição de cliques (Plausible ou Umami) e fotos reais de lojas.
