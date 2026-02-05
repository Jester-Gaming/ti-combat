import { filter, groupBy, pipe } from 'remeda'

import type { Ability, AbilityReadContext } from '@/combat/abilities'
import type { CombatMode } from '@/combat/combat-state/types'

import styles from './abilities-panel.module.css'
import { AbilityConfig } from './components/ability-config'

interface AbilitiesPanelProps {
  abilities: Ability[]
  readContext: AbilityReadContext
  combatMode: CombatMode
  params: Record<string, Record<string, unknown>>
  onParamsChange: (abilityName: string, params: Record<string, unknown>) => void
}

function hasUI(ability: Ability): boolean {
  return !!ability.headerUI || (ability.uiConfig?.length ?? 0) > 0
}

const CATEGORY_ORDER = [
  'GENERAL',
  'TECHNOLOGY',
  'FACTION',
  'PROMISSORY',
  'AGENT',
  'COMMANDER',
  'AGENDA',
  'ENVIRONMENT',
]

const SUBCATEGORY_ORDER = [
  'ABILITY',
  'TECHNOLOGY',
  'HERO',
  'BREAKTHROUGH',
  'UNIT',
]

function compareCategories(a: string, b: string): number {
  const orderA = CATEGORY_ORDER.includes(a)
    ? CATEGORY_ORDER.indexOf(a)
    : Infinity
  const orderB = CATEGORY_ORDER.includes(b)
    ? CATEGORY_ORDER.indexOf(b)
    : Infinity
  if (orderA !== orderB) return orderA - orderB
  return a.localeCompare(b)
}

function compareSubcategories(a: string, b: string): number {
  const orderA = SUBCATEGORY_ORDER.includes(a)
    ? SUBCATEGORY_ORDER.indexOf(a)
    : Infinity
  const orderB = SUBCATEGORY_ORDER.includes(b)
    ? SUBCATEGORY_ORDER.indexOf(b)
    : Infinity
  if (orderA !== orderB) return orderA - orderB
  return a.localeCompare(b)
}

function renderAbilityConfig(
  ability: Ability,
  readContext: AbilityReadContext,
  combatMode: CombatMode,
  params: Record<string, Record<string, unknown>>,
  onParamsChange: (
    abilityName: string,
    params: Record<string, unknown>,
  ) => void,
): React.ReactElement {
  return (
    <AbilityConfig
      key={ability.key}
      ability={ability}
      readContext={readContext}
      combatMode={combatMode}
      params={params[ability.key] ?? {}}
      onParamsChange={newParams => onParamsChange(ability.key, newParams)}
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
  const groupedAbilities = pipe(
    abilities,
    filter(hasUI),
    groupBy(a => a.category),
  )

  const categories = (
    Object.keys(groupedAbilities) as Array<keyof typeof groupedAbilities>
  ).sort(compareCategories)

  return (
    <div className={styles.container}>
      {categories.map(category => {
        const categoryAbilities = groupedAbilities[category] ?? []

        if (category === 'FACTION') {
          const bySubcategory = groupBy(
            categoryAbilities,
            a => a.subcategory ?? 'ABILITY',
          )
          const subcategories =
            Object.keys(bySubcategory).sort(compareSubcategories)

          return (
            <div key={category}>
              <h6 className={styles.categoryLabel}>{category}</h6>
              {subcategories.map(sub => (
                <div key={sub}>
                  <div className={styles.subcategoryLabel}>{sub}</div>
                  <div className={styles.abilitiesList}>
                    {bySubcategory[sub]?.map(ability =>
                      renderAbilityConfig(
                        ability,
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
              {categoryAbilities.map(ability =>
                renderAbilityConfig(
                  ability,
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
