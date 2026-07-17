import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { lockSessionFn } from "@/features/admin/server";

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
  const [shuttleCount, setShuttleCount] = useState(0);
  const [shuttleCost, setShuttleCost] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const courtCost = courts * costPerCourt;
  const totalCost = courtCost + shuttleCost;
  const costPerPlayer = playerCount > 0 ? totalCost / playerCount : 0;

  async function handleLock() {
    setLoading(true);
    try {
      const result = await lockSessionFn({ data: { sessionId, shuttleCount, shuttleCost } });
      if (result.type !== "SUCCESS") {
        throw new Error(
          result.type === "BUSINESS_ERROR" ? result.code : "Failed to finalize session",
        );
      }
      toast({ title: "Session finalized and costs deducted" });
      await queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to finalize session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="shuttleCount">Shuttles Used</Label>
        <Input
          id="shuttleCount"
          type="number"
          step="1"
          min="0"
          value={shuttleCount}
          onChange={(e) => setShuttleCount(parseInt(e.target.value, 10) || 0)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="shuttleCost">Total Shuttle Cost (RM)</Label>
        <Input
          id="shuttleCost"
          type="number"
          step="0.01"
          min="0"
          value={shuttleCost}
          onChange={(e) => setShuttleCost(parseFloat(e.target.value) || 0)}
          className="mt-1"
          placeholder="0.00"
        />
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>
            Court cost ({courts} × {formatCurrency(costPerCourt)})
          </span>
          <span>{formatCurrency(courtCost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Shuttle cost ({shuttleCount} used)</span>
          <span>{formatCurrency(shuttleCost)}</span>
        </div>
        <div className="flex justify-between font-medium border-t pt-2">
          <span>Total</span>
          <span>{formatCurrency(totalCost)}</span>
        </div>
        <div className="flex justify-between text-brand-foreground font-semibold">
          <span>Per player ({playerCount} players)</span>
          <span>{formatCurrency(costPerPlayer)}</span>
        </div>
      </div>

      <Button onClick={handleLock} className="w-full" disabled={loading || playerCount === 0}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Finalizing...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Finalize Session &amp; Deduct from Balances
          </>
        )}
      </Button>
    </div>
  );
}
