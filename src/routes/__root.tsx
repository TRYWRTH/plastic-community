import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { initOneSignal, setOneSignalExternalId } from "@/lib/onesignal";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold">Nothing happening here</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            Back to events
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  ssr: false,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no",
      },
      { name: "theme-color", content: "#F2F0EB" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Poster Said So" },
      { name: "application-name", content: "The Poster Said So" },
      { title: "The Poster Said So — Performance events in Berlin" },
      {
        name: "description",
        content:
          "Spot a poster, add the event, share it. A living index of Plastic Productions performance events in Berlin.",
      },
      {
        property: "og:title",
        content: "The Poster Said So — Performance events in Berlin",
      },
      {
        property: "og:description",
        content: "Spot a poster, add the event, share it.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "The Poster Said So — Performance events in Berlin" },
      { name: "twitter:title", content: "The Poster Said So — Performance events in Berlin" },
      { name: "description", content: "Discover and share local events with \"The Poster Said So\" app." },
      { property: "og:description", content: "Discover and share local events with \"The Poster Said So\" app." },
      { name: "twitter:description", content: "Discover and share local events with \"The Poster Said So\" app." },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      router.invalidate();
      queryClient.invalidateQueries();
      // Only init OneSignal AFTER the user is authenticated, and never on
      // the /login route — initializing during the login flow can cause the
      // browser permission prompt to appear before the user is actually in.
      if (session?.user) {
        const path =
          typeof window !== "undefined" ? window.location.pathname : "";
        if (!path.startsWith("/login")) {
          initOneSignal().then(() => {
            setOneSignalExternalId(session.user.id);
          });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  // Unregister any legacy /sw.js. Do NOT auto-init OneSignal here — init is
  // deferred until the user is authenticated (see auth listener above) and
  // they explicitly enable push from a user gesture.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => {
          if (r.active?.scriptURL.endsWith("/sw.js")) r.unregister();
        });
      });
    }
    // If the user is already signed in on a non-login page, init OneSignal.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) return;
      const path = window.location.pathname;
      if (path.startsWith("/login")) return;
      initOneSignal().then(() => {
        setOneSignalExternalId(data.session!.user.id);
      });
    });
  }, []);

  if (!mounted) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="light" position="top-center" richColors />
    </QueryClientProvider>
  );
}
