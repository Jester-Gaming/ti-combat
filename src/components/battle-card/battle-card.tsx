import { LoopIcon, TrashIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

import type { CombatMode, CombatOutcome } from '@/combat'
import { ButtonIcon } from '@/components/ui/button-icon'
import { ButtonIconPlain } from '@/components/ui/button-icon-plain'
import { GlassCard } from '@/components/ui/glass-card'
import { ToggleGroup } from '@/components/ui/toggle-group'
import {
  GROUND_FORCES,
  SHIPS,
  STRUCTURES,
  UNIT_LIMITS,
} from '@/constants/units'
import type {
  CombatSide,
  FactionKey,
  UnitBaseType,
  UnitSelection,
} from '@/types'
import type { UnitConfig } from '@/utils/get-unit-config'

import { Divider } from '../ui/divider'
import styles from './battle-card.module.css'
import {
  type CombatResult,
  CombatResultBar,
} from './components/combat-result-bar'
import { FactionSelect } from './components/faction-select'
import { UnitRowDual } from './components/unit-row-dual'

const UNITS = [
  {
    label: 'Ships',
    items: SHIPS,
  },
  {
    label: 'Ground Forces',
    items: GROUND_FORCES,
  },
  {
    label: 'Structures',
    items: STRUCTURES,
  },
]

const COMBAT_MODE_OPTIONS = [
  { value: 'SPACE' as const, label: 'Space Combat' },
  { value: 'GROUND' as const, label: 'Ground Combat' },
]

interface BattleCardProps {
  attackerFaction: FactionKey
  defenderFaction: FactionKey
  attackerSelections: Record<UnitBaseType, UnitSelection>
  defenderSelections: Record<UnitBaseType, UnitSelection>
  attackerConfig: Record<UnitBaseType, UnitConfig>
  defenderConfig: Record<UnitBaseType, UnitConfig>
  combatResult: CombatResult | null
  outcomes: CombatOutcome[] | null
  unitPriority: { attacker: string[]; defender: string[] }
  isComputing?: boolean
  combatMode: CombatMode
  onCombatModeChange: (mode: CombatMode) => void
  onFactionChange: (side: CombatSide, faction: FactionKey) => void
  onSwap: () => void
  onUnitCountChange: (
    side: CombatSide,
    unit: UnitBaseType,
    count: number,
  ) => void
  onUpgradeToggle: (side: CombatSide, unit: UnitBaseType) => void
  onResetUnits: (side: CombatSide) => void
  attackerActions?: ReactNode
  defenderActions?: ReactNode
  className?: string
}

export function BattleCard({
  attackerFaction,
  defenderFaction,
  attackerSelections,
  defenderSelections,
  attackerConfig,
  defenderConfig,
  combatResult,
  outcomes,
  unitPriority,
  isComputing,
  combatMode,
  onCombatModeChange,
  onFactionChange,
  onSwap,
  onUnitCountChange,
  onUpgradeToggle,
  onResetUnits,
  attackerActions,
  defenderActions,
  className,
}: BattleCardProps) {
  return (
    <GlassCard as="section" className={clsx(styles.battleCard, className)}>
      <header className={styles.header}>
        {attackerActions && (
          <div className={styles.factionAction}>{attackerActions}</div>
        )}
        <div className={clsx(styles.factionSelector)}>
          <FactionSelect
            value={attackerFaction}
            onValueChange={faction => onFactionChange('attacker', faction)}
            className="theme-attacker"
          />
        </div>
        <ButtonIconPlain onClick={onSwap} title="Swap attacker and defender">
          <LoopIcon />
        </ButtonIconPlain>
        <div className={clsx(styles.factionSelector)}>
          <FactionSelect
            value={defenderFaction}
            onValueChange={faction => onFactionChange('defender', faction)}
            className="theme-defender"
            align="end"
          />
        </div>
        {defenderActions && (
          <div className={styles.factionAction}>{defenderActions}</div>
        )}
      </header>

      {/* Unit rows */}
      <div className={styles.unitRows}>
        {UNITS.map(({ label, items }) => (
          <section className={styles.unitGroup} key={label}>
            <header className={styles.unitGroupHeader}>
              <Divider className="theme-attacker" />
              <span className={styles.unitGroupTitle}>{label}</span>
              <Divider className="theme-defender" />
            </header>
            {items.map(unitKey => (
              <UnitRowDual
                name={attackerConfig[unitKey].name}
                shortName={attackerConfig[unitKey].shortName}
                limit={UNIT_LIMITS[unitKey]}
                attackerHasUpgrade={attackerConfig[unitKey].hasUpgrade}
                defenderHasUpgrade={defenderConfig[unitKey].hasUpgrade}
                attacker={attackerSelections[unitKey]}
                defender={defenderSelections[unitKey]}
                onAttackerCountChange={count =>
                  onUnitCountChange('attacker', unitKey, count)
                }
                onAttackerUpgradeToggle={() =>
                  onUpgradeToggle('attacker', unitKey)
                }
                onDefenderCountChange={count =>
                  onUnitCountChange('defender', unitKey, count)
                }
                onDefenderUpgradeToggle={() =>
                  onUpgradeToggle('defender', unitKey)
                }
              />
            ))}
          </section>
        ))}
      </div>

      <div className={styles.combatModeDivider}>
        <Divider className="theme-attacker" />
        <ButtonIcon
          className="theme-attacker"
          onClick={() => onResetUnits('attacker')}
          title="Reset attacker units"
        >
          <TrashIcon />
        </ButtonIcon>
        <Divider className="theme-attacker" />
        <ToggleGroup<CombatMode>
          options={COMBAT_MODE_OPTIONS}
          value={combatMode}
          onChange={onCombatModeChange}
        />
        <Divider className="theme-defender" />
        <ButtonIcon
          className="theme-defender"
          onClick={() => onResetUnits('defender')}
          title="Reset defender units"
        >
          <TrashIcon />
        </ButtonIcon>
        <Divider className="theme-defender" />
      </div>

      <CombatResultBar
        result={combatResult}
        outcomes={outcomes}
        unitPriority={unitPriority}
        isComputing={isComputing}
      />
    </GlassCard>
  )
}
