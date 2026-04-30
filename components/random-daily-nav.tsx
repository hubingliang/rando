"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export function RandomDailyNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-6 border-b border-border pb-4 text-sm">
      <Link
        href="/"
        className={cn(
          "transition-colors",
          pathname === "/"
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Daily plan
      </Link>
      <Link
        href="/pools"
        className={cn(
          "transition-colors",
          pathname === "/pools"
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Task pools
      </Link>
    </nav>
  )
}
