import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

interface HeaderProps {
  user?: {
    name?: string | null;
    image?: string | null;
  } | null;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-black text-white px-4 py-4 sticky top-0 z-40">
      <div className="container mx-auto max-w-lg flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl">🏸</span>
          <span className="font-semibold">Badminton Club</span>
        </Link>
        {user ? (
          <Link to="/profile">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.image || undefined} alt={user.name || ""} />
              <AvatarFallback className="bg-green-700 text-white text-sm">
                {user.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Link to="/login">
            <Button variant="secondary" size="sm">
              Login
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
