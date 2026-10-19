import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Link2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteSessionDialog } from "@/features/admin/delete-session-button";

interface SessionActionsMenuProps {
  sessionId: string;
  isLocked: boolean;
  /** Where "Duplicate" opens the prefilled form: the console or the player-side one */
  duplicateTo: "/admin/sessions/new" | "/sessions/new";
  canDelete?: boolean;
}

/** The ⋯ next to Edit: the occasional session actions, with Delete last. */
export function SessionActionsMenu({
  sessionId,
  isLocked,
  duplicateTo,
  canDelete = false,
}: SessionActionsMenuProps) {
  const [deleting, setDeleting] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sessions/${sessionId}`);
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={copyLink}>
            <Link2 />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={duplicateTo} search={{ from: sessionId }}>
              <Copy />
              Duplicate
            </Link>
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleting(true)}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 />
                Delete session
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canDelete && (
        <DeleteSessionDialog
          sessionId={sessionId}
          isLocked={isLocked}
          open={deleting}
          onOpenChange={setDeleting}
        />
      )}
    </>
  );
}
