import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { removeAvatarFn, updateNameFn } from "@/features/profile/server";
import {
  checkAvatarSource,
  cropAvatar,
  ensureAvatarReadable,
  isCustomAvatar,
  type CropArea,
} from "@/features/profile/avatar";
import { AvatarCropper } from "@/features/profile/avatar-cropper";
import { PhoneForm } from "@/features/profile/phone-form";

type Props = {
  name: string;
  email: string | null;
  role: string;
  image: string | null;
  phone: string | null;
};

/** The top profile card: change your photo (tap it), display name and WhatsApp number (pencils). */
export function ProfileHeader({ name, email, role, image, phone }: Props) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  // The name and photo show on the leaderboard, matches and rosters, so refresh everything
  const refresh = () => queryClient.invalidateQueries();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same photo again still fires
    if (!file) return;
    try {
      checkAvatarSource(file);
      await ensureAvatarReadable(file);
      setPicked(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that photo");
    }
  }

  async function uploadCropped(area: CropArea) {
    if (!picked) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", await cropAvatar(picked, area));
      const res = await fetch("/api/avatar", { method: "POST", body });
      if (!res.ok) throw new Error((await res.text()) || "Couldn't upload photo");
      await refresh();
      setPicked(null);
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload photo");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setUploading(true);
    try {
      const result = await removeAvatarFn();
      if (result.type !== "SUCCESS") throw new Error("Couldn't switch photo");
      await refresh();
      toast.success("Back to your Google photo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't switch photo");
    } finally {
      setUploading(false);
    }
  }

  async function saveName() {
    setSaving(true);
    try {
      const result = await updateNameFn({ data: { name: value } });
      if (result.type !== "SUCCESS") {
        throw new Error(result.type === "BUSINESS_ERROR" ? result.code : "Couldn't save name");
      }
      await refresh();
      setEditing(false);
      toast.success("Name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save name");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <button
              type="button"
              aria-label="Change profile photo"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="relative block rounded-full"
            >
              <Avatar className="h-16 w-16">
                <AvatarImage src={image || undefined} />
                <AvatarFallback className="text-lg bg-brand text-brand-foreground">
                  {name.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background">
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </span>
            </button>
            {/* No `capture`: let the phone offer both camera and library */}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPick}
            />
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveName();
                }}
              >
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  maxLength={30}
                  autoFocus
                  autoComplete="name"
                  aria-label="Your name"
                  disabled={saving}
                  onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
                  className="min-w-0 text-base"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !value.trim() || value.trim() === name}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-1">
                <h2 className="truncate text-xl font-semibold">{name}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit name"
                  onClick={() => {
                    setValue(name);
                    setEditing(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">{role}</Badge>
              {isCustomAvatar(image) && !uploading && (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="text-xs text-muted-foreground underline underline-offset-2"
                >
                  Use Google photo
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 border-t pt-3">
          <PhoneForm phone={phone} isHost={role === "HOST" || role === "ADMIN"} />
        </div>
      </CardContent>
      <AvatarCropper
        file={picked}
        saving={uploading}
        onCancel={() => setPicked(null)}
        onSave={uploadCropped}
      />
    </Card>
  );
}
