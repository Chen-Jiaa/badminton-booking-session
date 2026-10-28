import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, MessageCircle, Pencil } from "lucide-react";
import { updatePhoneFn } from "@/features/profile/server";

/** Everyone's WhatsApp number, so admins can reach them (and players can reach hosts). Sits inside the profile header card. */
export function PhoneForm({ phone, isHost = false }: { phone: string | null; isHost?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const dirty = value.trim() !== (phone ?? "");

  async function save() {
    setSaving(true);
    try {
      const result = await updatePhoneFn({ data: { phone: value } });
      if (result.type !== "SUCCESS") {
        throw new Error(result.type === "BUSINESS_ERROR" ? result.code : "Couldn't save number");
      }
      setValue(result.value.phone ?? "");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["current-user"] }),
      ]);
      setEditing(false);
      toast.success(result.value.phone ? "WhatsApp number saved" : "WhatsApp number removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save number");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className={phone ? "truncate" : "truncate text-muted-foreground"}>
          {phone ?? "Add WhatsApp number"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit WhatsApp number"
          className="ml-auto h-8 w-8"
          onClick={() => {
            setValue(phone ?? "");
            setEditing(true);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="012-345 6789"
          aria-label="WhatsApp number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          disabled={saving}
          autoFocus
          className="min-w-0 text-base"
        />
        <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {isHost
          ? "Admins and players in your sessions can WhatsApp you."
          : "Only admins and hosts can see this."}
      </p>
    </div>
  );
}
