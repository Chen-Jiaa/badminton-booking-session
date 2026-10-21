import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { type CropArea } from "@/features/profile/avatar";

/** Drag to move and pinch (or slide) to zoom, inside a round frame; Save hands back the square. */
export function AvatarCropper({
  file,
  saving,
  onCancel,
  onSave,
}: {
  file: File | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (area: CropArea) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="gap-4 px-4 focus:outline-none">
        <DialogTitle className="text-center">Adjust photo</DialogTitle>
        <DialogDescription className="sr-only">
          Drag the photo to move it and pinch or use the slider to zoom.
        </DialogDescription>

        {/* touch-action is set by the cropper, so dragging here doesn't scroll the page */}
        <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-lg bg-black">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="w-full accent-[var(--color-brand-foreground)]"
        />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => area && onSave(area)} disabled={saving || !area}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save photo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
