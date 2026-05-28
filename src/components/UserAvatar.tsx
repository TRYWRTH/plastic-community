import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const letter = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            aria-label={name}
            className={cn(
              "grid place-items-center rounded-full border-2 border-background bg-foreground font-mono font-bold uppercase leading-none text-[oklch(0.78_0.18_145)] focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
              size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-[11px]",
              className,
            )}
          >
            {letter}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-mono text-[11px] uppercase tracking-widest">
          {name}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
