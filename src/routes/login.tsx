import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginButtons } from "@/features/auth/login-buttons";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50">
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
