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
 *
 * `isSubmittedRef`, if provided, is read live inside `shouldBlockFn` (which
 * the router calls on-demand at navigation time) rather than baked into
 * `when` at render time. That matters because callers typically flip the
 * ref and call `navigate()` in the same synchronous handler, with no
 * re-render in between — a `when` expression that already dereferenced the
 * ref would still be stale when the router checks it.
 */
export function UnsavedChangesGuard({
  when,
  isSubmittedRef,
}: {
  when: boolean;
  isSubmittedRef?: React.RefObject<boolean>;
}) {
  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => {
      if (isSubmittedRef?.current) return false;
      return when;
    },
    withResolver: true,
  });

  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isSubmittedRef?.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when, isSubmittedRef]);

  return (
    <AlertDialog
      open={status === "blocked"}
      onOpenChange={(o) => {
        if (!o) reset?.();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>You'll lose what you've added so far.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => reset?.()}>STAY</AlertDialogAction>
          <AlertDialogCancel onClick={() => proceed?.()}>LEAVE</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
