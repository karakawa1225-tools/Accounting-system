import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/authz";
import { getCompanySettingsData } from "./actions";
import { CompanySettingsView } from "./view";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage() {
  const session = await getCurrentSession();
  if (!session?.role || session.role !== "admin") redirect("/admin/masters");
  const { company, banks, ledgerAccounts } = await getCompanySettingsData();
  return <CompanySettingsView company={company} initialBanks={banks} ledgerAccounts={ledgerAccounts} />;
}
