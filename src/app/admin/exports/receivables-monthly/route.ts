import { getMonthlyArPaymentLines } from "@/app/admin/receivables/actions";
import { csvDownloadResponse } from "@/lib/csv-response";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("月指定が不正です", { status: 400 });
  const report = await getMonthlyArPaymentLines(month);
  return csvDownloadResponse(
    `売掛入金_${month}.csv`,
    ["日付", "顧客コード", "顧客名", "入金額", "摘要"],
    report.rows.map((r) => [
      r.transactionDate,
      r.customerCode ?? "",
      r.customerName ?? "",
      String(r.amountMinor),
      r.summary ?? "",
    ])
  );
}
