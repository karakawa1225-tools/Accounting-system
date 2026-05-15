import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/authz";
import { listStaffUsers } from "./actions";
import { UsersManageView } from "./view";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getCurrentSession();
  if (!session?.role || session.role !== "admin") redirect("/admin/masters");
  const rows = await listStaffUsers();
  return <UsersManageView users={rows} currentUserId={session.userId} />;
}
