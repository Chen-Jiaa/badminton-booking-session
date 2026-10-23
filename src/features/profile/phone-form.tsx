import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updatePhoneFn } from "@/features/profile/server";

/** Everyone's WhatsApp number, so admins can reach them (and players can reach hosts). */
export function PhoneForm({ phone, isHost = false }: { phone: string | null; isHost?: boolean }) {
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
      toast.success(result.value.phone ? "WhatsApp number saved" : "WhatsApp number removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save number");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">WhatsApp number</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
          />
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          {isHost
            ? "Admins and players in your sessions can WhatsApp you."
            : "Only admins and hosts can see this."}
        </p>
      </CardContent>
    </Card>
  );
}
