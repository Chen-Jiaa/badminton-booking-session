"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Calendar, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  userRole?: "PLAYER" | "HOST" | "TREASURER";
}

const playerNavItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/sessions", icon: Calendar, label: "Sessions" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
];

const hostNavItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/sessions", icon: Calendar, label: "Sessions" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
  { href: "/profile", icon: Shield, label: "Admin" },
];

export function BottomNav({ userRole = "PLAYER" }: BottomNavProps) {
  const pathname = usePathname();
  const navItems = userRole === "PLAYER" ? playerNavItems : hostNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-50">
      <div className="container mx-auto max-w-lg">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "text-green-600"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
