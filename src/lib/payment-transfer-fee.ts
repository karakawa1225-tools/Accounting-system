/** 振込手数料の負担者: 当社負担 / 貴社負担（相手先負担） */
export type TransferFeeBearer = "our" | "counterparty";

export function parseTransferFeeBearer(v: unknown): TransferFeeBearer {
  return v === "our" ? "our" : "counterparty";
}

/** 売掛入金: 当社負担なら消込対象＝振込金額＋手数料 */
export function arAllocationTargetMinor(transferMinor: number, feeMinor: number, bearer: TransferFeeBearer): number {
  const t = Math.max(0, Math.floor(transferMinor));
  const f = Math.max(0, Math.floor(feeMinor));
  return bearer === "our" ? t + f : t;
}

/** 買掛支払: 当社負担なら消込対象＝支払額、貴社負担なら支払額−手数料 */
export function apAllocationTargetMinor(payMinor: number, feeMinor: number, bearer: TransferFeeBearer): number {
  const p = Math.max(0, Math.floor(payMinor));
  const f = Math.max(0, Math.floor(feeMinor));
  return bearer === "our" ? p : Math.max(0, p - f);
}
