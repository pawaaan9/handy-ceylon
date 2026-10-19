import type { QuotationLineInput } from "./schemas";
import type { QuotationLineKind } from "./types";

export type QuotationTotals = {
  lineItems: (QuotationLineInput & { amountLkr: number })[];
  labourLkr: number;
  materialsLkr: number;
  additionalLkr: number;
  inspectionFeeLkr: number;
  totalLkr: number;
};

/**
 * Integer rupee arithmetic only. The server always recomputes totals from the
 * line items; a total sent by the browser is never stored.
 */
export function computeQuotationTotals(lines: QuotationLineInput[], inspectionFeeLkr: number): QuotationTotals {
  const lineItems = lines.map((l) => ({ ...l, amountLkr: l.quantity * l.unitPriceLkr }));
  const sum = (kind: QuotationLineKind) =>
    lineItems.filter((l) => l.kind === kind).reduce((total, l) => total + l.amountLkr, 0);
  const labourLkr = sum("labour");
  const materialsLkr = sum("materials");
  const additionalLkr = sum("additional");
  return {
    lineItems,
    labourLkr,
    materialsLkr,
    additionalLkr,
    inspectionFeeLkr,
    totalLkr: labourLkr + materialsLkr + additionalLkr + inspectionFeeLkr,
  };
}

type DiffLine = Pick<QuotationTotals["lineItems"][number], "kind" | "description" | "quantity" | "unitPriceLkr" | "amountLkr">;

export type QuotationDifferences = {
  added: DiffLine[];
  removed: DiffLine[];
  changed: { kind: QuotationLineKind; description: string; beforeLkr: number; afterLkr: number }[];
  /** New total minus the accepted total (positive = more expensive). */
  totalChangeLkr: number;
};

const lineKey = (l: Pick<DiffLine, "kind" | "description">) => `${l.kind}:${l.description.trim().toLowerCase()}`;

/**
 * Itemized difference between an accepted quotation and its revision, stored
 * on the revision so the customer approves exactly what changed.
 */
export function quotationDifferences(
  accepted: { lineItems: DiffLine[]; totalLkr: number },
  revised: { lineItems: DiffLine[]; totalLkr: number },
): QuotationDifferences {
  const before = new Map(accepted.lineItems.map((l) => [lineKey(l), l]));
  const after = new Map(revised.lineItems.map((l) => [lineKey(l), l]));
  return {
    added: revised.lineItems.filter((l) => !before.has(lineKey(l))),
    removed: accepted.lineItems.filter((l) => !after.has(lineKey(l))),
    changed: revised.lineItems.flatMap((l) => {
      const old = before.get(lineKey(l));
      return old && old.amountLkr !== l.amountLkr
        ? [{ kind: l.kind, description: l.description, beforeLkr: old.amountLkr, afterLkr: l.amountLkr }]
        : [];
    }),
    totalChangeLkr: revised.totalLkr - accepted.totalLkr,
  };
}
