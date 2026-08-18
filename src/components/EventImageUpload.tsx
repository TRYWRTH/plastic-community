import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadEventImage } from "@/lib/image-upload";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function EventImageUpload({
  value,
  onChange,
  userId,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  userId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Image is too large — please pick one under 8MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadEventImage(file, userId);
      onChange(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
        PHOTO — OPTIONAL
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-foreground/[0.07]">
          <img src={value} alt="" className="h-full w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-full bg-shell-deep/80 px-3 py-1.5 font-mono text-[9px] tracking-[0.12em] text-foreground disabled:opacity-60"
            >
              {uploading ? "UPLOADING…" : "REPLACE"}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-full bg-shell-deep/80 px-3 py-1.5 font-mono text-[9px] tracking-[0.12em] text-foreground"
            >
              REMOVE
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-full items-center justify-center rounded-2xl border border-dashed border-border/[0.35] font-mono text-[10px] tracking-[0.14em] text-muted-2 disabled:opacity-60"
        >
          {uploading ? "UPLOADING…" : "+ ADD PHOTO"}
        </button>
      )}
    </div>
  );
}
