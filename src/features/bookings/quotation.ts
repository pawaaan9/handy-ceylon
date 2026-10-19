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
