import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2 } from "lucide-react";
import { createTopUpFn } from "@/features/topup/server";

export function TopUpForm() {
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const presetAmounts = [50, 100, 150, 200];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
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
      await queryClient.invalidateQueries({ queryKey: ["topups"] });
    } catch {
      toast({ title: "Failed to submit request", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="amount">Amount (RM)</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="1"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1"
        />
      </div>

      <div className="flex gap-2">
        {presetAmounts.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAmount(preset.toString())}
          >
            RM {preset}
          </Button>
        ))}
      </div>

      <div>
        <Label htmlFor="receipt">Receipt (optional)</Label>
        <div className="mt-1">
          <label
            htmlFor="receipt"
            className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              {file ? file.name : "Upload receipt photo"}
            </span>
          </label>
          <input
            id="receipt"
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
  );
}
