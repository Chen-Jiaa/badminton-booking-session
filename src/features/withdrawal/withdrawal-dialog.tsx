import { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowDownCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createWithdrawalFn,
  savedPaymentDetailsQueryOptions,
  withdrawableQueryOptions,
} from "@/features/withdrawal/server";

interface WithdrawalDialogProps {
  balance: number;
  className?: string;
}

export function WithdrawalDialog({ balance, className }: WithdrawalDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountInvalid, setAmountInvalid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"BANK" | "DUITNOW">("BANK");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [duitnowPhone, setDuitnowPhone] = useState("");
  const [loading, setLoading] = useState(false);
  // Only fade fields in when the player switches method, not when the sheet opens
  const [methodSwitched, setMethodSwitched] = useState(false);
  const queryClient = useQueryClient();

  const { data: savedDetails } = useQuery(savedPaymentDetailsQueryOptions());
  const { data: withdrawable, refetch: refetchWithdrawable } = useQuery(withdrawableQueryOptions());

  // How much can still be requested = balance − already-pending requests.
  // Falls back to the passed balance until the fresh figure loads.
  const available = withdrawable ? parseFloat(withdrawable.available) : balance;
  const pending = withdrawable ? parseFloat(withdrawable.pending) : 0;

  const parsed = parseFloat(amount);
  const amountExceedsBalance = amount !== "" && !isNaN(parsed) && parsed > available;

  useEffect(() => {
    if (savedDetails?.duitnowPhone && paymentMethod === "DUITNOW" && !duitnowPhone) {
      setDuitnowPhone(savedDetails.duitnowPhone);
    }
    if (savedDetails?.bankName && paymentMethod === "BANK" && !bankName) {
      setBankName(savedDetails.bankName);
    }
    if (savedDetails?.accountNumber && paymentMethod === "BANK" && !accountNumber) {
      setAccountNumber(savedDetails.accountNumber);
    }
  }, [savedDetails, paymentMethod]);

  function handlePaymentMethodChange(value: "BANK" | "DUITNOW") {
    setPaymentMethod(value);
    setMethodSwitched(true);
    if (value === "DUITNOW" && savedDetails?.duitnowPhone && !duitnowPhone) {
      setDuitnowPhone(savedDetails.duitnowPhone);
    }
    if (value === "BANK") {
      if (savedDetails?.bankName && !bankName) setBankName(savedDetails.bankName);
      if (savedDetails?.accountNumber && !accountNumber) setAccountNumber(savedDetails.accountNumber);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setAmountInvalid(true);
      toast.error("Please enter a valid amount");
      return;
    }
    if (amountExceedsBalance) {
      toast.error("Amount exceeds what you can withdraw");
      return;
    }

    if (paymentMethod === "BANK") {
      if (!bankName.trim()) {
        toast.error("Please enter a bank name");
        return;
      }
      if (!accountNumber.trim()) {
        toast.error("Please enter an account number");
        return;
      }
    } else {
      if (!duitnowPhone.trim()) {
        toast.error("Please enter a phone number");
        return;
      }
    }

    setLoading(true);
    try {
      const result = await createWithdrawalFn({
        data:
          paymentMethod === "BANK"
            ? { amount: parsed, paymentMethod: "BANK", bankName, accountNumber }
            : { amount: parsed, paymentMethod: "DUITNOW", duitnowPhone },
      });
      if (result.type === "BUSINESS_ERROR") {
        if (result.code === "INSUFFICIENT_BALANCE") {
          // The available figure moved since the dialog opened (e.g. a session
          // charge or another request). Refresh so the user sees the new cap.
          await refetchWithdrawable();
          toast.error("Amount exceeds what you can withdraw", {
            description: "Your available balance changed — please check and try again.",
          });
        } else {
          toast.error("Failed to submit request");
        }
        return;
      }
      toast.success("Withdrawal request submitted", { description: "Waiting for host approval" });
      setAmount("");
      setBankName("");
      setAccountNumber("");
      setDuitnowPhone(savedDetails?.duitnowPhone ?? "");
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["withdrawable"] }),
        queryClient.invalidateQueries({ queryKey: ["saved-payment-details"] }),
      ]);
    } catch {
      toast.error("Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) refetchWithdrawable();
        else {
          setAmountInvalid(false);
          setMethodSwitched(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={balance <= 0} className={className}>
          <ArrowDownCircle className="h-4 w-4 mr-1" />
          Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="withdrawal-amount">Amount (RM)</Label>
            <Input
              id="withdrawal-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setAmountInvalid(false); }}
              className={cn("mt-1", (amountInvalid || amountExceedsBalance) && "border-danger focus-visible:ring-danger")}
            />
            {amountExceedsBalance ? (
              <p className="text-xs text-danger mt-1">
                You can withdraw up to RM {available.toFixed(2)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Available to withdraw: RM {available.toFixed(2)}
                {pending > 0 && ` (RM ${balance.toFixed(2)} balance − RM ${pending.toFixed(2)} pending)`}
              </p>
            )}
          </div>

          <div>
            <Label>Payment Method</Label>
            <div className="flex gap-3 mt-2">
              {(["BANK", "DUITNOW"] as const).map((method) => (
                <label
                  key={method}
                  className={cn(
                    "flex-1 flex items-center gap-2 border rounded-md px-3 py-2.5 cursor-pointer transition-colors",
                    paymentMethod === method
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value={method}
                    checked={paymentMethod === method}
                    onChange={() => handlePaymentMethodChange(method)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">
                    {method === "BANK" ? "Bank Transfer" : "DuitNow"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {paymentMethod === "BANK" && (
            <div className={cn("space-y-4", methodSwitched && "reveal")}>
              <div>
                <Label htmlFor="bank-name">Bank Name</Label>
                <Input
                  id="bank-name"
                  type="text"
                  placeholder="e.g. Maybank, CIMB, Public Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="account-number">Account Number</Label>
                <Input
                  id="account-number"
                  type="text"
                  placeholder="Enter account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {paymentMethod === "DUITNOW" && (
            <div className={cn(methodSwitched && "reveal")}>
              <Label htmlFor="duitnow-phone">Phone Number</Label>
              <Input
                id="duitnow-phone"
                type="tel"
                placeholder="e.g. 0123456789"
                value={duitnowPhone}
                onChange={(e) => setDuitnowPhone(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || amountExceedsBalance}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Withdrawal Request"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
