"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DISMISS_DISTANCE = 100; // px
const DISMISS_VELOCITY = 0.5; // px/ms
const FLICK_MIN_DISTANCE = 10; // px; a flick must actually move the sheet down

/**
 * Drag handle for the mobile bottom sheet. The sheet tracks the finger 1:1,
 * then either dismisses (far enough, or flicked fast enough) or springs back.
 */
function SheetHandle({ sheetRef }: { sheetRef: React.RefObject<HTMLElement | null> }) {
  const drag = React.useRef<{ startY: number; lastY: number; lastT: number; v: number } | null>(
    null,
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const sheet = sheetRef.current;
    if (!d || !sheet) return;
    const dt = Math.max(e.timeStamp - d.lastT, 1);
    d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = e.clientY - d.startY;
    // Rubber-band when pulled upward instead of moving past the top edge
    sheet.style.transform = `translateY(${dy > 0 ? dy : dy * 0.15}px)`;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const sheet = sheetRef.current;
    drag.current = null;
    if (!d || !sheet) return;
    const dy = e.clientY - d.startY;
    if (dy > DISMISS_DISTANCE || (dy > FLICK_MIN_DISTANCE && d.v > DISMISS_VELOCITY)) {
      sheet.style.transition = "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)";
      sheet.style.transform = "translateY(100%)";
      window.setTimeout(() => {
        sheet.querySelector<HTMLButtonElement>("[data-sheet-close]")?.click();
      }, 180);
    } else {
      sheet.style.transition = "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)";
      sheet.style.transform = "";
    }
  };

  return (
    <div
      aria-hidden
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute inset-x-0 top-0 z-10 flex h-8 cursor-grab touch-none justify-center pt-2 sm:hidden"
    >
      <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
    </div>
  );
}

const TEXT_ENTRY =
  "input:not([type=checkbox],[type=radio],[type=file],[type=button],[type=submit],[type=range],[type=color]), textarea, select, [contenteditable=true]";
const HANDLE_HEIGHT = 32; // px; the drag handle strip at the top of the sheet

/**
 * Scrolls the focused field to the middle of whatever part of the sheet is still
 * on screen, so its label above and any controls just below stay visible too.
 * Does nothing while the field is already comfortably in view.
 */
function revealFocusedField(sheet: HTMLElement) {
  const field = document.activeElement;
  if (!(field instanceof HTMLElement) || !sheet.contains(field) || !field.matches(TEXT_ENTRY)) {
    return;
  }
  const vv = window.visualViewport;
  const sheetRect = sheet.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  const visibleTop = Math.max(sheetRect.top + HANDLE_HEIGHT, vv?.offsetTop ?? 0);
  const visibleBottom = Math.min(
    sheetRect.bottom,
    vv ? vv.offsetTop + vv.height : window.innerHeight,
  );
  const margin = 12;
  if (fieldRect.top >= visibleTop + margin && fieldRect.bottom <= visibleBottom - margin) return;
  const delta = (fieldRect.top + fieldRect.bottom) / 2 - (visibleTop + visibleBottom) / 2;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  sheet.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
}

/**
 * Keeps the mobile bottom sheet above the on-screen keyboard. iOS Safari ignores
 * `interactive-widget=resizes-content`, so the keyboard overlays fixed elements;
 * the visual viewport is the only reliable signal of how much screen is left.
 * Exposes `--kb-inset` (distance from layout bottom to keyboard top) and
 * `--sheet-max-h` (90% of the visible area) on the sheet element, and scrolls
 * the field being typed into back into view once the keyboard has opened.
 */
function useKeyboardInset(sheetRef: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let frame = 0;
    let timer = 0;
    const reveal = () => {
      cancelAnimationFrame(frame);
      // Wait a frame so the sheet has moved/shrunk before measuring
      frame = requestAnimationFrame(() => {
        if (sheetRef.current) revealFocusedField(sheetRef.current);
      });
    };
    const update = () => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const inset = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
      sheet.style.setProperty("--kb-inset", `${inset}px`);
      sheet.style.setProperty("--sheet-max-h", `${Math.round(vv.height * 0.9)}px`);
    };
    const onResize = () => {
      update();
      reveal();
    };
    // Covers switching fields with the keyboard already up, and browsers that
    // report the keyboard late (iOS fires `resize` only once it has settled)
    const onFocusIn = () => {
      reveal();
      window.clearTimeout(timer);
      timer = window.setTimeout(reveal, 400);
    };
    update();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [sheetRef]);
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onOpenAutoFocus, ...props }, ref) => {
  const sheetRef = React.useRef<HTMLDivElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      sheetRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );
  useKeyboardInset(sheetRef);

  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={setRefs}
      className={cn(
        // Mobile: bottom sheet anchored to the bottom edge. sm+: centered dialog.
        "fixed inset-x-0 bottom-[var(--kb-inset,0px)] mx-auto z-50 outline-none grid w-full gap-4 border bg-background p-6 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-lg duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-y-auto overflow-x-hidden max-h-[var(--sheet-max-h,90svh)] touch-pan-y overscroll-contain rounded-t-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:max-h-[90svh] sm:left-1/2 sm:top-1/2 sm:mx-0 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6 sm:duration-200 sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
        className,
      )}
      onOpenAutoFocus={(e) => {
        onOpenAutoFocus?.(e);
        // On touch devices, focusing the first field would pop the keyboard the
        // moment the sheet opens. Focus the sheet itself; the keyboard comes up
        // only when the user taps a field.
        if (!e.defaultPrevented && window.matchMedia("(pointer: coarse)").matches) {
          e.preventDefault();
          sheetRef.current?.focus({ preventScroll: true });
        }
      }}
      {...props}
    >
      <SheetHandle sheetRef={sheetRef} />
      {children}
      <DialogPrimitive.Close data-sheet-close="" className="absolute right-4 top-4 z-20 rounded-sm p-2 -m-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
