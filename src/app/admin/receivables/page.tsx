import { redirect } from "next/navigation";
import { arAdminPath } from "@/lib/ar-ap-books";

/** 従来URL → 施工部売掛 */
export default function ReceivablesIndexPage() {
  redirect(arAdminPath("seko"));
}
