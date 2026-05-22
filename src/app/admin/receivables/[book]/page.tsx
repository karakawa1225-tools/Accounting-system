import { redirect } from "next/navigation";
import { AR_BOOKS, type ArBook, arAdminPath } from "@/lib/ar-ap-books";

/** 旧URL /admin/receivables/seko|kiko → 単一画面＋部署クエリ */
export default async function ReceivablesBookRedirectPage({ params }: { params: Promise<{ book: string }> }) {
  const { book: raw } = await params;
  if (!AR_BOOKS.includes(raw as ArBook)) redirect("/admin/receivables");
  redirect(arAdminPath(raw as ArBook));
}
