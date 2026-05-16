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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-baseline gap-3 group">
          <span className="font-brand neon-text text-xl leading-none tracking-[0.18em] uppercase transition group-hover:opacity-90">
            Plastic
          </span>
          <span className="font-display text-sm italic tracking-wide text-muted-foreground">
            productions
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          {isAuthenticated && (
            <Button asChild size="sm" variant="default" className="shadow-glow">
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
