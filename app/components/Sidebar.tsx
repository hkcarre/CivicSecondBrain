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
  Menu,
  X,
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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync dark state with class already applied by the inline script
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- document is unavailable during SSR; must read post-mount
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

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

  const navContent = (
    <>
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
            <p className="text-white/50 text-xs">
              {process.env.NEXT_PUBLIC_CITY_NAME ?? "Schertz"}, {process.env.NEXT_PUBLIC_CITY_STATE ?? "TX"}
            </p>
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
          <p>Data: {process.env.NEXT_PUBLIC_CITY_NAME?.toLowerCase().replace(/\s+/g, "") ?? "schertz"}.com</p>
          <p>Powered by Claude AI</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar (md+) ─────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 bg-city-navy dark:bg-gray-900 flex-col h-full flex-shrink-0 border-r border-white/10 dark:border-gray-700">
        {navContent}
      </aside>

      {/* ── Mobile: top header bar ───────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-city-navy dark:bg-gray-900 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-city-gold flex items-center justify-center flex-shrink-0">
            <span className="text-city-navy font-bold text-xs">🏛</span>
          </div>
          <p className="text-white font-semibold text-sm">CivicSecondBrain</p>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* ── Mobile drawer overlay ─────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer panel */}
          <aside className="relative w-72 max-w-[85vw] bg-city-navy dark:bg-gray-900 flex flex-col h-full shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
