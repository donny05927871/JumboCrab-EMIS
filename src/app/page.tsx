import { getSession } from "@/lib/auth";
import { getHomePathForRole, normalizeRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

const Home = async () => {
  const session = await getSession();

  if (session.isLoggedIn) {
    const role = normalizeRole(session.role);
    if (role) {
      redirect(getHomePathForRole(role));
    }
  }

  redirect("/sign-in");
};

export default Home;
