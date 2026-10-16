import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Upload, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTopUpFn } from "@/features/topup/server";

export function TopUpDialog({ className }: { className?: string } = {}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountInvalid, setAmountInvalid] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const presetAmounts = [50, 100, 150, 200];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setAmountInvalid(true);
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      let receiptUrl: string | undefined;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          receiptUrl = data.url;
        }
      }

      const result = await createTopUpFn({ data: { amount: parseFloat(amount), receiptUrl } });
      if (result.type !== "SUCCESS") {
        throw new Error("Failed to submit");
      }

      toast.success("Top-up request submitted", { description: "Waiting for host approval" });
      setAmount("");
      setFile(null);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } catch {
      toast.error("Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setAmountInvalid(false); }}>
      <DialogTrigger asChild>
        <Button size="sm" className={className}>
          <Plus className="h-4 w-4 mr-1" />
          Top Up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Top Up</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Scan this DuitNow QR to top up</p>
            <img
              src="/duitnow-qr.jpg"
              alt="DuitNow QR code for club top-ups (Lim Siew Ping, Ryt Bank)"
              width={732}
              height={983}
              className="h-auto w-full max-w-[200px] rounded-md"
            />
            <a
              href="/duitnow-qr.jpg"
              download="ss-badminton-duitnow-qr.jpg"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Save QR to scan from your banking app
            </a>
          </div>

          <div>
            <Label htmlFor="topup-amount">Amount (RM)</Label>
            <Input
              id="topup-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setAmountInvalid(false); }}
              className={cn("mt-1", amountInvalid && "border-danger focus-visible:ring-danger")}
            />
          </div>

          <div className="flex gap-2">
            {presetAmounts.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setAmount(preset.toString()); setAmountInvalid(false); }}
              >
                RM {preset}
              </Button>
            ))}
          </div>

          <div>
            <Label htmlFor="topup-receipt">Receipt (optional)</Label>
            <div className="mt-1">
              <label
                htmlFor="topup-receipt"
                className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <Upload className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {file ? file.name : "Upload receipt photo"}
                </span>
              </label>
              <input
                id="topup-receipt"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 5 * 1024 * 1024) {
                    toast.error("File too large (max 5 MB)");
                    e.target.value = "";
                    return;
                  }
                  setFile(f || null);
                }}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Top-Up Request"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
