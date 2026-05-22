import type { BankLedgerLine } from "@/app/admin/bank-transactions/actions";
import { OPENING_JOURNAL_SUMMARY } from "@/lib/opening-balance-journal";

export function isBankOpeningBalanceLine(line: BankLedgerLine): boolean {
  return line.kind === "journal" && line.summary?.trim() === OPENING_JOURNAL_SUMMARY;
}

/** 通帳・PDF用: 期首残高仕訳を1行にまとめ、通常明細と分離する */
export function splitBankLedgerForDisplay(lines: BankLedgerLine[]) {
  const openingRaw = lines.filter(isBankOpeningBalanceLine);
  const regular = lines.filter((l) => !isBankOpeningBalanceLine(l));

  const openingIn = openingRaw.filter((l) => l.flow === "in");
  let opening: BankLedgerLine | null = null;
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
