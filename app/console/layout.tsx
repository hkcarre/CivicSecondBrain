import { redirect } from "next/navigation";
import { currentUserIsStrataAdmin } from "@/lib/db/queries/console";

/**
 * Gate for the entire /console route tree — a cross-city view for Strata's
 * own team, distinct from the per-city /admin panel. Checked once here
 * rather than per-page; every page under app/console/ inherits this.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await currentUserIsStrataAdmin();
  if (!isAdmin) {
    redirect("/login?next=%2Fconsole");
  }

  return <div className="min-h-full bg-gray-50 dark:bg-gray-900">{children}</div>;
}
