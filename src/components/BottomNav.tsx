import { Link, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/use-auth";

type NavTab = {
  label: string;
  to: string;
  requiresAuth: boolean;
  isActive: (pathname: string) => boolean;
};

const TABS: NavTab[] = [
  {
    label: "HOME",
    to: "/",
    requiresAuth: false,
    isActive: (p) => p === "/" || p.startsWith("/event/"),
  },
  {
    label: "ADD",
    to: "/add",
    requiresAuth: true,
    isActive: (p) => p === "/add",
  },
  {
    label: "ME",
    to: "/settings/profile",
    requiresAuth: true,
    isActive: (p) => p === "/settings/profile" || p === "/saved",
  },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated, loading } = useAuth();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pt-6"
      style={{
        paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))",
        background: "linear-gradient(180deg, transparent, var(--background) 40%)",
      }}
      aria-label="Primary"
    >
      <div className="grid w-full max-w-[456px] grid-cols-3 gap-1.5 rounded-full bg-shell-deep p-2">
        {TABS.map((tab) => {
          // HOME stays styled like ME (transparent/dim) even when active, so
          // the two non-ADD tabs always look consistent with each other.
          const active = tab.label !== "HOME" && tab.isActive(pathname);
          const gated = tab.requiresAuth && !loading && !isAuthenticated;
          const isAdd = tab.label === "ADD";
          return (
            <Link
              key={tab.label}
              to={gated ? "/login" : tab.to}
              search={gated ? { redirect: tab.to } : undefined}
              className={`flex items-center justify-center gap-1 rounded-full px-1 py-[18px] text-center font-mono text-[11px] font-bold tracking-[0.14em] ${
                isAdd
                  ? "bg-hot text-shell-deep"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-dim"
              }`}
            >
              {isAdd && <Plus className="h-3.5 w-3.5" strokeWidth={3} />}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
