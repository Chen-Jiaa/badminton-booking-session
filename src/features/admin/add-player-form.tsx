import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPlayerFn } from "@/features/admin/server";

interface Player {
  id: string;
  name: string;
  balance: string;
}

interface AddPlayerFormProps {
  sessionId: string;
  availablePlayers: Player[];
}

export function AddPlayerForm({ sessionId, availablePlayers }: AddPlayerFormProps) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function handleAdd() {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const result = await addPlayerFn({ data: { sessionId, userId: selectedUserId } });
      if (result.type !== "SUCCESS") {
        throw new Error(result.type === "BUSINESS_ERROR" ? result.code : "Failed to add player");
      }
      toast({ title: "Player added to session" });
      setSelectedUserId("");
      await queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to add player",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (availablePlayers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">All members are already in this session.</p>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select a player..." />
        </SelectTrigger>
        <SelectContent>
          {availablePlayers.map((player) => (
            <SelectItem key={player.id} value={player.id}>
              {player.name} — RM {parseFloat(player.balance).toFixed(2)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={handleAdd} disabled={!selectedUserId || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      </Button>
    </div>
  );
}
