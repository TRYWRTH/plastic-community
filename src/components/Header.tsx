import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus, LogOut, Bookmark, UserRound, Bell, HelpCircle, LogIn, Search, User } from "lucide-react";
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
  

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
      <Link to="/" className="flex min-w-0 items-baseline gap-2">
        <span className="sr-only">Whisper Ring</span>
        {pathname !== "/" && (
          <span
            aria-hidden="true"
            className="truncate font-brand text-xl uppercase leading-none text-foreground hover:text-primary sm:text-2xl"
          >
            Whisper Ring
          </span>
        )}
      </Link>


        <nav className="flex items-center gap-1 sm:gap-2">
          {pathname === "/" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 sm:hidden"
              aria-label="Search events"
              onClick={() => window.dispatchEvent(new CustomEvent("whisperring:open-search"))}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            aria-label="Show walkthrough"
            onClick={() => window.dispatchEvent(new CustomEvent("whisperring:show-onboarding"))}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          {isAuthenticated && (
            <Button asChild size="sm" variant="ghost">
              <Link to="/saved">
                <Bookmark className="h-4 w-4" />
                <span className="hidden sm:inline">My list</span>
              </Link>
            </Button>
          )}
          {isAuthenticated ? (
            <Button asChild size="sm" variant="default">
              <Link to="/add">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add event</span>
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="default" onClick={() => setSignInOpen(true)}>
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Sign in to add event</span>
              <span className="sm:hidden">Sign in</span>
            </Button>
          )}
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
                <DropdownMenuItem asChild>
                  <Link to="/settings/profile">
                    <User className="mr-2 h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
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
