import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { createManualAdjustFn } from "@/features/finance/server";
import { formatCurrency } from "@/lib/utils";

/**
 * Credits or debits a member's wallet by hand. Every adjustment writes a ledger
 * row, so a note is mandatory — this is the one balance change with no
 * top-up or session behind it to explain itself.
 */
export function AdjustBalanceDialog({
  userId,
  memberName,
  balance,
}: {
  userId: string;
  memberName: string;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const parsed = parseFloat(amount);
  const valid = !Number.isNaN(parsed) && parsed !== 0 && note.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;

    setLoading(true);
    try {
      const result = await createManualAdjustFn({
        data: { userId, amount: Math.round(parsed * 100) / 100, note: note.trim() },
      });
      if (result.type !== "SUCCESS") {
        toast({
          title: result.type === "BUSINESS_ERROR" ? result.code : "Something went wrong",
          variant: "destructive",
        });
        return;
      }

      toast({ title: `Balance adjusted by ${formatCurrency(parsed)}` });
      setOpen(false);
      setAmount("");
      setNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "member-detail", userId] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "member-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "member-totals"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "finance-summary"] }),
      ]);
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Adjust balance
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {memberName}&rsquo;s balance</DialogTitle>
          <DialogDescription>
            Currently {formatCurrency(balance)}. Use a negative amount to deduct.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjust-amount">Amount (RM)</Label>
            <Input
              id="adjust-amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. -15.00"
            />
            {!Number.isNaN(parsed) && parsed !== 0 && (
              <p className="text-xs text-muted-foreground">
                New balance will be {formatCurrency(balance + parsed)}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-note">Reason</Label>
            <Input
              id="adjust-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this being adjusted?"
            />
          </div>
          <Button type="submit" disabled={!valid || loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save adjustment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
