# AutoHub: logo escolhida ("O aberto")

Escolhida pelo Cauê em 2026-11-12, entre 6 propostas minimalistas. A prancha aprovada está em
[`prancha-04-o-aberto.png`](prancha-04-o-aberto.png).

## Arquivos

| Arquivo | Uso |
|---|---|
| `autohub-logo-branco.svg` / `.png` (2400 px) | Logo completa, texto claro, **fundo transparente**. Para fundos escuros. |
| `autohub-logo-preto.svg` / `.png` (2400 px) | Logo completa, texto escuro, **fundo transparente**. Para fundos claros. |
| `autohub-anel-branco.svg`, `autohub-anel-preto.svg` | Só o anel (símbolo), transparente. |
| `autohub-icone-claro.svg` / `-1024.png` | Ícone de app: quadrado arredondado claro, anel escuro. |
| `autohub-icone-escuro.svg` / `-1024.png` | Ícone de app: quadrado arredondado escuro, anel claro. |
| `fonte/gerar_logo.py` | Gera os SVGs a partir da fonte Archivo (precisa de `fontTools` e `brotli`). |

Os SVGs têm as letras **em contorno**: funcionam em qualquer lugar sem instalar fonte.

## Especificação

- **Nome:** AutoHub (A e H maiúsculos, o resto minúsculo). O "o" de Auto**Hub** é o anel.
- **Fonte:** Archivo (`wdth` 125, `wght` 700), espaçamento entre letras −0,03 em, sem kerning.
- **Anel:** diâmetro 0,56 em, sentado na linha de base; caixa 100×100, raio 38, traço 24, vão de 26 (de 238,8), girado
  −35° (o vão fica no canto superior direito); margem de 0,035 em de cada lado.
- **Cores:** branco `#F4F5F6`, preto `#14161A`, fundo `#0B0C0E`, cinza `#9BA1A8`. O vermelho `#D3261C` **não** aparece
  na logo: fica reservado ao que está parado no produto.
- **Ícone:** quadrado arredondado (raio 22/96 do lado), anel com 50/96 do lado, centralizado.
- **Tamanhos pequenos:** abaixo de uns 24 px de altura de texto, engrossar o anel (traço 26 a 28, raio 36 a 37) para o
  vão não fechar.
- **Área livre:** ao menos o diâmetro do anel em volta da logo.
- Não esticar, não girar, não pôr efeito e não trocar a fonte.

## Fora desta pasta

Nome e logo ainda dependem do aval do sócio e das checagens de INPI, domínio `.com.br` e Instagram. Ver
[`../../landing/README.md`](../../landing/README.md), seção "Em aberto".
