"use client";

import { SessionForm } from "../session-form";

interface EditSessionFormProps {
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
  onCancel: () => void;
}

export function EditSessionForm({ sessionId, defaultValues, onCancel }: EditSessionFormProps) {
  return (
    <SessionForm
      mode="edit"
      sessionId={sessionId}
      defaultValues={defaultValues}
      onCancel={onCancel}
    />
  );
}
