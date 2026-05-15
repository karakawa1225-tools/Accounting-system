import { getMonthlyApPaymentLines } from "@/app/admin/payables/actions";
import { csvDownloadResponse } from "@/lib/csv-response";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("月指定が不正です", { status: 400 });
  const report = await getMonthlyApPaymentLines(month);
  return csvDownloadResponse(
    `買掛支払_${month}.csv`,
    ["日付", "仕入先コード", "仕入先名", "支払額", "摘要"],
    report.rows.map((r) => [
      r.transactionDate,
      r.vendorCode ?? "",
      r.vendorName ?? "",
      String(r.amountMinor),
      r.summary ?? "",
    ])
  );
}
