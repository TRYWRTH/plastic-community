import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, LogOut, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";

export function Header() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-brand text-base uppercase tracking-[0.12em] text-foreground">
            Plastic
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            productions
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {isAuthenticated && (
            <Button asChild size="sm" variant="default">
              <Link to="/add">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add event</span>
              </Link>
            </Button>
          )}
          {!loading &&
            (isAuthenticated ? (
              <Button size="sm" variant="ghost" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            ) : (
              <Button asChild size="sm" variant="ghost">
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign in</span>
                </Link>
              </Button>
            ))}
        </nav>
      </div>
    </header>
  );
}
