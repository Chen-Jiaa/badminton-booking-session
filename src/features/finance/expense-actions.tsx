import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import {
  deleteExpenseFn,
  markExpensePaidFn,
  markExpenseReimbursedFn,
} from "@/features/finance/server";
import type { ExpenseStatus } from "@/features/finance/format";

export function ExpenseActions({
  expenseId,
  status,
}: {
  expenseId: string;
  status: ExpenseStatus;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function run(action: () => Promise<{ type: string; code?: string }>, success: string) {
    setLoading(true);
    try {
      const result = await action();
      if (result.type !== "SUCCESS") {
        toast({
          title: result.type === "BUSINESS_ERROR" ? result.code! : "Something went wrong",
          variant: "destructive",
        });
        return;
      }
      toast({ title: success });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "finance-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "cash-flow"] }),
      ]);
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "UNPAID" && (
        <Button
          size="sm"
          disabled={loading}
          onClick={() =>
            run(() => markExpensePaidFn({ data: { expenseId, paid: true } }), "Marked as paid")
          }
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark paid"}
        </Button>
      )}

      {status === "PAID" && (
        <>
          <Button
            size="sm"
            disabled={loading}
            onClick={() =>
              run(
                () => markExpenseReimbursedFn({ data: { expenseId, reimbursed: true } }),
                "Marked as reimbursed",
              )
            }
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark reimbursed"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() =>
              run(() => markExpensePaidFn({ data: { expenseId, paid: false } }), "Marked as unpaid")
            }
          >
            Undo paid
          </Button>
        </>
      )}

      {status === "REIMBURSED" && (
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() =>
            run(
              () => markExpenseReimbursedFn({ data: { expenseId, reimbursed: false } }),
              "Reimbursement undone",
            )
          }
        >
          Undo reimbursed
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" disabled={loading} aria-label="Delete expense">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete expense</DialogTitle>
            <DialogDescription>
              This removes the expense from the finance figures. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={async () => {
                await run(() => deleteExpenseFn({ data: { expenseId } }), "Expense deleted");
                setConfirmOpen(false);
              }}
            >
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
