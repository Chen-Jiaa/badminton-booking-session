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
    <header className="sticky top-0 z-40 bg-black px-4 py-3 text-white">
      <div className="container mx-auto max-w-lg flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg">🏸</span>
          <span className="font-semibold">Badminton Club</span>
        </Link>
        {user ? (
          <Link
            to="/profile"
            className="-my-1 -mr-1.5 flex h-11 w-11 items-center justify-center rounded-full"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.image || undefined} alt={user.name || ""} />
              <AvatarFallback className="bg-brand text-brand-foreground text-sm">
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
