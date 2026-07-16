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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deleteSessionFn } from "@/features/admin/server";

interface DeleteSessionButtonProps {
  sessionId: string;
  isLocked?: boolean;
  variant?: "icon" | "full";
}

export function DeleteSessionButton({
  sessionId,
  isLocked,
  variant = "full",
}: DeleteSessionButtonProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const result = await deleteSessionFn({ data: { sessionId } });
      if (result.type !== "SUCCESS") {
        throw new Error(result.type === "BUSINESS_ERROR" ? result.code : "Failed to delete");
      }
      toast({ title: "Session deleted" });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate({ to: "/admin/sessions" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to delete session",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Session
          </Button>
        )}
      </DialogTrigger>
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
          <Button variant="outline" onClick={() => setOpen(false)}>
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
