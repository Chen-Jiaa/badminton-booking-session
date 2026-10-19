import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyIcon } from "@/components/copy-icon";
import { toast } from "sonner";

export function ShareButton({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sessions/${sessionId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      <CopyIcon copied={copied} />
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
