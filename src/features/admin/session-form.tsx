import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CalendarIcon, Plus, Trash2, Share, Copy, Check } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  courtsQueryOptions,
  createAdminSessionFn,
  updateAdminSessionFn,
  createCourtFn,
  deleteCourtFn,
  deleteSessionFn,
} from "@/features/admin/server";

interface SessionDefaultValues {
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
}

interface CreateProps {
  mode: "create";
  sessionId?: never;
  defaultValues?: never;
  onCancel?: never;
  canManageCourts?: boolean;
}

interface EditProps {
  mode: "edit";
  sessionId: string;
  defaultValues: SessionDefaultValues;
  onCancel: () => void;
  canManageCourts?: boolean;
}

type SessionFormProps = CreateProps | EditProps;

const ADD_NEW_COURT_VALUE = "__add_new__";

export function SessionForm({
  mode,
  sessionId,
  defaultValues,
  onCancel,
  canManageCourts = true,
}: SessionFormProps) {
  const isEdit = mode === "edit";
  const router = useRouter();
  const queryClient = useQueryClient();

  const initialStart = defaultValues ? new Date(defaultValues.startTime) : undefined;
  const initialEnd = defaultValues ? new Date(defaultValues.endTime) : undefined;
  const initialRsvp = defaultValues?.rsvpDeadline
    ? new Date(defaultValues.rsvpDeadline)
    : undefined;

  function toTimeString(d: Date) {
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  const [sessionDate, setSessionDate] = useState<Date | undefined>(initialStart);
  const [startTime, setStartTime] = useState<string>(
    initialStart ? toTimeString(initialStart) : "",
  );
  const [endTime, setEndTime] = useState<string>(initialEnd ? toTimeString(initialEnd) : "");
  const [numCourts, setNumCourts] = useState<number | "">(defaultValues?.courts ?? 1);
  const [costPerCourt, setCostPerCourt] = useState(defaultValues?.costPerCourt ?? 60);
  const [location, setLocation] = useState(defaultValues?.location ?? "");
  const [locationMapUrl, setLocationMapUrl] = useState(defaultValues?.locationMapUrl ?? "");
  const [courtNumbers, setCourtNumbers] = useState(defaultValues?.courtNumbers ?? "");
  const [maxPlayers, setMaxPlayers] = useState<number | "">(defaultValues?.maxPlayers ?? 20);
  const [minBalance, setMinBalance] = useState(defaultValues?.minBalance ?? 20);
  const [note, setNote] = useState(defaultValues?.note ?? "");
  const [rsvpDeadline, setRsvpDeadline] = useState<Date | undefined>(initialRsvp);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: courtsList, refetch: refetchCourts } = useSuspenseQuery(courtsQueryOptions());
  const [selectedCourtId, setSelectedCourtId] = useState<string>(() => {
    if (defaultValues?.location) {
      return courtsList.find((c) => c.name === defaultValues.location)?.id ?? "";
    }
    return "";
  });
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [newCourtUrl, setNewCourtUrl] = useState("");
  const [resolvingCourt, setResolvingCourt] = useState(false);

  function handleCourtSelect(value: string) {
    if (value === ADD_NEW_COURT_VALUE) {
      setShowAddCourt(true);
      setSelectedCourtId("");
      setLocation("");
      setLocationMapUrl("");
      return;
    }
    setShowAddCourt(false);
    setSelectedCourtId(value);
    const court = courtsList.find((c) => c.id === value);
    if (court) {
      setLocation(court.name);
      setLocationMapUrl(court.mapUrl);
    }
  }

  async function handleDeleteCourt(id: string) {
    try {
      await deleteCourtFn({ data: { courtId: id } });
      if (selectedCourtId === id) {
        setSelectedCourtId("");
        setLocation("");
        setLocationMapUrl("");
      }
      await refetchCourts();
    } catch {
      toast.error("Failed to delete court");
    }
  }

  async function handleAddCourt() {
    if (!newCourtUrl.trim()) return;
    setResolvingCourt(true);
    try {
      const result = await createCourtFn({ data: { mapUrl: newCourtUrl.trim() } });
      if (result.type !== "SUCCESS") throw new Error();
      const court = result.value;
      await refetchCourts();
      setSelectedCourtId(court.id);
      setLocation(court.name);
      setLocationMapUrl(court.mapUrl);
      setShowAddCourt(false);
      setNewCourtUrl("");
      toast.success(`Added "${court.name}"`);
    } catch {
      toast.error("Failed to add court");
    } finally {
      setResolvingCourt(false);
    }
  }

  function combineDateTime(date: Date, time: string): Date {
    const [h, m] = time.split(":").map(Number);
    const combined = new Date(date);
    combined.setHours(h, m, 0, 0);
    return combined;
  }

  async function handleCancelSession() {
    if (!sessionId) return;
    setCancelling(true);
    try {
      const result = await deleteSessionFn({ data: { sessionId } });
      if (result.type !== "SUCCESS") {
        throw new Error(result.type === "BUSINESS_ERROR" ? result.code : "Failed to cancel session");
      }
      toast.success("Session cancelled and deposits refunded");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] }),
      ]);
      router.navigate({ to: "/sessions" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel session");
    } finally {
      setCancelling(false);
      setShowCancelDialog(false);
    }
  }

  async function handleSubmit() {
    setSubmitted(true);

    const missingRequired =
      !sessionDate ||
      !startTime ||
      !endTime ||
      numCourts === "" ||
      maxPlayers === "" ||
      !courtNumbers.trim() ||
      !location;

    if (missingRequired) {
      toast.error("Please fill in all required fields");
      return;
    }

    const startDateTime = combineDateTime(sessionDate, startTime);
    const endDateTime = combineDateTime(sessionDate, endTime);

    if (endDateTime <= startDateTime) {
      toast.error("End time must be after start time");
      return;
    }

    const payload = {
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      courts: numCourts as number,
      costPerCourt,
      location: location || undefined,
      locationMapUrl: locationMapUrl || undefined,
      courtNumbers: courtNumbers || undefined,
      maxPlayers: maxPlayers as number,
      minBalance,
      note: note || undefined,
      rsvpDeadline: rsvpDeadline?.toISOString(),
    };

    setLoading(true);
    try {
      if (isEdit) {
        const result = await updateAdminSessionFn({ data: { sessionId: sessionId!, ...payload } });
        if (result.type !== "SUCCESS")
          throw new Error(result.type === "BUSINESS_ERROR" ? result.code : "Failed to update");
        toast.success("Session updated");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["sessions"] }),
          queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] }),
          queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] }),
          queryClient.invalidateQueries({ queryKey: ["admin", "sessions", sessionId] }),
        ]);
        onCancel!();
      } else {
        const result = await createAdminSessionFn({ data: payload });
        if (result.type !== "SUCCESS") throw new Error();
        toast.success("Session created");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["sessions"] }),
          queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] }),
        ]);
        setShareUrl(`${window.location.origin}/sessions/${result.value.id}`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isEdit
            ? "Failed to update session"
            : "Failed to create session",
      );
    } finally {
      setLoading(false);
    }
  }

  function closeShareDialog() {
    setShareUrl(null);
    setLinkCopied(false);
    router.history.back();
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  function handleWhatsAppShare() {
    if (!shareUrl) return;
    const message = `Join our badminton session! ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Date</Label>
        <div className="mt-1">
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !sessionDate && "text-muted-foreground",
                  submitted && !sessionDate && "border-destructive",
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
                onSelect={(d) => {
                  if (d) {
                    setSessionDate(d);
                    setDatePickerOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {submitted && !sessionDate && (
            <p className="mt-1 text-xs text-destructive">Date is required</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startTime">Start Time</Label>
          <Input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={cn(
              "mt-1",
              submitted && !startTime && "border-destructive focus-visible:ring-destructive",
            )}
          />
          {submitted && !startTime && (
            <p className="mt-1 text-xs text-destructive">Start time is required</p>
          )}
        </div>
        <div>
          <Label htmlFor="endTime">End Time</Label>
          <Input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={cn(
              "mt-1",
              submitted && !endTime && "border-destructive focus-visible:ring-destructive",
            )}
          />
          {submitted && !endTime && (
            <p className="mt-1 text-xs text-destructive">End time is required</p>
          )}
        </div>
      </div>

      <div>
        <Label>Venue / Location</Label>
        <div className="mt-1">
          <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className={cn(
                  "w-full justify-between font-normal",
                  submitted && !location && "border-destructive",
                )}
              >
                <span className={cn("truncate", !location && "text-muted-foreground")}>
                  {location || "Select a court"}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
              {courtsList.map((court) => (
                <div
                  key={court.id}
                  className={cn(
                    "flex items-center justify-between rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                    selectedCourtId === court.id && "bg-accent font-medium",
                  )}
                >
                  <span
                    className="flex-1 truncate"
                    onClick={() => {
                      handleCourtSelect(court.id);
                      setDropdownOpen(false);
                    }}
                  >
                    {court.name}
                  </span>
                  {canManageCourts && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCourt(court.id);
                      }}
                      className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {canManageCourts && (
                <div
                  className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm cursor-pointer text-brand-foreground hover:bg-accent"
                  onClick={() => {
                    handleCourtSelect(ADD_NEW_COURT_VALUE);
                    setDropdownOpen(false);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add new court
                </div>
              )}
            </PopoverContent>
          </Popover>
          {submitted && !location && (
            <p className="mt-1 text-xs text-destructive">Location is required</p>
          )}
        </div>

        {showAddCourt && (
          // Drops down from the Location picker that revealed it
          <div className="reveal mt-2 flex gap-2" style={{ "--reveal-from": "-4px" } as React.CSSProperties}>
            <Input
              placeholder="Add Google Maps link"
              value={newCourtUrl}
              onChange={(e) => setNewCourtUrl(e.target.value)}
              disabled={resolvingCourt}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleAddCourt}
              disabled={resolvingCourt || !newCourtUrl.trim()}
            >
              {resolvingCourt ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="courts">Courts</Label>
          <Input
            id="courts"
            type="number"
            inputMode="numeric"
            min="1"
            value={numCourts}
            onChange={(e) => {
              const val = e.target.value;
              setNumCourts(val === "" ? "" : parseInt(val));
            }}
            className={cn(
              "mt-1",
              submitted && numCourts === "" && "border-destructive focus-visible:ring-destructive",
            )}
          />
          {submitted && numCourts === "" && (
            <p className="mt-1 text-xs text-destructive">Courts is required</p>
          )}
        </div>
        <div>
          <Label htmlFor="costPerCourt">Cost/Court</Label>
          <div className="mt-1 flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <span className="pl-3 text-sm text-muted-foreground select-none">RM</span>
            <Input
              id="costPerCourt"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={costPerCourt}
              onChange={(e) => setCostPerCourt(parseFloat(e.target.value) || 0)}
              className="border-0 text-right focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="courtNumbers">Court Numbers</Label>
        <Input
          id="courtNumbers"
          type="text"
          value={courtNumbers}
          onChange={(e) => setCourtNumbers(e.target.value)}
          placeholder="e.g., Court 1 & 2"
          className={cn(
            "mt-1",
            submitted &&
              !courtNumbers.trim() &&
              "border-destructive focus-visible:ring-destructive",
          )}
        />
        {submitted && !courtNumbers.trim() && (
          <p className="mt-1 text-xs text-destructive">Court numbers is required</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="maxPlayers">Max Players</Label>
          <Input
            id="maxPlayers"
            type="number"
            inputMode="numeric"
            min="1"
            value={maxPlayers}
            onChange={(e) => {
              const val = e.target.value;
              setMaxPlayers(val === "" ? "" : parseInt(val));
            }}
            className={cn(
              "mt-1",
              submitted && maxPlayers === "" && "border-destructive focus-visible:ring-destructive",
            )}
          />
          {submitted && maxPlayers === "" && (
            <p className="mt-1 text-xs text-destructive">Max Players is required</p>
          )}
        </div>
        <div>
          <Label htmlFor="minBalance">Min Balance to Join</Label>
          <div className="mt-1 flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <span className="pl-3 text-sm text-muted-foreground select-none">RM</span>
            <Input
              id="minBalance"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={minBalance}
              onChange={(e) => setMinBalance(parseFloat(e.target.value) || 0)}
              className="border-0 text-right focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
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
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g., Backup venue if rain"
          className="mt-1"
        />
      </div>

      <div className={cn("flex gap-2", !isEdit && "")}>
        {isEdit && (
          <Button variant="outline" onClick={onCancel} className="flex-1" disabled={loading}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          className={cn(isEdit ? "flex-1" : "w-full")}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {isEdit ? "Save Changes" : loading ? "Creating..." : "Create Session"}
        </Button>
      </div>

      {isEdit && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
          </div>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setShowCancelDialog(true)}
            disabled={loading || cancelling}
          >
            Cancel Session
          </Button>

          <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel Session?</DialogTitle>
                <DialogDescription>
                  This will permanently delete the session and refund all deposits back to players.
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={cancelling}>
                  Keep Session
                </Button>
                <Button variant="destructive" onClick={handleCancelSession} disabled={cancelling}>
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Cancel Session"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      <Dialog open={shareUrl !== null} onOpenChange={(open) => !open && closeShareDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session created!</DialogTitle>
            <DialogDescription>
              Share the link with players so they can RSVP and join.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={shareUrl ?? ""} className="flex-1" />
            <Button type="button" variant="outline" size="icon" onClick={handleCopyLink}>
              {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]"
              onClick={handleWhatsAppShare}
            >
              <Share className="mr-2 h-4 w-4" />
              Share on WhatsApp
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={closeShareDialog}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
