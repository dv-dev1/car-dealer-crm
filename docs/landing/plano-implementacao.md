# Plano de implementação: landing do AutoHub (nome provisório na época: Giro; Next + React, direção "Noite")

> **Nota (2026-11-12):** cópia do plano que mora no workspace do Cauê. Os caminhos `landing/site/...` apontam para o
> código da landing, que **ainda não está neste repositório**. A marca mudou de "Giro" para **AutoHub** no meio da
> etapa 4 (ver a seção "Mudança no meio do caminho: marca AutoHub"). A visão geral está em [`README.md`](README.md).

Criado em 2026-11-11. Spec: decisões da conversa de 2026-11-11 (Cauê), registradas em `current-state.md`.
Fonte visual: `landing/direcoes-visuais/index.html` (direção 2, "Noite"). Este plano não tem código; o código é escrito
uma vez, na implementação.

## Decisões já fechadas

- **Direção:** a "Noite" é a base. Preto, branco e cinza; vermelho só no que está parado (faixa "mais de 90 dias",
  fio de luz do hero, linha curta antes do fechamento). Sem fotos, sem metáfora. A direção 1 ("Estúdio claro") não entra.
- **Stack:** Next 16, React 19, TypeScript, Tailwind 4 (a mesma do `car-dealer-crm`). Projeto novo em `landing/site/`.
- **Hospedagem agora: Cloudflare Workers** (Workers Static Assets). **Depois do 5º cliente: uma VPS simples.**
- **Backend: nenhum agora.** Os botões abrem o WhatsApp com mensagem pronta.
- **Movimento só no topo** (entrada do hero, brilho no painel, barra crescendo, fio vermelho). Fora isso, só o hover.
- **Destino de cada botão** (revisão de 2026-11-11): todo "Agendar test-drive" (topo, hero e fechamento) abre o
  WhatsApp com a mensagem de agendar; todo "Falar no WhatsApp" abre com a mensagem de conhecer. Só os links de texto do
  topo ("Itens de série", "Versões") rolam até a seção. Os links do WhatsApp abrem em nova aba.
- **Fonte:** Archivo (variável, com eixo de largura), hospedada junto do site, sem chamada ao Google.

## Arquitetura (e por que mudou em relação à primeira sugestão)

Na primeira sugestão eu disse para não usar exportação estática, pensando em servidor próprio. Com o Cloudflare Workers
o desenho certo é o contrário:

- **Exportação estática (`output: 'export'`)** gera a pasta `out/`, servida pelo Workers Static Assets. Evita o adaptador
  OpenNext, que deixa o Next mais pesado e com compatibilidades a vigiar. É o caminho mais simples, mais rápido e mais
  barato, e a página é toda estática de qualquer forma.
- **Migrar para a VPS depois é trivial:** `out/` é HTML, CSS, JS e fonte; um nginx ou Caddy serve a pasta. Nada de
  código muda. Por isso o projeto não usa nenhum recurso que exija servidor Node (nada de Route Handler, middleware,
  `next/image` com otimização, ISR).
- **Quando entrar o formulário de leads (etapa futura):** ele vira um serviço à parte (um Worker pequeno, ou o Supabase
  com política de só-inserção), sem mexer na landing. Na VPS, o mesmo serviço roda como processo próprio.
- **Configuração por variável de ambiente pública, definida no build:** número do WhatsApp, URL do site. Não é segredo.

## Resposta do Cauê às pendências (2026-11-12)

- **Domínio:** nenhum domínio registrado agora. O site sai no endereço do próprio Cloudflare Workers (`*.workers.dev`);
  `NEXT_PUBLIC_SITE_URL` recebe esse endereço depois do primeiro deploy. Domínio próprio fica para depois.
- **Preços e textos dos prints:** ficam como estão (valores genéricos); a definição real vem depois, só em `site.ts`.
- **WhatsApp:** fica o número genérico de teste por enquanto.
- Com isso, nenhuma pendência trava a etapa 4.

## Pendências do Cauê (texto original; ver a resposta acima)

1. Número do WhatsApp para os dois botões (hoje, o `.env.example` guarda um valor de teste). Se existir endereço de
   agenda (Calendly, Cal.com), dizer qual.
2. Domínio que vai apontar para o Worker (para metadata, sitemap e imagem de compartilhamento).
3. Confirmar os textos que eu li de prints pequenos: preços anuais R$ 249 e R$ 374, a nota das lojas fundadoras
   (R$ 199 por mês, 12 meses, uma conversa a cada 15 dias, um depoimento e uma indicação) e os 20/6/3/1 carros da barra.
4. Nome do produto (o "Giro" é provisório). O nome fica em um só lugar, no arquivo de conteúdo.

## Estrutura de pastas (alvo)

```
landing/site/
  package.json  next.config.ts  tsconfig.json  postcss.config.mjs  eslint.config.mjs
  wrangler.jsonc  .env.example  .gitignore  README.md
  src/
    app/        layout.tsx  page.tsx  globals.css  icon.svg  robots.ts  sitemap.ts
    content/    site.ts          (todo o texto, os números e os preços, tipados)
    lib/        whatsapp.ts
    components/ Botao  Topo  Hero  PainelLoja  CelularLoja  IconeCarro
                Numeros  ItensDeSerie  Versoes  SemLetraMiuda  Fechamento  Rodape
  tests/        unit (Vitest)  e2e (Playwright com o Chrome instalado)
```

## Etapa 1: base do projeto

Objetivo: um projeto que compila, exporta, testa e passa no `wrangler deploy --dry-run`, com os tokens da Noite e a
fonte carregando, antes de qualquer seção.

### Tarefa 1.1: criar o projeto
- **Decisões em aberto:** gerenciador de pacotes (usar npm, igual ao CRM); versão do Node (a máquina tem 24; fixar em
  `engines` e em `.nvmrc`).
- **Arquivos:** `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `.nvmrc`.
- **Interfaces:** scripts `dev`, `build` (gera `out/`), `lint`, `typecheck`, `test`, `test:e2e`, `deploy`
  (`wrangler deploy`), `preview` (servir `out/` localmente).
- **Configuração obrigatória do Next:** `output: 'export'`, `images.unoptimized: true`, `trailingSlash: true`.
- **Testes:** `npm run build` termina sem erro e cria `out/index.html`.
- **Pronto quando:** `npm run dev` abre uma página em branco em `localhost` e `npm run build` gera `out/`.

### Tarefa 1.2: tokens, fonte e layout raiz
- **Decisões em aberto:** como carregar a Archivo com o eixo de largura sem rede no build. Sugestão: o pacote
  `@fontsource-variable/archivo` (arquivo de largura variável), importado no CSS global; a alternativa é `next/font/local`
  com o arquivo baixado uma vez. Esta máquina tem certificado interceptado, e por isso evitamos o `next/font/google`.
- **Arquivos:** `src/app/globals.css`, `src/app/layout.tsx`.
- **Interfaces:** variáveis CSS da Noite (`--bg`, `--fg`, `--mudo`, `--fio`, `--faixa`, `--vermelho`, as três cores das
  faixas de idade, `--suave`, `--largura`), declaradas no `:root`; `.wrap` com a margem lateral mínima de 16px e
  `safe-area`; `prefers-reduced-motion` desliga todas as animações. `layout.tsx` define `lang="pt-BR"`, a fonte e o
  fundo preto do `body`.
- **Testes:** o `out/index.html` tem `lang="pt-BR"`; a fonte aparece como arquivo próprio em `out/` e nenhuma
  requisição vai para `fonts.googleapis.com`.
- **Pronto quando:** uma página de teste mostra "GIRO" em Archivo largo e pesado, no fundo `#0B0C0E`.

### Tarefa 1.3: arquivo de conteúdo e utilitário do WhatsApp
- **Decisões em aberto:** formato da mensagem pré-preenchida dos dois botões (sugestão: "Oi! Quero agendar um test-drive
  do Giro." e "Oi! Quero conhecer o Giro.").
- **Arquivos:** `src/content/site.ts`, `src/lib/whatsapp.ts`, `.env.example`.
- **Interfaces:**
  - `site.ts` exporta o objeto `site` com: `nome`, `tagline`, `apoio`, `nav[]`, `acoes{agendar, whatsapp}`,
    `painel{titulo, nota, metricas[{rotulo, valor}], idade[{n, rotulo, tom}]}`, `numeros[{valor, rotulo}]`,
    `itens[{titulo, texto}]`, `versoes{colunas, linhas[{rotulo, loja, lojaPlus}], preco, nota}`, `semLetraMiuda[]`,
    `fechamento{titulo, texto}`, `rodape`. Os tipos ficam em `src/content/tipos.ts`.
  - `whatsapp.ts` exporta `linkWhatsapp(mensagem: string): string`, que lê `NEXT_PUBLIC_WHATSAPP_NUMBER`, deixa só
    dígitos, codifica a mensagem e devolve `https://wa.me/<numero>?text=<mensagem>`. Sem número válido devolve `#agendar`
    e a página não quebra.
- **Testes (Vitest):** número com símbolos vira só dígitos; mensagem com acento e espaço é codificada; número ausente
  devolve `#agendar`; a soma de `idade[].n` é igual ao total de carros do painel; todo `rotulo` e `titulo` é não vazio.
- **Pronto quando:** `npm test` passa e nenhum texto da landing está escrito dentro de um componente.

### Tarefa 1.4: lint, testes e Playwright
- **Decisões em aberto:** Playwright com o Chrome já instalado (`channel: 'chrome'`), sem baixar navegador, por causa do
  certificado interceptado.
- **Arquivos:** `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`.
- **Interfaces:** o teste e2e sobe o `out/` por um servidor estático local e abre a página em 390, 768 e 1440 de largura.
- **Testes:** a página abre; não há rolagem horizontal nos três tamanhos; nenhum erro no console.
- **Pronto quando:** `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passam.

### Tarefa 1.5: esqueleto do deploy no Cloudflare
- **Decisões em aberto:** nome do Worker (`giro-site`); só depois definir a rota do domínio.
- **Arquivos:** `wrangler.jsonc`, `README.md` (como rodar, construir e publicar).
- **Interfaces:** `assets.directory` aponta para `./out`; página 404 própria do export; cabeçalhos de cache e segurança
  básicos (arquivo `public/_headers`).
- **Testes:** `npx wrangler deploy --dry-run` termina sem erro depois do build.
- **Pronto quando:** o dry-run passa. O deploy real fica para a etapa 4.

**Parada da etapa 1:** o Cauê confere o projeto rodando e a lista de pendências (WhatsApp, domínio, textos).

**Mudanças na implementação da etapa 1 (revisão de 2026-11-11; valem como contrato para as etapas seguintes):**
- Tokens com outros nomes: o painel claro usa `--painel` e `--painel-fg`; as faixas de idade usam `--idade-novo`,
  `--idade-medio` e `--idade-velho`, e a faixa "parado" usa `--vermelho`. A fonte é `'Archivo Variable'`
  (`@fontsource-variable/archivo/wdth.css`).
- `site.ts` ganhou campos: `painel.total`, `celular{marca, sufixo, titulo, apoio, filtros[], carros[{nome, preco}]}`,
  `secoes{numeros, itens, versoes, semLetraMiuda}`, `versoes{colunaRecurso, descricao, incluido, naoIncluido}`,
  `acoes.*.ancora` e `naoEncontrada{}`. Componentes leem títulos de seção e textos para leitor de tela daqui.
- Arquivos a mais: `src/app/icon.svg` provisório (sem ele o 404 do favicon quebrava o teste de console),
  `src/app/not-found.tsx` (vira `out/404.html`), `scripts/servir-out.mjs` (servidor local para `preview` e e2e) e o
  `AGENTS.md` que o próprio `next dev` cria (manda ler `node_modules/next/dist/docs/` antes de codar: seguir).
- TypeScript 6.0.3 (o CRM usa 5). `package.json` com `"type": "module"`.
- HSTS sem `includeSubDomains` até o domínio ser decidido (tarefa 4.4).
- Antes do deploy real (tarefa 4.4): liberar o script de instalação do `workerd` (`npm approve-scripts`) e conferir
  o `_headers` na URL publicada, porque o dry-run não o valida.

## Etapa 2: o topo da página (hero, painel e celular)

Objetivo: o começo que o Cauê gostou, fiel à Noite, funcionando em todas as larguras.

**Decisão de estilo (2026-11-12, vale para as etapas 2 e 3):** cada componente tem seu CSS Module
(`Componente.module.css`), portado do CSS da Noite; os tokens continuam em `globals.css`. Não usar utilitários do
Tailwind nos componentes, para a página ter um sistema só (o design depende de `container queries`, `keyframes` e
`-webkit-box-reflect`, que ficam mais claros em CSS). Na Noite, as regras com `:root[data-dir="escuro"]` são as que
valem; as da direção clara e o seletor de direções (`.troca`) não entram.

### Tarefa 2.1: botão, topo e IconeCarro
- **Arquivos:** `components/Botao.tsx`, `components/Topo.tsx`, `components/IconeCarro.tsx`.
- **Interfaces:** `Botao({ variante: 'cheio' | 'contorno', tamanho?: 'normal' | 'grande', href, children })`: o hover
  sobe 1px, o clique afunda, o foco aparece. `Topo()`: marca GIRO, os dois links de seção e o botão "Agendar test-drive";
  abaixo de 560px só a marca e o botão. `IconeCarro({ className })`: o contorno do carro em SVG, sem foto.
- **Testes:** todo controle tem pelo menos 44px de altura; navegação por teclado chega ao botão do topo.
- **Pronto quando:** o topo bate com a Noite em 1440 e em 390.

### Tarefa 2.2: PainelLoja
- **Decisões em aberto:** usar `container queries` para empilhar as três métricas quando o painel fica estreito (a Noite
  já faz isso).
- **Arquivos:** `components/PainelLoja.tsx` (lê `site.painel`).
- **Interfaces:** `PainelLoja()` sem parâmetros; a barra de idade usa `flex` proporcional a `n`; o vermelho só na última
  faixa; a barra tem `role="img"` e `aria-label` gerado do conteúdo.
- **Testes:** o `aria-label` lista as quatro faixas com os números do conteúdo; a faixa vermelha é a única com a cor.
- **Pronto quando:** o painel em 1440, 768 e 390 não corta texto.

### Tarefa 2.3: CelularLoja
- **Arquivos:** `components/CelularLoja.tsx`.
- **Interfaces:** `CelularLoja()`: moldura, a loja fictícia "Brisa Seminovos", dois cartões com `IconeCarro`; marcado
  `aria-hidden`, porque é ilustração. Some abaixo de 860px.
- **Testes:** não aparece em 390; em 1440 não ultrapassa a margem direita.
- **Pronto quando:** o celular fica inteiro dentro do hero, sem corte no topo.

### Tarefa 2.4: Hero e as animações
- **Decisões em aberto:** a entrada roda uma vez ao carregar, só com CSS (`animation` com atraso escalonado).
- **Arquivos:** `components/Hero.tsx`, trecho de animações em `globals.css`.
- **Interfaces:** `Hero()`: duas colunas (texto à esquerda, produto à direita) acima de 860px, uma coluna abaixo; o
  `h1` é "GIRO"; spot de luz de fundo; fio vermelho no pé do hero que acende uma vez; brilho que passa uma vez no
  painel; a barra de idade cresce uma vez.
- **Testes:** com `prefers-reduced-motion`, nenhuma animação roda e tudo aparece; nada fica com `opacity: 0` parado.
- **Pronto quando:** o hero é igual à Noite, e o Cauê reconhece "o começo com o celular e a tabelinha".

**Parada da etapa 2:** o Cauê confere o topo em tela grande e no celular (prints ou o preview local).

**Mudanças na implementação da etapa 2 (conferência de 2026-11-12; valem como contrato para a etapa 3):**
- Cada componente tem `Componente.module.css`; o `.entra` e o `@keyframes` da entrada ficam em `globals.css`, e o brilho,
  a barra e o fio ficam em keyframes locais de cada módulo. `--piso` e `--cel-w` moram no `.hero`.
- `site.ts` ganhou `painel.idadeDescricao` e `acessibilidade{navPrincipal, novaAba, painel}`; `src/lib/rotulos.ts` tem
  `rotuloGraficoIdade` e `rotuloPainel`. Rótulos de leitor de tela da etapa 3 também entram em `acessibilidade`.
- `Botao` abre `http...` em nova aba e acrescenta "(abre em nova aba)" só para leitor de tela; o botão cheio tem
  `outline: 2px solid var(--fg)` no foco (o contorno padrão sumiria sobre o preto).
- O painel mantém o esmaecimento fixo da Noite (rótulos 0,62 e legenda 0,85); os testes de movimento reduzido aceitam só esses
  valores. Testes de componente em `.tsx` entram em `tests/unit/` (o `vitest.config.ts` inclui `*.test.{ts,tsx}`).
- Entre 391 e 560px a linha de botões do hero ocupa a largura toda (ajuste da conferência; a Noite deixava mais curta).
- Os links `#itens` e `#versoes` e o fallback `#agendar` ainda não têm destino: nascem na etapa 3.

## Etapa 3: as demais seções

### Tarefa 3.1: Numeros e ItensDeSerie
- **Arquivos:** `components/Numeros.tsx`, `components/ItensDeSerie.tsx`.
- **Interfaces:** os quatro números em grade de 4, 2 e 1 colunas; os itens como linhas grandes com divisória (como na
  Noite), uma coluna no celular.
- **Testes:** "Ilimitados" não encosta no número ao lado em 1024; os quatro itens aparecem na ordem do conteúdo.
- **Pronto quando:** as duas seções batem com a Noite em 1440 e 390.

### Tarefa 3.2: Versoes (tabela)
- **Decisões em aberto:** a coluna "Loja+" com fundo levemente mais claro, como na Noite.
- **Arquivos:** `components/Versoes.tsx`.
- **Interfaces:** tabela semântica (`caption` oculta, `th scope`), marcas de "incluído" e "não incluído" com texto para
  leitor de tela; contêiner com rolagem lateral só em telas estreitas e foco por teclado; a linha de preço destacada;
  a nota das lojas fundadoras abaixo.
- **Testes:** cada linha tem os dois valores; cada ✓ e cada – tem texto acessível; a tabela rola dentro do contêiner em 390
  sem rolar a página.
- **Pronto quando:** a tabela é legível em 390, com a primeira coluna visível.

### Tarefa 3.3: SemLetraMiuda, Fechamento e Rodape
- **Arquivos:** `components/SemLetraMiuda.tsx`, `components/Fechamento.tsx`, `components/Rodape.tsx`.
- **Interfaces:** o fechamento com a linha vermelha curta acima do título, centralizado, com os dois botões; o rodapé
  com "Giro. Feito em João Pessoa, Paraíba."
- **Testes:** os dois botões do fechamento usam `linkWhatsapp` com as duas mensagens; o rodapé traz a cidade.
- **Pronto quando:** a página inteira é igual à Noite do topo ao rodapé.

### Tarefa 3.4: montar a página e a rolagem entre seções
- **Arquivos:** `src/app/page.tsx`.
- **Interfaces:** a ordem das seções e os `id` `itens`, `versoes`, `agendar`; rolagem suave, sem trocar o hash da URL.
- **Testes (e2e):** clicar em "Versões" leva à seção; todo botão "Agendar test-drive" e "Falar no WhatsApp" tem
  `href` de `wa.me` com a mensagem certa (ou `#agendar` quando o número não está configurado).
- **Pronto quando:** a página completa passa nos testes e2e em 390, 768 e 1440.

**Parada da etapa 3:** o Cauê revisa a página inteira. Aqui vem a revisão de código (Opus) sobre as etapas 1 a 3.

**Mudanças na implementação da etapa 3 (conferência de 2026-11-12):**
- Página montada: Topo, Hero, Numeros, ItensDeSerie, Versoes, SemLetraMiuda, Fechamento, Rodape (ids `itens`, `versoes`,
  `agendar`). `Secao.module.css` é a base compartilhada das quatro seções com título.
- `RolagemSuave.tsx` (componente cliente mínimo) intercepta cliques em `a[href^="#"]` com seção correspondente, usa
  `scrollIntoView` sem trocar o hash e respeita `prefers-reduced-motion`; sem JavaScript o link nativo funciona.
- Rodapé com padding inferior de 56px (a Noite tinha 120px só por causa do seletor de direções, que não existe aqui).
- Corrigidos dois defeitos da Noite: o seletor de `.preco th` perdia para `.tabela tbody th`, e os `.sr` das células
  ficavam fora do contêiner da tabela e causavam rolagem horizontal da página em 390px (`.rolagem` agora é `relative`).
- Testes: 73 e2e passam e 1 é ignorado (clique em "Versões" do topo em 390, porque os links de texto só existem a
  partir de 561px). Com `NEXT_PUBLIC_WHATSAPP_NUMBER` de exemplo os 5 botões saem como `wa.me` com a mensagem certa e
  `target="_blank"`; sem número, `#agendar` e nenhum `wa.me` no `out/`.
- Para a revisão (Opus) decidir: em 390px a coluna Loja+ da tabela fica fora da janela até rolar o contêiner, sem dica
  visual de que dá para rolar; e, por o fechamento ser a última seção, o clique em `#agendar` pode não chegar rente
  ao topo em telas altas.

**Revisão de código das etapas 1 a 3 (Opus, 2026-11-12):** o código segue o contrato, sem texto em componente,
acessibilidade bem feita e rolagem que degrada sem JavaScript. Correções feitas:
- **Tabela no celular:** em vez de rolagem lateral com dica, a tabela cabe inteira até 320px (abaixo de 560px:
  `min-width: 0`, texto 13px, padding menor, preço 17px). O teste e2e agora exige as três colunas na janela, sem
  rolagem, em 390, 768 e 1440.
- **Chave React do preço:** era o valor do preço, que pode repetir com preços provisórios; agora é o nome da coluna.
- **`servir-out.mjs`:** um endereço com `%` malformado derrubava o servidor (confirmado ao vivo); agora responde 400.
- Aceito sem mudar: o clique em `#agendar` não chega rente ao topo em telas altas (é a última seção; normal);
  `not-found.tsx` com estilos inline (página sem uso real; pode virar módulo na etapa 4).
- Para a etapa 4: o `h1` é só "GIRO"; o título da página e a descrição precisam dizer o que é (sistema de gestão para
  revendas de seminovos) para busca e compartilhamento.

## Etapa 4: acabamento e publicação

### Tarefa 4.1: SEO e compartilhamento
- **Decisões em aberto:** imagem de compartilhamento (sugestão: um PNG do hero gerado com o Chrome e guardado em
  `public/`, sem rota dinâmica, por causa do export).
- **Arquivos:** `layout.tsx` (metadata), `app/icon.svg`, `app/robots.ts`, `app/sitemap.ts`, `public/og.png`.
  Com `output: 'export'`, `robots.ts` e `sitemap.ts` precisam ser estáticos (`dynamic = 'force-static'`); conferir que
  saem como arquivos em `out/`.
- **Interfaces:** título e descrição em português, `og:*`, `twitter:*`, `theme-color`, URL canônica vinda de
  `NEXT_PUBLIC_SITE_URL`.
- **Testes:** o `out/index.html` tem título, descrição, `og:image` e canônica; `robots.txt` e `sitemap.xml` existem.
- **Pronto quando:** o link, colado no WhatsApp, mostra imagem, título e descrição.

### Tarefa 4.2: acessibilidade e desempenho
- **Arquivos:** ajustes nos componentes; `tests/e2e/a11y.spec.ts`.
- **Interfaces:** `axe` nos três tamanhos; ordem de títulos `h1`, `h2`, `h3`; contraste do texto cinza sobre o preto;
  foco visível; `skip link`.
- **Testes:** zero violações do `axe` sérias ou críticas; Lighthouse de desempenho e acessibilidade em 95 ou mais no
  celular.
- **Pronto quando:** os dois relatórios passam, ou cada exceção está registrada com o motivo.

### Tarefa 4.3: conferência com a Taste Skill (só leitura)
- **Decisões em aberto:** a skill pede 8 elementos em movimento e 4 fotos, o que contraria o combinado. Rodar só os
  checadores de layout e de texto (`check.mjs` e `copy-lint.mjs`), registrando as regras dela que o combinado derruba.
  Não armar o gate (`gate.mjs --start`).
- **Arquivos:** nenhum no site; o relatório vai em `docs/`.
- **Testes:** zero achados de overflow, colisão e tamanho de toque no `out/index.html`.
- **Pronto quando:** o relatório está escrito e os achados reais viraram correções.

### Tarefa 4.4: publicar no Cloudflare e deixar o caminho da VPS
- **Decisões em aberto:** domínio e rota (depende da pendência 2).
- **Arquivos:** `README.md` (seção "Publicar" e seção "Migrar para a VPS"), `deploy/Caddyfile.exemplo`.
- **Interfaces:** `npm run deploy` publica a pasta `out/`; a seção da VPS descreve servir `out/` com Caddy ou nginx,
  com os mesmos cabeçalhos do `_headers`.
- **Testes:** a URL do Worker abre a página completa; a conferência em 390 e 1440 passa na URL publicada.
- **Pronto quando:** o site está no ar no Cloudflare e o README ensina a migração.

**Mudança no meio do caminho (2026-11-12): marca AutoHub.** O Cauê definiu o nome **AutoHub** e escolheu a logo 04
("O aberto"; arquivos em `landing/marca/autohub/`). Efeitos na landing, já feitos antes do deploy: `site.nome` e todos
os textos trocados de Giro para AutoHub; novo componente `Logo.tsx` (SVG em contorno) no h1 do hero (com o nome em
`.sr` para leitor de tela) e na barra do topo; favicon `src/app/icon.svg` trocado pelo ícone do anel; `og.png`
regerado; Worker e pacote renomeados para `autohub-site`; teste de fonte do hero (`smoke.spec.ts`) trocado por um que
confere o h1 com a logo; filtro do teste de movimento reduzido ignora `transform` dentro de SVG. Contrato dos
próximos passos: o nome muda só em `src/content/site.ts` e a logo só em `Logo.tsx`.

**Parada da etapa 4:** entrega. Registrar no `current-state.md` e na vault.

## Fora do escopo agora (etapa futura)

- Formulário de leads (nome, loja, cidade, WhatsApp), com proteção contra spam, aviso de LGPD e notificação.
- Medição de cliques (Plausible ou Umami).
- Fotos reais e o nome definitivo do produto.

## Checklist único

Etapa 1
- [x] 1.1 Criar o projeto
- [x] 1.2 Tokens, fonte e layout raiz
- [x] 1.3 Arquivo de conteúdo e utilitário do WhatsApp
- [x] 1.4 Lint, testes e Playwright
- [x] 1.5 Esqueleto do deploy no Cloudflare
- [x] **PARADA 1:** Cauê confere (2026-11-12)

Etapa 2
- [x] 2.1 Botão, topo e IconeCarro
- [x] 2.2 PainelLoja
- [x] 2.3 CelularLoja
- [x] 2.4 Hero e animações
- [x] **PARADA 2:** Cauê confere (2026-11-12: "tá bem legal")

Etapa 3
- [x] 3.1 Numeros e ItensDeSerie
- [x] 3.2 Versoes
- [x] 3.3 SemLetraMiuda, Fechamento e Rodape
- [x] 3.4 Montar a página e a rolagem
- [x] **PARADA 3:** Cauê revisa ("tá aprovada", 2026-11-12); revisão de código (Opus) feita

Etapa 4
- [x] 4.1 SEO e compartilhamento
- [x] 4.2 Acessibilidade e desempenho
- [x] 4.3 Conferência com a Taste Skill
- [x] 4.4 Publicar e deixar o caminho da VPS (no ar em https://autohub-site.pedidos-jp.workers.dev, 2026-11-12; `noindex`, valores genéricos)
- [ ] **PARADA 4:** entrega (aguarda o Cauê conferir a URL publicada)
