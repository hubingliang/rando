"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"

export function RandomDailyNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-border pb-4">
      <NavigationMenu viewport={false}>
        <NavigationMenuList className="flex-wrap justify-start gap-1">
          <NavigationMenuItem>
            <NavigationMenuLink asChild active={pathname === "/"}>
              <Link href="/">Daily plan</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink asChild active={pathname === "/pools"}>
              <Link href="/pools">Task pools</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  )
}
