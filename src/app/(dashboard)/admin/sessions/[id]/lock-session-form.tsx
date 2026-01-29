"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface LockSessionFormProps {
  sessionId: string;
  courts: number;
  costPerCourt: number;
  playerCount: number;
}

export function LockSessionForm({
  sessionId,
  courts,
  costPerCourt,
  playerCount,
}: LockSessionFormProps) {
  const [shuttleTubes, setShuttleTubes] = useState(0);
  const [costPerTube, setCostPerTube] = useState(15);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const courtCost = courts * costPerCourt;
  const shuttleCost = shuttleTubes * costPerTube;
  const totalCost = courtCost + shuttleCost;
  const costPerPlayer = playerCount > 0 ? totalCost / playerCount : 0;

  async function handleLock() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shuttleTubes, costPerTube }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Session locked and costs deducted" });
      router.refresh();
    } catch {
      toast({ title: "Failed to lock session", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="shuttleTubes">Shuttle Tubes Used</Label>
          <Input
            id="shuttleTubes"
            type="number"
            min="0"
            value={shuttleTubes}
            onChange={(e) => setShuttleTubes(parseInt(e.target.value) || 0)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="costPerTube">Cost/Tube (RM)</Label>
          <Input
            id="costPerTube"
            type="number"
            step="0.01"
            min="0"
            value={costPerTube}
            onChange={(e) => setCostPerTube(parseFloat(e.target.value) || 0)}
            className="mt-1"
          />
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Court cost ({courts} × {formatCurrency(costPerCourt)})</span>
          <span>{formatCurrency(courtCost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Shuttle cost ({shuttleTubes} × {formatCurrency(costPerTube)})</span>
          <span>{formatCurrency(shuttleCost)}</span>
        </div>
        <div className="flex justify-between font-medium border-t pt-2">
          <span>Total</span>
          <span>{formatCurrency(totalCost)}</span>
        </div>
        <div className="flex justify-between text-green-600 font-semibold">
          <span>Per player ({playerCount} players)</span>
          <span>{formatCurrency(costPerPlayer)}</span>
        </div>
      </div>

      <Button onClick={handleLock} className="w-full" disabled={loading || playerCount === 0}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Locking...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Lock Session & Deduct from Balances
          </>
        )}
      </Button>
    </div>
  );
}
