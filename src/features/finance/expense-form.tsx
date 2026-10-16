import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createExpenseFn } from "@/features/finance/server";

type Category = "COURT_RENTAL" | "SHUTTLES" | "OTHER";

export function AddExpenseButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<Category>("OTHER");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [alreadyPaid, setAlreadyPaid] = useState(true);
  const queryClient = useQueryClient();

  function reset() {
    setCategory("OTHER");
    setAmount("");
    setNote("");
    setAlreadyPaid(true);
  }

  async function handleSubmit() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const result = await createExpenseFn({
        data: {
          category,
          amount: Math.round(parsed * 100) / 100,
          note: note.trim() || undefined,
          paidAt: alreadyPaid ? new Date().toISOString() : undefined,
        },
      });
      if (result.type !== "SUCCESS") throw new Error();
      toast.success("Expense recorded");
      setOpen(false);
      reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "finance-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "cash-flow"] }),
      ]);
    } catch {
      toast.error("Failed to record expense");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="h-4 w-4 mr-1" />
        Add expense
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COURT_RENTAL">Court rental</SelectItem>
                  <SelectItem value="SHUTTLES">Shuttles</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount (RM)</Label>
              <Input
                id="expense-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-note">Note</Label>
              <Input
                id="expense-note"
                placeholder="e.g. 3 tubes of shuttles"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={alreadyPaid}
                onChange={(e) => setAlreadyPaid(e.target.checked)}
              />
              I have already paid this out of pocket
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
