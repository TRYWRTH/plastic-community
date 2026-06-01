import { useEffect } from "react";
import { useBlocker } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Blocks in-app and browser navigation while `when` is true.
 * Renders a confirmation dialog ("Leave without saving?") on attempted nav.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => when,
    withResolver: true,
  });

  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when]);

  return (
    <AlertDialog open={status === "blocked"} onOpenChange={(o) => { if (!o) reset?.(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll lose what you've added so far.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => reset?.()}>STAY</AlertDialogAction>
          <AlertDialogCancel onClick={() => proceed?.()}>LEAVE</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
