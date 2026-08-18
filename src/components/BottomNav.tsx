import { Link, useRouterState } from "@tanstack/react-router";
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
    label: "RADAR",
    to: "/radar",
    requiresAuth: false,
    isActive: (p) => p === "/radar",
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
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3.5"
      aria-label="Primary"
    >
      <div className="grid w-full max-w-[406px] grid-cols-4 gap-1 rounded-full bg-shell-deep p-1.5">
        {TABS.map((tab) => {
          const active = tab.isActive(pathname);
          const gated = tab.requiresAuth && !loading && !isAuthenticated;
          return (
            <Link
              key={tab.label}
              to={gated ? "/login" : tab.to}
              search={gated ? { redirect: tab.to } : undefined}
              className={`rounded-full px-1 py-3.5 text-center font-mono text-[10px] font-bold tracking-[0.14em] ${
                active ? "bg-primary text-primary-foreground" : "bg-transparent text-dim"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
