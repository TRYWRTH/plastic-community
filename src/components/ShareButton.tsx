import { Share2 } from "lucide-react";
import { toast } from "sonner";

export function ShareButton({
  url,
  className,
  children,
}: {
  url: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Copied!");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children ?? (
        <>
          <Share2 className="h-4 w-4 shrink-0" />
          Share
        </>
      )}
    </button>
  );
}
