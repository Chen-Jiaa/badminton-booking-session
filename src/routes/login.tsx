import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginButtons } from "@/features/auth/login-buttons";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const navigate = useNavigate();

  // Go back if we came from inside the app; otherwise (direct link, PWA launch) fall back to sessions.
  const handleBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
    } else {
      navigate({ to: "/sessions", replace: true });
    }
  };

  return (
    <div className="relative min-h-dvh flex items-center justify-center bg-gray-50">
      <button
        type="button"
        onClick={handleBack}
        className="absolute left-2 top-[max(0.5rem,env(safe-area-inset-top))] inline-flex h-11 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-black flex items-center justify-center">
            <span className="text-2xl">🏸</span>
          </div>
          <CardTitle className="text-2xl">Badminton Club</CardTitle>
          <CardDescription>Sign in to join sessions and manage your balance</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginButtons />
        </CardContent>
      </Card>
    </div>
  );
}
