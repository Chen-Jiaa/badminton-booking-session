import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updatePhoneFn } from "@/features/profile/server";

/** Hosts' WhatsApp number, so players can message them from a session page. */
export function PhoneForm({ phone }: { phone: string | null }) {
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
      <CardHeader>
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
          Players in your sessions can WhatsApp you from the session page.
        </p>
      </CardContent>
    </Card>
  );
}
