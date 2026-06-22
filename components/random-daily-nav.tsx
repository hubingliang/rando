"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, CalendarDays, Layers } from "lucide-react"

import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Daily plan", icon: CalendarDays },
  { href: "/pools", label: "Task pools", icon: Layers },
  { href: "/stats", label: "Insights", icon: BarChart3 },
] as const

export function RandomDailyNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="min-w-0 shrink truncate text-sm font-medium tracking-tight text-foreground transition-colors hover:text-foreground/80"
        >
          Random Daily
        </Link>

        <nav aria-label="Main">
          <ul className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                      "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                    )}
                  >
                    <Icon aria-hidden />
                    <span className="max-sm:sr-only">{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}
