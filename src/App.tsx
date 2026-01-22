import { useMemo } from 'react'
import { useImmer } from 'use-immer'
import './App.css'
import { Card, CardContent } from '@/components/ui/card'
import { FactionSelect } from '@/components/FactionSelect'
import { UnitRowDual } from '@/components/UnitRowDual'
import {
  CombatResultBar,
  type CombatResult,
} from '@/components/CombatResultBar'
import { getUnitConfig } from '@/utils/getUnitConfig'
import { getSimulationUnits } from '@/utils/getSimulationUnits'
import factions from '@/data/faction'
import {
  type UnitType,
  type UnitState,
  type SideState,
  type BattleState,
  type FactionKey,
  type Side,
  UNIT_TYPES,
} from '@/types'
import { CombatEngine, flattenTree } from './combat'

function createInitialUnits(): Record<UnitType, UnitState> {
  return UNIT_TYPES.reduce(
    (acc, unitType) => {
      acc[unitType] = { count: 0, upgraded: false }
      return acc
    },
    {} as Record<UnitType, UnitState>,
  )
}

function createInitialSideState(): SideState {
  return {
    faction: Object.keys(factions)[0] as FactionKey,
    units: createInitialUnits(),
  }
}

function createInitialBattleState(): BattleState {
  return {
    attacker: createInitialSideState(),
    defender: createInitialSideState(),
  }
}

function App() {
  const [battle, setBattle] = useImmer<BattleState>(createInitialBattleState)
  const attackerConfig = useMemo(
    () => getUnitConfig(battle.attacker.faction),
    [battle.attacker.faction],
  )
  const defenderConfig = useMemo(
    () => getUnitConfig(battle.defender.faction),
    [battle.defender.faction],
  )

  const combatResult = useMemo((): CombatResult | null => {
    const attacker = getSimulationUnits(battle.attacker)
    const defender = getSimulationUnits(battle.defender)

    // Need at least one unit on each side to simulate
    const hasAttackerUnits = Object.keys(attacker.counts).length > 0
    const hasDefenderUnits = Object.keys(defender.counts).length > 0

    if (!hasAttackerUnits || !hasDefenderUnits) {
      return null
    }

    const engine = new CombatEngine()

    console.time('Simulate')
    const tree = engine.simulate(
      attacker.stats,
      attacker.counts,
      defender.stats,
      defender.counts,
    )
    console.timeEnd('Simulate')

    console.log(tree)

    console.time('Flatten')
    const outcomes = flattenTree(tree)
    console.log(outcomes)
    console.timeEnd('Flatten')

    // Sum probabilities by winner
    let attackerWin = 0
    let draw = 0
    let defenderWin = 0

    for (const outcome of outcomes) {
      switch (outcome.winner) {
        case 'attacker':
          attackerWin += outcome.probability
          break
        case 'defender':
          defenderWin += outcome.probability
          break
        case 'draw':
          draw += outcome.probability
          break
      }
    }

    return { attackerWin, draw, defenderWin }
  }, [battle])

  const handleFactionChange = (side: Side, faction: FactionKey) => {
    setBattle(draft => {
      draft[side].faction = faction
    })
  }

  const handleUnitCountChange = (side: Side, unit: UnitType, count: number) => {
    setBattle(draft => {
      draft[side].units[unit].count = count
    })
  }

  const handleUpgradeToggle = (side: Side, unit: UnitType) => {
    setBattle(draft => {
      draft[side].units[unit].upgraded = !draft[side].units[unit].upgraded
    })
  }

  return (
    <div className="min-h-screen p-4">
      <h1 className="mb-6 text-center text-2xl font-bold">
        TI Battle Simulator
      </h1>
      <Card className="mx-auto max-w-lg">
        <CardContent className="p-4">
          {/* Header with faction selects */}
          <div className="mb-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-2 text-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                Attacker
              </div>
              <FactionSelect
                value={battle.attacker.faction}
                onValueChange={faction =>
                  handleFactionChange('attacker', faction)
                }
              />
            </div>
            <div className="flex-1">
              <div className="mb-2 text-center text-sm font-semibold text-red-600 dark:text-red-400">
                Defender
              </div>
              <FactionSelect
                value={battle.defender.faction}
                onValueChange={faction =>
                  handleFactionChange('defender', faction)
                }
              />
            </div>
          </div>

          {/* Unit rows */}
          <div className="space-y-1">
            {UNIT_TYPES.map(unitKey => (
              <UnitRowDual
                key={unitKey}
                name={attackerConfig[unitKey].name}
                attackerHasUpgrade={attackerConfig[unitKey].hasUpgrade}
                defenderHasUpgrade={defenderConfig[unitKey].hasUpgrade}
                attacker={battle.attacker.units[unitKey]}
                defender={battle.defender.units[unitKey]}
                onAttackerCountChange={count =>
                  handleUnitCountChange('attacker', unitKey, count)
                }
                onAttackerUpgradeToggle={() =>
                  handleUpgradeToggle('attacker', unitKey)
                }
                onDefenderCountChange={count =>
                  handleUnitCountChange('defender', unitKey, count)
                }
                onDefenderUpgradeToggle={() =>
                  handleUpgradeToggle('defender', unitKey)
                }
              />
            ))}
          </div>

          {/* Combat result */}
          <CombatResultBar result={combatResult} />
        </CardContent>
      </Card>
    </div>
  )
}

export default App
