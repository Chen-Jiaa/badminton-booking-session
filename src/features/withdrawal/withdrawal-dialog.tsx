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
import { ArrowDownCircle, Loader2 } from "lucide-react";
import { createWithdrawalFn } from "@/features/withdrawal/server";

interface WithdrawalDialogProps {
  balance: number;
}

export function WithdrawalDialog({ balance }: WithdrawalDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    if (parsed > balance) {
      toast({ title: "Amount exceeds your current balance", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await createWithdrawalFn({
        data: { amount: parsed, note: note || undefined },
      });
      if (result.type === "BUSINESS_ERROR") {
        if (result.code === "INSUFFICIENT_BALANCE") {
          toast({ title: "Insufficient balance", variant: "destructive" });
        } else if (result.code === "PENDING_EXISTS") {
          toast({
            title: "You already have a pending withdrawal request",
            variant: "destructive",
          });
        } else {
          toast({ title: "Failed to submit request", variant: "destructive" });
        }
        return;
      }
      toast({ title: "Withdrawal request submitted", description: "Waiting for host approval" });
      setAmount("");
      setNote("");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } catch {
      toast({ title: "Failed to submit request", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowDownCircle className="h-4 w-4 mr-1" />
          Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="withdrawal-amount">Amount (RM)</Label>
            <Input
              id="withdrawal-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={balance}
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available balance: RM {balance.toFixed(2)}
            </p>
          </div>
          <div>
            <Label htmlFor="withdrawal-note">Note (optional)</Label>
            <Input
              id="withdrawal-note"
              type="text"
              placeholder="e.g. Bank transfer, PayNow"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Withdrawal Request"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
