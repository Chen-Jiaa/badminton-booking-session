"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { EditSessionForm } from "./edit-session-form";

interface EditSessionToggleProps {
  sessionId: string;
  defaultValues: {
    startTime: string;
    endTime: string;
    courts: number;
    costPerCourt: number;
    location: string | null;
    locationMapUrl: string | null;
    courtNumbers: string | null;
    maxPlayers: number;
    minBalance: number;
    note: string | null;
    rsvpDeadline?: string | null;
  };
}

export function EditSessionToggle({ sessionId, defaultValues }: EditSessionToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 mr-1" />
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
          </DialogHeader>
          <EditSessionForm
            sessionId={sessionId}
            defaultValues={defaultValues}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
