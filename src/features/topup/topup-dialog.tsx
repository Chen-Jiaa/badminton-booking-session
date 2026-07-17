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
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTopUpFn } from "@/features/topup/server";

export function TopUpDialog() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountInvalid, setAmountInvalid] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const presetAmounts = [50, 100, 150, 200];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setAmountInvalid(true);
      toast({ title: "Please enter a valid amount", variant: "destructive" });
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

      toast({ title: "Top-up request submitted", description: "Waiting for host approval" });
      setAmount("");
      setFile(null);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } catch {
      toast({ title: "Failed to submit request", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setAmountInvalid(false); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Top Up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Top Up</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="topup-amount">Amount (RM)</Label>
            <Input
              id="topup-amount"
              type="number"
              step="0.01"
              min="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setAmountInvalid(false); }}
              className={cn("mt-1", amountInvalid && "border-red-500 focus-visible:ring-red-500")}
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
                    toast({ title: "File too large (max 5 MB)", variant: "destructive" });
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
