import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Header } from "@/components/Header";
import { MagicLinkDialog } from "@/components/MagicLinkDialog";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (isAuthenticated) navigate({ to: redirect ?? "/" });
  }, [isAuthenticated, navigate, redirect]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-md px-4 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <div className="mt-6 rounded-none border-2 border-foreground bg-card p-6 sm:p-8">
          <h1 className="font-brand text-3xl uppercase">Sign in</h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Enter your email and we'll send you a magic link.
          </p>
          <Button className="mt-6 w-full" onClick={() => setOpen(true)}>
            Enter your email
          </Button>
        </div>
      </main>
      <MagicLinkDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
