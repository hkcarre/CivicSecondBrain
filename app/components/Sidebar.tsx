"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  LayoutDashboard,
  FileText,
  Settings,
  BookOpen,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { clsx } from "clsx";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Ask the City",
    icon: MessageSquare,
    description: "Chat with your knowledge base",
  },
  {
    href: "/dashboard",
    label: "City Health",
    icon: LayoutDashboard,
    description: "AI recommendations & alerts",
  },
  {
    href: "/wiki",
    label: "Wiki",
    icon: BookOpen,
    description: "Browse the knowledge base",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Settings,
    description: "Ingestion & wiki management",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  // Sync state with the class already applied by the inline script
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  return (
    <aside className="w-64 bg-city-navy dark:bg-gray-900 flex flex-col h-full flex-shrink-0 border-r border-white/10 dark:border-gray-700">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 dark:border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-city-gold flex items-center justify-center flex-shrink-0">
            <span className="text-city-navy font-bold text-sm">🏛</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">
              CivicSecondBrain
            </p>
            <p className="text-white/50 text-xs">Schertz, TX</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                active
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon
                size={18}
                className={clsx(
                  "flex-shrink-0",
                  active ? "text-city-gold" : "text-white/50 group-hover:text-white/80"
                )}
              />
              <span className="text-sm font-medium">{item.label}</span>
              {active && (
                <ChevronRight size={14} className="ml-auto text-white/40" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10 dark:border-gray-700">
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors mb-3 text-sm"
        >
          {isDark ? (
            <>
              <Sun size={15} className="text-city-gold" />
              <span>Light mode</span>
            </>
          ) : (
            <>
              <Moon size={15} className="text-city-gold" />
              <span>Dark mode</span>
            </>
          )}
        </button>
        <div className="text-xs text-white/40 space-y-1">
          <p>Data: schertz.com/27/Government</p>
          <p>Powered by Claude AI</p>
        </div>
      </div>
    </aside>
  );
}
