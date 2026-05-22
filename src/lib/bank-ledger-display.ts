import { OPENING_JOURNAL_SUMMARY } from "@/lib/opening-balance-constants";

/** 通帳明細1行（クライアント表示用。server actions とは型のみ共有） */
export type BankLedgerLineDisplay = {
  id: string;
  entryGroupId: string | null;
  transactionDate: string;
  flow: "in" | "out";
  amountMinor: number;
  counterparty: string | null;
  counterpartyKind: "customer" | "vendor" | "payee" | null;
  accountName: string;
  counterAccountId: string | null;
  customerId: string | null;
  payeeId: string | null;
  summary: string | null;
  kind: string;
};

export function isBankOpeningBalanceLine(line: BankLedgerLineDisplay): boolean {
  return line.kind === "journal" && line.summary?.trim() === OPENING_JOURNAL_SUMMARY;
}

/** 通帳・PDF用: 期首残高仕訳を1行にまとめ、通常明細と分離する */
export function splitBankLedgerForDisplay(lines: BankLedgerLineDisplay[]) {
  const openingRaw = lines.filter(isBankOpeningBalanceLine);
  const regular = lines.filter((l) => !isBankOpeningBalanceLine(l));

  const openingIn = openingRaw.filter((l) => l.flow === "in");
  let opening: BankLedgerLineDisplay | null = null;
  if (openingIn.length > 0) {
    const primary = openingIn[0]!;
    opening = {
      ...primary,
      id: `opening-${primary.transactionDate}-${primary.entryGroupId ?? primary.id}`,
      accountName: "期首残高",
      counterparty: null,
      summary: OPENING_JOURNAL_SUMMARY,
      amountMinor: primary.amountMinor,
      kind: "opening_balance",
    };
  }

  return { opening, regular };
}
