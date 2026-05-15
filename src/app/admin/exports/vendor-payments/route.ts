import { getMonthlyVendorPaymentLines } from "@/app/admin/payables/actions";
import { csvDownloadResponse } from "@/lib/csv-response";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("月指定が不正です", { status: 400 });
  const report = await getMonthlyVendorPaymentLines(month);
  return csvDownloadResponse(
    `仕入先支払_${month}.csv`,
    ["日付", "仕入先コード", "仕入先名", "銀行名", "支店名", "口座区分", "口座番号", "支払額", "摘要"],
    report.rows.map((r) => [
      r.transactionDate,
      r.vendorCode ?? "",
      r.vendorName ?? "",
      r.bankName ?? "",
      r.branchName ?? "",
      r.accountType ?? "",
      r.accountNumber ?? "",
      String(r.amountMinor),
      r.summary ?? "",
    ])
  );
}
