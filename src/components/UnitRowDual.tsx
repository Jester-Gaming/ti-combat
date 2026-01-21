import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface UnitControlsProps {
  count: number
  upgraded: boolean
  hasUpgrade: boolean
  onCountChange: (count: number) => void
  onUpgradeToggle: () => void
  side: 'attacker' | 'defender'
}

function UnitControls({
  count,
  upgraded,
  hasUpgrade,
  onCountChange,
  onUpgradeToggle,
  side,
}: UnitControlsProps) {
  const isAttacker = side === 'attacker'

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '') {
      onCountChange(0)
      return
    }
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 0) {
      onCountChange(num)
    }
  }

  const upgradeButton = hasUpgrade ? (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={onUpgradeToggle}
      title={upgraded ? 'Upgraded' : 'Click to upgrade'}
    >
      {upgraded ? '▲' : '△'}
    </Button>
  ) : (
    <div className="h-7 w-7" />
  )

  const minusButton = (
    <Button
      variant="outline"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={() => onCountChange(Math.max(0, count - 1))}
      disabled={count === 0}
    >
      -
    </Button>
  )

  const plusButton = (
    <Button
      variant="outline"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={() => onCountChange(count + 1)}
    >
      +
    </Button>
  )

  const countInput = (
    <Input
      type="text"
      inputMode="numeric"
      value={count}
      onChange={handleInputChange}
      className="h-7 w-10 px-1 text-center text-sm tabular-nums"
    />
  )

  // Attacker: [△] [+] 0 [-]  |  Defender: [-] 0 [+] [△]
  if (isAttacker) {
    return (
      <div className="flex items-center gap-1">
        {upgradeButton}
        {plusButton}
        {countInput}
        {minusButton}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {minusButton}
      {countInput}
      {plusButton}
      {upgradeButton}
    </div>
  )
}

interface UnitRowDualProps {
  name: string
  attackerHasUpgrade: boolean
  defenderHasUpgrade: boolean
  attacker: { count: number; upgraded: boolean }
  defender: { count: number; upgraded: boolean }
  onAttackerCountChange: (count: number) => void
  onAttackerUpgradeToggle: () => void
  onDefenderCountChange: (count: number) => void
  onDefenderUpgradeToggle: () => void
}

export function UnitRowDual({
  name,
  attackerHasUpgrade,
  defenderHasUpgrade,
  attacker,
  defender,
  onAttackerCountChange,
  onAttackerUpgradeToggle,
  onDefenderCountChange,
  onDefenderUpgradeToggle,
}: UnitRowDualProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <UnitControls
        count={attacker.count}
        upgraded={attacker.upgraded}
        hasUpgrade={attackerHasUpgrade}
        onCountChange={onAttackerCountChange}
        onUpgradeToggle={onAttackerUpgradeToggle}
        side="attacker"
      />
      <span className="min-w-24 text-center text-sm font-medium">{name}</span>
      <UnitControls
        count={defender.count}
        upgraded={defender.upgraded}
        hasUpgrade={defenderHasUpgrade}
        onCountChange={onDefenderCountChange}
        onUpgradeToggle={onDefenderUpgradeToggle}
        side="defender"
      />
    </div>
  )
}
