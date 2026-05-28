"use client"

import { useRandomDaily } from "@/components/random-daily-provider"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { partitionTasksForDraw } from "@/lib/random-daily-helpers"

export function ShuffleConfigCard() {
  const { pools, shuffleConfig, setInclude, setCount } = useRandomDaily()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily shuffle</CardTitle>
      </CardHeader>
      <CardContent>
        {pools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add at least one pool above to configure shuffle.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {pools.map((p) => {
              const cfg = shuffleConfig[p.id] ?? { include: true, count: 1 }
              const { archived, yellowCandidates, mandatory } =
                partitionTasksForDraw(p.tasks)
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 lg:grid-cols-[1fr_auto_auto]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      id={`in-${p.id}`}
                      checked={cfg.include}
                      onCheckedChange={(v) => setInclude(p.id, v === true)}
                    />
                    <Label htmlFor={`in-${p.id}`} className="truncate">
                      {p.name}
                    </Label>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <Label
                      htmlFor={`n-${p.id}`}
                      className="shrink-0 text-muted-foreground"
                    >
                      Random count
                    </Label>
                    <div className="w-20 shrink-0 sm:w-16">
                      <Input
                        id={`n-${p.id}`}
                        type="number"
                        min={0}
                        max={99}
                        inputMode="numeric"
                        value={cfg.count}
                        onChange={(e) =>
                          setCount(p.id, parseInt(e.target.value, 10))
                        }
                        disabled={!cfg.include}
                      />
                    </div>
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground sm:col-span-2 lg:col-span-1 lg:text-right">
                    Mandatory {mandatory.length} · Random{" "}
                    {yellowCandidates.length} · Archive {archived.length}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
