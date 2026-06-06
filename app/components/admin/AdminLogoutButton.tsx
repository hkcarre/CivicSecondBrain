"use client";

import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600
                 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
                 transition-colors"
    >
      Sign out
    </button>
  );
}
