import { filter, groupBy, pipe } from 'remeda'

import type {
  AbilityReadContext,
  AbilitySlot,
  CombatMode,
  RegisteredAbility,
} from '@/combat'
import { extractDefaults, SLOT_DISPLAY, SLOT_ORDER } from '@/combat'

import styles from './abilities-panel.module.css'
import { AbilityConfig } from './components/ability-config'

export type AbilityFilterMode = 'all' | 'same' | 'enabled'

interface AbilitiesPanelProps {
  abilities: RegisteredAbility[]
  readContext: AbilityReadContext
  combatMode: CombatMode
  params: Record<string, Record<string, unknown>>
  onParamsChange: (abilityName: string, params: Record<string, unknown>) => void
  searchQuery?: string
  filterMode: AbilityFilterMode
}

function hasUI(reg: RegisteredAbility): boolean {
  const a = reg.ability
  return !!a.headerUI || (a.uiConfig?.length ?? 0) > 0
}

function isAbilityEnabled(
  reg: RegisteredAbility,
  params: Record<string, unknown> | undefined,
): boolean {
  const merged = { ...extractDefaults(reg.ability), ...params }
  const isEnabled = merged.isEnabled
  const uses = merged.uses
  return isEnabled === true && (typeof uses !== 'number' || uses > 0)
}

function isInCurrentMode(
  reg: RegisteredAbility,
  combatMode: CombatMode,
): boolean {
  return !reg.ability.context || reg.ability.context === combatMode
}

function isSubsequence(word: string, needle: string): boolean {
  let i = 0
  for (let w = 0; w < word.length && i < needle.length; w++) {
    if (word[w] === needle[i]) i++
  }
  return i === needle.length
}

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) return true
  for (const word of haystack.split(/\s+/)) {
    if (word && isSubsequence(word, needle)) return true
  }
  return false
}

function matchesSearch(reg: RegisteredAbility, query: string): boolean {
  const haystack = [
    reg.ability.name,
    reg.ability.description ?? '',
    SLOT_DISPLAY[reg.slot].category,
    SLOT_DISPLAY[reg.slot].subcategory ?? '',
  ]
    .join(' ')
    .toLowerCase()
  const tokens = query.split(/\s+/).filter(Boolean)
  return tokens.every(token => fuzzyMatch(haystack, token))
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
  searchQuery,
  filterMode,
}: AbilitiesPanelProps): React.ReactElement {
  const normalizedQuery = searchQuery?.trim().toLowerCase() ?? ''
  const visible = pipe(
    abilities,
    filter(hasUI),
    filter(reg => !normalizedQuery || matchesSearch(reg, normalizedQuery)),
    filter(reg => {
      if (filterMode === 'all') return true
      if (filterMode === 'same') return isInCurrentMode(reg, combatMode)
      return isAbilityEnabled(reg, params[reg.ability.key])
    }),
  )

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
