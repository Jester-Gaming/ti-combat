import { filter, groupBy, pipe } from 'remeda'

import type {
  AbilityReadContext,
  AbilitySlot,
  CombatMode,
  RegisteredAbility,
} from '@/combat'
import { SLOT_DISPLAY, SLOT_ORDER } from '@/combat'

import styles from './abilities-panel.module.css'
import { AbilityConfig } from './components/ability-config'

interface AbilitiesPanelProps {
  abilities: RegisteredAbility[]
  readContext: AbilityReadContext
  combatMode: CombatMode
  params: Record<string, Record<string, unknown>>
  onParamsChange: (abilityName: string, params: Record<string, unknown>) => void
}

function hasUI(reg: RegisteredAbility): boolean {
  const a = reg.ability
  return !!a.headerUI || (a.uiConfig?.length ?? 0) > 0
}

function slotIndex(slot: AbilitySlot): number {
  const i = SLOT_ORDER.indexOf(slot)
  return i === -1 ? Infinity : i
}

// Slots where the faction icon would just repeat what the FACTION header
// already says (own faction's agents/commanders surfaced under FACTION).
const HIDE_ICON_SLOTS: ReadonlySet<AbilitySlot> = new Set<AbilitySlot>([
  'FACTION_AGENT',
  'FACTION_COMMANDER',
])

function renderAbilityConfig(
  reg: RegisteredAbility,
  readContext: AbilityReadContext,
  combatMode: CombatMode,
  params: Record<string, Record<string, unknown>>,
  onParamsChange: (
    abilityName: string,
    params: Record<string, unknown>,
  ) => void,
): React.ReactElement {
  const ability = reg.ability
  return (
    <AbilityConfig
      key={ability.key}
      ability={ability}
      readContext={readContext}
      combatMode={combatMode}
      params={params[ability.key] ?? {}}
      onParamsChange={newParams => onParamsChange(ability.key, newParams)}
      hideIcon={HIDE_ICON_SLOTS.has(reg.slot)}
    />
  )
}

export function AbilitiesPanel({
  abilities,
  readContext,
  combatMode,
  params,
  onParamsChange,
}: AbilitiesPanelProps): React.ReactElement {
  const visible = pipe(abilities, filter(hasUI))

  const byCategory = groupBy(visible, reg => SLOT_DISPLAY[reg.slot].category)

  const orderedCategories = Object.keys(byCategory).sort((a, b) => {
    const minA = Math.min(...byCategory[a]!.map(r => slotIndex(r.slot)))
    const minB = Math.min(...byCategory[b]!.map(r => slotIndex(r.slot)))
    return minA - minB
  })

  return (
    <div className={styles.container}>
      {orderedCategories.map(category => {
        const entries = byCategory[category] ?? []

        if (category === 'FACTION') {
          // Group by slot (not subcategory string) so SLOT_ORDER governs the
          // sub-headers — keeps a single source of truth for ordering.
          const bySlot = groupBy(entries, reg => reg.slot)
          const slots = (Object.keys(bySlot) as AbilitySlot[]).sort(
            (a, b) => slotIndex(a) - slotIndex(b),
          )

          return (
            <div key={category}>
              <h6 className={styles.categoryLabel}>{category}</h6>
              {slots.map(slot => (
                <div key={slot}>
                  <div className={styles.subcategoryLabel}>
                    {SLOT_DISPLAY[slot].subcategory ?? 'ABILITY'}
                  </div>
                  <div className={styles.abilitiesList}>
                    {bySlot[slot]?.map(reg =>
                      renderAbilityConfig(
                        reg,
                        readContext,
                        combatMode,
                        params,
                        onParamsChange,
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }

        return (
          <div key={category}>
            <h6 className={styles.categoryLabel}>{category}</h6>
            <div className={styles.abilitiesList}>
              {entries.map(reg =>
                renderAbilityConfig(
                  reg,
                  readContext,
                  combatMode,
                  params,
                  onParamsChange,
                ),
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
