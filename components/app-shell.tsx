import { RandomDailyNav } from "@/components/random-daily-nav"
import { ReminderBanner } from "@/components/reminder-banner"
import { cn } from "@/lib/utils"

export function AppShell({
  children,
  className,
  mainClassName,
  maxWidth = "5xl",
}: {
  children: React.ReactNode
  className?: string
  mainClassName?: string
  maxWidth?: "4xl" | "5xl"
}) {
  return (
    <div className={cn("min-h-svh bg-background text-foreground", className)}>
      <RandomDailyNav />
      <ReminderBanner />
      <main
        className={cn(
          "mx-auto flex w-full flex-col gap-8 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 sm:gap-10 sm:px-6 sm:pb-14 sm:pt-8 lg:px-8",
          maxWidth === "4xl" ? "max-w-4xl" : "max-w-5xl",
          mainClassName,
        )}
      >
        {children}
      </main>
    </div>
  )
}
