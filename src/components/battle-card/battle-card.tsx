import { LoopIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'

import type { CombatMode } from '@/combat/combat-state/types'
import type { CombatOutcome } from '@/combat/types'
import { GlassCard } from '@/components/ui/glass-card'
import { GlowText } from '@/components/ui/glow-text'
import { UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
import type { CombatSide, FactionKey, UnitSelection, UnitType } from '@/types'
import type { UnitConfig } from '@/utils/get-unit-config'

import styles from './battle-card.module.css'
import {
  type CombatResult,
  CombatResultBar,
} from './components/combat-result-bar'
import { FactionSelect } from './components/faction-select'
import { UnitRowDual } from './components/unit-row-dual'

interface BattleCardProps {
  attackerFaction: FactionKey
  defenderFaction: FactionKey
  attackerSelections: Record<UnitType, UnitSelection>
  defenderSelections: Record<UnitType, UnitSelection>
  attackerConfig: Record<UnitType, UnitConfig>
  defenderConfig: Record<UnitType, UnitConfig>
  combatResult: CombatResult | null
  outcomes: CombatOutcome[] | null
  unitPriority: { attacker: string[]; defender: string[] }
  isComputing?: boolean
  combatMode: CombatMode
  onCombatModeChange: (mode: CombatMode) => void
  onFactionChange: (side: CombatSide, faction: FactionKey) => void
  onSwap: () => void
  onUnitCountChange: (side: CombatSide, unit: UnitType, count: number) => void
  onUpgradeToggle: (side: CombatSide, unit: UnitType) => void
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
  attackerActions,
  defenderActions,
  className,
}: BattleCardProps) {
  return (
    <GlassCard as="main" className={clsx(styles.battleCard, className)}>
      {/* Faction selectors */}
      <div className={styles.factionSelectors}>
        {attackerActions && (
          <div className={styles.factionAction}>{attackerActions}</div>
        )}
        <div
          className={styles.factionSelector}
          style={{ '--select-color': 'var(--attacker)' } as CSSProperties}
        >
          <GlowText
            as="label"
            className={styles.factionLabel}
            style={{ '--glow-color': 'var(--attacker)' } as CSSProperties}
          >
            Attacker Fleet
          </GlowText>
          <FactionSelect
            value={attackerFaction}
            onValueChange={faction => onFactionChange('attacker', faction)}
          />
        </div>
        <button
          type="button"
          className={styles.swapButton}
          onClick={onSwap}
          title="Swap attacker and defender"
        >
          <LoopIcon />
        </button>
        <div
          className={styles.factionSelector}
          style={{ '--select-color': 'var(--defender)' } as CSSProperties}
        >
          <GlowText
            as="label"
            className={styles.factionLabel}
            style={{ '--glow-color': 'var(--defender)' } as CSSProperties}
          >
            Defender Fleet
          </GlowText>
          <FactionSelect
            value={defenderFaction}
            onValueChange={faction => onFactionChange('defender', faction)}
          />
        </div>
        {defenderActions && (
          <div className={styles.factionAction}>{defenderActions}</div>
        )}
      </div>

      {/* Divider */}
      <div className={styles.divider}>
        <div className={styles.dividerLineAttacker} />
        <span className={styles.dividerLabel}>Units</span>
        <div className={styles.dividerLineDefender} />
      </div>

      {/* Unit rows */}
      <div className={styles.unitRows}>
        {UNIT_TYPES.map(unitKey => (
          <Fragment key={unitKey}>
            {unitKey === 'MECH' && (
              <div className={styles.sectionDivider}>
                <div className={styles.sectionDividerLine} />
                <span className={styles.sectionDividerLabel}>
                  Ground Forces
                </span>
                <div className={styles.sectionDividerLine} />
              </div>
            )}
            {unitKey === 'PDS' && (
              <div className={styles.sectionDivider}>
                <div className={styles.sectionDividerLine} />
                <span className={styles.sectionDividerLabel}>Structures</span>
                <div className={styles.sectionDividerLine} />
              </div>
            )}
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
          </Fragment>
        ))}
      </div>

      <div className={styles.combatResult}>
        <div className={styles.combatModeDivider}>
          <div className={styles.combatModeLine} />
          <div className={styles.combatModeToggle}>
            <button
              type="button"
              className={clsx(
                styles.combatModeOption,
                combatMode === 'SPACE' && styles.combatModeOptionActive,
              )}
              onClick={() => onCombatModeChange('SPACE')}
            >
              Space Combat
            </button>
            <button
              type="button"
              className={clsx(
                styles.combatModeOption,
                combatMode === 'GROUND' && styles.combatModeOptionActive,
              )}
              onClick={() => onCombatModeChange('GROUND')}
            >
              Ground Combat
            </button>
          </div>
          <div className={styles.combatModeLine} />
        </div>
        <CombatResultBar
          result={combatResult}
          outcomes={outcomes}
          unitPriority={unitPriority}
          isComputing={isComputing}
        />
      </div>
    </GlassCard>
  )
}
