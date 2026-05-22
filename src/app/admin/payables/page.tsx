import { redirect } from "next/navigation";
import { apAdminPath } from "@/lib/ar-ap-books";

/** 従来URL → 買掛金 */
export default function PayablesIndexPage() {
  redirect(apAdminPath("kaikake"));
}
