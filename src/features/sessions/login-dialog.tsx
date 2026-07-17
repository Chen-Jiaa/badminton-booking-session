import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoginButtons } from "@/features/auth/login-buttons";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-background flex items-center justify-center">
            <span className="text-xl">🏸</span>
          </div>
          <DialogTitle className="text-center">Sign in to RSVP</DialogTitle>
        </DialogHeader>
        <LoginButtons />
      </DialogContent>
    </Dialog>
  );
}
