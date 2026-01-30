import { filter, groupBy, pipe } from 'remeda'

import type { Ability } from '@/combat/abilities'
import type { SideState } from '@/combat/state'

import styles from './abilities-panel.module.css'
import { AbilityConfig } from './components/ability-config'

interface AbilitiesPanelProps {
  abilities: Ability[]
  sideState: SideState
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

export function AbilitiesPanel({
  abilities,
  sideState,
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
      {categories.map(category => (
        <div key={category}>
          <h6 className={styles.categoryLabel}>{category}</h6>
          <div className={styles.abilitiesList}>
            {groupedAbilities[category]?.map(ability => (
              <AbilityConfig
                key={ability.key}
                ability={ability}
                sideState={sideState}
                params={params[ability.key] ?? {}}
                onParamsChange={newParams =>
                  onParamsChange(ability.key, newParams)
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
