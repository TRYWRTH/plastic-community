import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, LogOut, Bookmark, UserRound } from "lucide-react";
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

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
        <Link to="/" className="flex min-w-0 items-baseline gap-2">
          <span className="font-brand text-base uppercase tracking-[0.12em] text-foreground">
            Plastic
          </span>
          <span className="hidden font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground sm:inline">
            productions
          </span>
        </Link>

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
