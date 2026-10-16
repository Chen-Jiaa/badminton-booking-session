import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { lockSessionFn, shuttleSuppliersQueryOptions } from "@/features/admin/server";

const CLUB_STOCK = "CLUB_STOCK";

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
  const [shuttleCost, setShuttleCost] = useState("0");
  const [shuttleCount, setShuttleCount] = useState("0");
  const [supplier, setSupplier] = useState<string>(CLUB_STOCK);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: members = [] } = useQuery(shuttleSuppliersQueryOptions());

  const parsedShuttleCost = parseFloat(shuttleCost) || 0;
  const parsedShuttleCount = parseInt(shuttleCount, 10) || 0;
  const courtCost = courts * costPerCourt;
  const totalCost = courtCost + parsedShuttleCost;
  const costPerPlayer = playerCount > 0 ? totalCost / playerCount : 0;

  async function handleLock() {
    setLoading(true);
    try {
      const result = await lockSessionFn({
        data: {
          sessionId,
          shuttleCount: parsedShuttleCount,
          shuttleCost: parsedShuttleCost,
          shuttleSupplierId: supplier === CLUB_STOCK ? null : supplier,
        },
      });
      if (result.type !== "SUCCESS") {
        throw new Error(
          result.type === "BUSINESS_ERROR" ? result.code : "Failed to finalize session",
        );
      }
      toast.success("Session finalized and costs deducted");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["current-user"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "sessions", sessionId] }),
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to finalize session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="shuttleCount">Shuttles Used</Label>
          <Input
            id="shuttleCount"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={shuttleCount}
            onChange={(e) => setShuttleCount(e.target.value)}
            className="mt-1"
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="shuttleCost">Total Shuttle Cost (RM)</Label>
          <Input
            id="shuttleCost"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={shuttleCost}
            onChange={(e) => setShuttleCost(e.target.value)}
            className="mt-1"
            placeholder="0.00"
          />
        </div>
      </div>

      {parsedShuttleCost > 0 && (
        <div>
          <Label>Shuttles supplied by</Label>
          <Select value={supplier} onValueChange={setSupplier}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CLUB_STOCK}>Club stock (already purchased)</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} — brought their own
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {supplier === CLUB_STOCK
              ? "Players are charged, and it counts against shuttles already bought for the club."
              : "Recorded as money they're owed back."}
          </p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>
            Court cost ({courts} × {formatCurrency(costPerCourt)})
          </span>
          <span>{formatCurrency(courtCost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>
            Shuttle cost{parsedShuttleCount > 0 ? ` (${parsedShuttleCount})` : ""}
          </span>
          <span>{formatCurrency(parsedShuttleCost)}</span>
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
