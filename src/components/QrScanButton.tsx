import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function QrScanButton({ onResult }: { onResult: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);



  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label="Scan QR code"
      >
        <QrCode className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan poster QR</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-xl border border-border">
            {open && (
              <Scanner
                paused={!open}

                onScan={(codes) => {
                  const text = codes[0]?.rawValue;
                  if (text) {
                    onResult(text);
                    setOpen(false);
                  }
                }}
                onError={(err) =>
                  setError(err instanceof Error ? err.message : "Camera unavailable")
                }
                constraints={{ facingMode: "environment" }}
                styles={{ container: { width: "100%" } }}
                allowMultiple={false}
              />
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">
              {error}. You can still paste the link manually.
            </p>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" /> Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
