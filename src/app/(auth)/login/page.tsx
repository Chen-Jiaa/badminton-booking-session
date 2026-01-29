import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginButtons } from "./login-buttons";

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md mx-4">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-600 flex items-center justify-center">
          <span className="text-2xl">🏸</span>
        </div>
        <CardTitle className="text-2xl">Badminton Group</CardTitle>
        <CardDescription>Sign in to manage your pre-pay balance</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginButtons />
      </CardContent>
    </Card>
  );
}
