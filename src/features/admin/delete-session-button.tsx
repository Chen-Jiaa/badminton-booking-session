import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSessionFn } from "@/features/admin/server";

interface DeleteSessionDialogProps {
  sessionId: string;
  isLocked?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteSessionDialog({
  sessionId,
  isLocked,
  open,
  onOpenChange,
}: DeleteSessionDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const result = await deleteSessionFn({ data: { sessionId } });
      if (result.type !== "SUCCESS") {
        throw new Error(result.type === "BUSINESS_ERROR" ? result.code : "Failed to delete");
      }
      toast.success("Session deleted");
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] }),
      ]);
      navigate({ to: "/admin/sessions" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete session");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Session</DialogTitle>
          <DialogDescription>
            {isLocked
              ? "This session is locked. Deleting it will reverse any balance deductions made to players. This action cannot be undone."
              : "Are you sure you want to delete this session? This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Trash icon for session list rows */
export function DeleteSessionButton({
  sessionId,
  isLocked,
}: {
  sessionId: string;
  isLocked?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete session"
        className="h-10 w-10 text-destructive hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <DeleteSessionDialog
        sessionId={sessionId}
        isLocked={isLocked}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
