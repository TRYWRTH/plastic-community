import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus, LogOut, Bookmark, UserRound, Bell } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MagicLinkDialog } from "@/components/MagicLinkDialog";

export function Header() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const [signInOpen, setSignInOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const isLargeBrand = pathname.startsWith("/add") || /\/edit$/.test(pathname);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
        {isHome ? (
          <a
            href="https://www.instagram.com/plastic_productions_/"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground hover:bg-primary hover:text-primary-foreground sm:text-[11px]"
          >
            Brought to you by Plastic Productions
          </a>
        ) : (
          <Link to="/" className="flex min-w-0 items-baseline gap-2">
            <span
              className={
                isLargeBrand
                  ? "font-brand uppercase text-foreground text-xl tracking-[0.18em] sm:text-3xl sm:tracking-[0.24em]"
                  : "font-brand text-base uppercase tracking-[0.12em] text-foreground"
              }
            >
              Whisper Ring
            </span>
          </Link>
        )}

        <nav className="flex items-center gap-1 sm:gap-2">
          {isAuthenticated && (
            <Button asChild size="sm" variant="ghost">
              <Link to="/saved">
                <Bookmark className="h-4 w-4" />
                <span className="hidden sm:inline">My list</span>
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="default">
            <Link to="/add">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add event</span>
            </Link>
          </Button>
          {!loading && isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-full"
                  aria-label="Account"
                >
                  <UserRound className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-mono text-xs">
                  {user?.email ?? "Account"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Notification settings hidden temporarily — feature kept for later testing */}
                {false && (
                  <DropdownMenuItem asChild>
                    <Link to="/settings/notifications">
                      <Bell className="mr-2 h-4 w-4" /> Notification settings
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>
      <MagicLinkDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </header>
  );
}
