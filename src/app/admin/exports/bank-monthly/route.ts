import { getBankLedgerLines } from "@/app/admin/bank-transactions/actions";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { csvDownloadResponse } from "@/lib/csv-response";
import { getSystemAccounts } from "@/lib/system-accounts";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const bankAccountId = url.searchParams.get("account") ?? undefined;
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("月指定が不正です", { status: 400 });

  const db = getDb();
  const sys = await getSystemAccounts(db);
  const accountId = bankAccountId ?? sys.bankId;
  const [acc] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
  const bankName = acc?.name ?? "銀行口座";

  const lines = await getBankLedgerLines({ month, bankAccountId: accountId });
  const ins = lines.filter((l) => l.flow === "in");
  const outs = lines.filter((l) => l.flow === "out");
  const max = Math.max(ins.length, outs.length, 1);

  const rows: string[][] = [];
  for (let i = 0; i < max; i++) {
    const inn = ins[i];
    const out = outs[i];
    rows.push([
      inn?.transactionDate ?? "",
      inn ? String(inn.amountMinor) : "",
      inn?.counterparty ?? "",
      inn?.accountName ?? "",
      inn?.summary ?? "",
      out?.transactionDate ?? "",
      out ? String(out.amountMinor) : "",
      out?.counterparty ?? "",
      out?.accountName ?? "",
      out?.summary ?? "",
    ]);
  }

  return csvDownloadResponse(
    `銀行明細_${bankName}_${month}.csv`,
    [
      "入金日",
      "入金額",
      "入金相手先",
      "入金勘定",
      "入金摘要",
      "出金日",
      "出金額",
      "出金相手先",
      "出金勘定",
      "出金摘要",
    ],
    rows
  );
}
