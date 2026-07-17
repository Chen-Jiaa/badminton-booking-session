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
import { useToast } from "@/hooks/use-toast";
import { ArrowDownCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createWithdrawalFn, savedPaymentDetailsQueryOptions } from "@/features/withdrawal/server";

interface WithdrawalDialogProps {
  balance: number;
}

export function WithdrawalDialog({ balance }: WithdrawalDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountInvalid, setAmountInvalid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"BANK" | "DUITNOW">("BANK");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [duitnowPhone, setDuitnowPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: savedDetails } = useQuery(savedPaymentDetailsQueryOptions());

  const parsed = parseFloat(amount);
  const amountExceedsBalance = amount !== "" && !isNaN(parsed) && parsed > balance;

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
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    if (amountExceedsBalance) {
      toast({ title: "Amount exceeds your current balance", variant: "destructive" });
      return;
    }

    if (paymentMethod === "BANK") {
      if (!bankName.trim()) {
        toast({ title: "Please enter a bank name", variant: "destructive" });
        return;
      }
      if (!accountNumber.trim()) {
        toast({ title: "Please enter an account number", variant: "destructive" });
        return;
      }
    } else {
      if (!duitnowPhone.trim()) {
        toast({ title: "Please enter a phone number", variant: "destructive" });
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
          toast({ title: "Insufficient balance", variant: "destructive" });
        } else if (result.code === "PENDING_EXISTS") {
          toast({
            title: "You already have a pending withdrawal request",
            variant: "destructive",
          });
        } else {
          toast({ title: "Failed to submit request", variant: "destructive" });
        }
        return;
      }
      toast({ title: "Withdrawal request submitted", description: "Waiting for host approval" });
      setAmount("");
      setBankName("");
      setAccountNumber("");
      setDuitnowPhone(savedDetails?.duitnowPhone ?? "");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      await queryClient.invalidateQueries({ queryKey: ["saved-payment-details"] });
    } catch {
      toast({ title: "Failed to submit request", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setAmountInvalid(false); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={balance <= 0}>
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
              step="0.01"
              min="0.01"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setAmountInvalid(false); }}
              className={cn("mt-1", (amountInvalid || amountExceedsBalance) && "border-red-500 focus-visible:ring-red-500")}
            />
            {amountExceedsBalance ? (
              <p className="text-xs text-red-600 mt-1">
                Cannot withdraw more than your wallet balance (RM {balance.toFixed(2)})
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Available balance: RM {balance.toFixed(2)}
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
            <>
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
            </>
          )}

          {paymentMethod === "DUITNOW" && (
            <div>
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
