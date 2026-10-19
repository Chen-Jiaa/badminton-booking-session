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
import { Plus, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTopUpFn } from "@/features/topup/server";
import { MAX_RECEIPT_BYTES, shrinkReceipt } from "@/features/topup/receipt";

interface TopUpDialogProps {
  className?: string;
  /** Control the sheet from outside (e.g. the "Top up to join" button); omit to use the built-in trigger */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Amount filled in each time the sheet opens */
  initialAmount?: number;
}

export function TopUpDialog({
  className,
  open: controlledOpen,
  onOpenChange,
  initialAmount,
}: TopUpDialogProps = {}) {
  const controlled = controlledOpen !== undefined;
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlled ? controlledOpen : innerOpen;
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");
  const [amountInvalid, setAmountInvalid] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  // Refill the amount whenever the sheet opens, however it was opened (the parent's
  // "Top up to join" button flips `open` without going through setOpen)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && initialAmount) setAmount(String(initialAmount));
  }

  const presetAmounts = [50, 100, 150, 200];

  function setOpen(next: boolean) {
    if (!controlled) setInnerOpen(next);
    onOpenChange?.(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setAmountInvalid(true);
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      let receiptPath: string | undefined;

      if (file) {
        const formData = new FormData();
        formData.append("file", await shrinkReceipt(file));
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          // Keep the sheet open with the file chosen so they can retry or pick another
          const reason = uploadRes.status < 500 ? await uploadRes.text() : "Please try again.";
          toast.error("Couldn't upload the receipt", { description: reason });
          return;
        }
        receiptPath = ((await uploadRes.json()) as { path: string }).path;
      }

      const result = await createTopUpFn({ data: { amount: parseFloat(amount), receiptPath } });
      if (result.type === "BUSINESS_ERROR") {
        toast.error(result.code);
        return;
      }
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setAmountInvalid(false);
      }}
    >
      {!controlled && (
        <DialogTrigger asChild>
          <Button size="sm" className={className}>
            <Plus className="h-4 w-4 mr-1" />
            Top Up
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Top Up</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <img
            src="/duitnow-qr.jpg"
            alt="DuitNow QR code for club top-ups (Lim Siew Ping, Ryt Bank)"
            width={732}
            height={983}
            className="h-auto w-full rounded-lg border"
          />

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
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountInvalid(false);
              }}
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
                onClick={() => {
                  setAmount(preset.toString());
                  setAmountInvalid(false);
                }}
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
                  // Big photos are shrunk on submit; only refuse what can't plausibly fit
                  if (f && f.size > 10 * MAX_RECEIPT_BYTES) {
                    toast.error("That file is too large", { description: "Receipts are max 2 MB" });
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
