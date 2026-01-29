"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2 } from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function NewSessionPage() {
  const [loading, setLoading] = useState(false);
  const [sessionDate, setSessionDate] = useState<Date>();
  const [startTime, setStartTime] = useState<{ hour: number; minute: number }>();
  const [endTime, setEndTime] = useState<{ hour: number; minute: number }>();
  const [rsvpDeadline, setRsvpDeadline] = useState<Date>();
  const { toast } = useToast();
  const router = useRouter();

  function combineDateTime(date: Date, time: { hour: number; minute: number }): Date {
    const combined = new Date(date);
    combined.setHours(time.hour, time.minute, 0, 0);
    return combined;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!sessionDate || !startTime || !endTime) {
      toast({ title: "Please select date and times", variant: "destructive" });
      return;
    }

    const startDateTime = combineDateTime(sessionDate, startTime);
    const endDateTime = combineDateTime(sessionDate, endTime);

    if (endDateTime <= startDateTime) {
      toast({ title: "End time must be after start time", variant: "destructive" });
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      courts: parseInt(formData.get("courts") as string),
      costPerCourt: parseFloat(formData.get("costPerCourt") as string),
      rsvpDeadline: rsvpDeadline?.toISOString(),
      note: formData.get("note") || undefined,
    };

    try {
      const res = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Session created" });
      router.push("/admin/sessions");
    } catch {
      toast({ title: "Failed to create session", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Create Session</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Date</Label>
              <div className="mt-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !sessionDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {sessionDate ? format(sessionDate, "EEEE, MMMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={sessionDate}
                      onSelect={setSessionDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <div className="mt-1">
                  <TimePicker
                    value={startTime}
                    onChange={setStartTime}
                    placeholder="Start"
                  />
                </div>
              </div>
              <div>
                <Label>End Time</Label>
                <div className="mt-1">
                  <TimePicker
                    value={endTime}
                    onChange={setEndTime}
                    placeholder="End"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="courts">Courts</Label>
                <Input
                  id="courts"
                  name="courts"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="costPerCourt">Cost/Court (RM)</Label>
                <Input
                  id="costPerCourt"
                  name="costPerCourt"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="60"
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>RSVP Deadline (optional)</Label>
              <div className="mt-1">
                <DateTimePicker
                  value={rsvpDeadline}
                  onChange={setRsvpDeadline}
                  placeholder="Select RSVP deadline"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                name="note"
                type="text"
                placeholder="e.g., Backup venue if rain"
                className="mt-1"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Session"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
