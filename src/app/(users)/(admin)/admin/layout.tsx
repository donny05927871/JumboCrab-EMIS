import { getSession } from "@/lib/auth";
import { ADMIN_PANEL_ROLES, getHomePathForRole, normalizeRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const role = normalizeRole(session.role);

  if (!session.isLoggedIn || !role) {
    redirect("/sign-in");
  }

  if (!ADMIN_PANEL_ROLES.includes(role)) {
    redirect(getHomePathForRole(role));
  }

  return children;
}
