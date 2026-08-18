import { createFileRoute, redirect } from "@tanstack/react-router";

// "My List" (saved events) is now part of the Me screen — keep this route
// alive as a redirect so old links/bookmarks to /saved still land somewhere.
export const Route = createFileRoute("/saved")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/profile" });
  },
});
