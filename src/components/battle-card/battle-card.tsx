import { clsx } from 'clsx'
import type { CSSProperties } from 'react'
import { Fragment } from 'react'

import { FactionSelect } from '@/components/battle-card/components/faction-select'
import { UnitRowDual } from '@/components/battle-card/components/unit-row-dual'
import {
  type CombatResult,
  CombatResultBar,
} from '@/components/combat-simulator/components/combat-result-bar'
import { GlassCard } from '@/components/ui/glass-card'
import { GlowText } from '@/components/ui/glow-text'
import {
  type BattleState,
  type FactionKey,
  type Side,
  UNIT_TYPES,
  type UnitType,
} from '@/types'
import type { UnitConfig } from '@/utils/get-unit-config'

import styles from './battle-card.module.css'

interface BattleCardProps {
  battle: BattleState
  attackerConfig: Record<UnitType, UnitConfig>
  defenderConfig: Record<UnitType, UnitConfig>
  combatResult: CombatResult | null
  onFactionChange: (side: Side, faction: FactionKey) => void
  onUnitCountChange: (side: Side, unit: UnitType, count: number) => void
  onUpgradeToggle: (side: Side, unit: UnitType) => void
  className?: string
}

export function BattleCard({
  battle,
  attackerConfig,
  defenderConfig,
  combatResult,
  onFactionChange,
  onUnitCountChange,
  onUpgradeToggle,
  className,
}: BattleCardProps) {
  return (
    <GlassCard as="main" className={clsx(styles.battleCard, className)}>
      {/* Faction selectors */}
      <div className={styles.factionSelectors}>
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
            value={battle.attacker.faction}
            onValueChange={faction => onFactionChange('attacker', faction)}
          />
        </div>
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
            value={battle.defender.faction}
            onValueChange={faction => onFactionChange('defender', faction)}
          />
        </div>
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
              attackerHasUpgrade={attackerConfig[unitKey].hasUpgrade}
              defenderHasUpgrade={defenderConfig[unitKey].hasUpgrade}
              attacker={battle.attacker.units[unitKey]}
              defender={battle.defender.units[unitKey]}
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
        <CombatResultBar result={combatResult} />
      </div>
    </GlassCard>
  )
}
