import { cn } from '@/lib/utils'

export interface CombatResult {
  attackerWin: number
  draw: number
  defenderWin: number
}

interface CombatResultBarProps {
  result: CombatResult | null
}

export function CombatResultBar({ result }: CombatResultBarProps) {
  if (!result) {
    return (
      <div className="mt-4">
        <div className="mb-2 text-center text-sm font-semibold">Result</div>
        <div className="bg-muted/50 text-muted-foreground flex h-10 items-center justify-center rounded-md border text-sm">
          Add units to see results
        </div>
      </div>
    )
  }

  const { attackerWin, draw, defenderWin } = result
  const attackerPct = Math.round(attackerWin * 100)
  const drawPct = Math.round(draw * 100)
  const defenderPct = Math.round(defenderWin * 100)

  return (
    <div className="mt-4">
      <div className="mb-2 text-center text-sm font-semibold">Result</div>
      <div className="flex h-10 overflow-hidden rounded-md border">
        {attackerPct > 0 && (
          <div
            className={cn(
              'flex items-center justify-center bg-violet-300 text-violet-900',
              'transition-all duration-300',
            )}
            style={{ width: `${attackerPct}%` }}
          >
            <span className="flex flex-col items-center text-xs leading-tight font-medium">
              <span>Attacker</span>
              <span>{attackerPct}%</span>
            </span>
          </div>
        )}
        {drawPct > 0 && (
          <div
            className={cn(
              'flex items-center justify-center bg-stone-300 text-stone-700',
              'transition-all duration-300',
            )}
            style={{ width: `${drawPct}%` }}
          >
            <span className="flex flex-col items-center text-xs leading-tight font-medium">
              <span>Draw</span>
              <span>{drawPct}%</span>
            </span>
          </div>
        )}
        {defenderPct > 0 && (
          <div
            className={cn(
              'flex items-center justify-center bg-red-200 text-red-900',
              'transition-all duration-300',
            )}
            style={{ width: `${defenderPct}%` }}
          >
            <span className="flex flex-col items-center text-xs leading-tight font-medium">
              <span>Defender</span>
              <span>{defenderPct}%</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
