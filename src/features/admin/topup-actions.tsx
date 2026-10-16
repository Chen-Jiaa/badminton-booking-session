import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { confirmTopUpFn, rejectTopUpFn } from "@/features/admin/server";

export function TopUpActions({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const queryClient = useQueryClient();

  async function handleConfirm() {
    setLoading(true);
    try {
      const result = await confirmTopUpFn({ data: { requestId } });
      if (result.type !== "SUCCESS") {
        toast.error("Failed to confirm", {
          description: result.type === "BUSINESS_ERROR" ? result.code : undefined,
        });
        return;
      }
      toast.success("Top-up confirmed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "topups"] }),
        queryClient.invalidateQueries({ queryKey: ["current-user"] }),
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
      ]);
    } catch {
      toast.error("Failed to confirm");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setLoading(true);
    try {
      const result = await rejectTopUpFn({ data: { requestId, reason: rejectReason } });
      if (result.type !== "SUCCESS") throw new Error();
      toast.success("Top-up rejected");
      setShowRejectDialog(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "topups"] }),
        queryClient.invalidateQueries({ queryKey: ["current-user"] }),
      ]);
    } catch {
      toast.error("Failed to reject");
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
          Confirm
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
            <DialogTitle>Reject Top-Up</DialogTitle>
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
