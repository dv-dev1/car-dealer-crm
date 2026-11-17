import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AvisoMeta } from "@/components/gestao/painel/PainelAvisos";
import { MetaBloco, salvarMeta } from "@/components/gestao/relatorios/MetaBloco";
import { setGoalAction } from "@/features/reports/actions";
import { resumoMetaMes } from "@/lib/metas";

vi.mock("@/features/reports/actions", () => ({ setGoalAction: vi.fn() }));

const render = <P extends object>(component: FunctionComponent<P>, props: P) => renderToStaticMarkup(createElement(component, props));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const meta = resumoMetaMes({ alvo: 12, feito: 5, emNegociacao: 3, aguardandoRetorno: 1 }, "2026-11-16");

it("the goal ribbon counts the month's sales", () => {
  expect(meta).toMatchObject({ alvo: 12, feito: 5, restam: 7, diasRestantes: 13, projecao: 9, pct: 42, mesLabel: "Novembro", ano: 2026 });
  const painel = text(render(AvisoMeta, { meta, mesLabel: "Novembro", podeDefinir: true }));
  const relatorios = text(render(MetaBloco, { meta, mesLabel: "Novembro", podeEditar: true }));
  expect(painel).toContain("Faltam 7 em 13 dias úteis");
  expect(relatorios).toContain("Faltam 7 em 13 dias úteis");
  expect(relatorios).toContain("3 em negociação");
});

it("only owner and manager edit the goal", () => {
  expect(text(render(MetaBloco, { meta, mesLabel: "Novembro", podeEditar: false }))).not.toContain("Editar meta");
  expect(text(render(MetaBloco, { meta, mesLabel: "Novembro", podeEditar: true }))).toContain("Editar meta");
});

it("a month without a goal", () => {
  expect(text(render(AvisoMeta, { meta: null, mesLabel: "Novembro", podeDefinir: true }))).toContain("Defina a meta de novembro");
  expect(render(AvisoMeta, { meta: null, mesLabel: "Novembro", podeDefinir: false })).toBe("");
  const seller = text(render(MetaBloco, { meta: null, mesLabel: "Novembro", podeEditar: false }));
  expect(seller).toContain("A meta de novembro ainda não foi definida.");
  expect(seller).not.toMatch(/de 0 vendas|Definir meta/);
  expect(text(render(MetaBloco, { meta: null, mesLabel: "Novembro", podeEditar: true }))).toContain("Definir meta");
});

it("a failed save keeps the form open with a message, instead of breaking the screen", async () => {
  const fechar = vi.fn();
  vi.mocked(setGoalAction).mockRejectedValueOnce(new TypeError("Failed to fetch"));
  expect(await salvarMeta({ error: null }, new FormData(), fechar)).toEqual({
    error: "Não foi possível salvar. Confira a internet e tente de novo.",
  });
  expect(fechar).not.toHaveBeenCalled();
  vi.mocked(setGoalAction).mockResolvedValueOnce({ error: null });
  expect(await salvarMeta({ error: null }, new FormData(), fechar)).toEqual({ error: null });
  expect(fechar).toHaveBeenCalledOnce();
});
