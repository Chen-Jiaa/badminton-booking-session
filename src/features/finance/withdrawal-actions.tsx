import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { confirmWithdrawalFn, rejectWithdrawalFn } from "@/features/withdrawal/server";

export function WithdrawalActions({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "withdrawals"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "cash-flow"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "member-totals"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "members"] }),
      queryClient.invalidateQueries({ queryKey: ["current-user"] }),
      queryClient.invalidateQueries({ queryKey: ["wallet"] }),
    ]);
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const result = await confirmWithdrawalFn({ data: { requestId } });
      if (result.type !== "SUCCESS") {
        const isInsufficient =
          result.type === "BUSINESS_ERROR" && result.code === "INSUFFICIENT_BALANCE";
        toast({
          title: isInsufficient ? "Member no longer has enough balance" : "Failed to confirm",
          description:
            result.type === "BUSINESS_ERROR" && !isInsufficient ? result.code : undefined,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Withdrawal marked as paid" });
      await refresh();
    } catch {
      toast({ title: "Failed to confirm", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast({ title: "Please provide a reason", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await rejectWithdrawalFn({ data: { requestId, reason: rejectReason } });
      if (result.type !== "SUCCESS") throw new Error();
      toast({ title: "Withdrawal rejected" });
      setShowRejectDialog(false);
      await refresh();
    } catch {
      toast({ title: "Failed to reject", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={handleConfirm} disabled={loading} className="flex-1">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Mark Paid
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowRejectDialog(true)}
          disabled={loading}
          className="flex-1"
        >
          <X className="h-4 w-4 mr-1" />
          Reject
        </Button>
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Reason for rejection"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
