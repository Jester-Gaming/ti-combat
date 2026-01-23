import { filter, groupBy, keys, pipe } from 'remeda'

import type { AnyAbility } from '@/combat/abilities'

import styles from './abilities-panel.module.css'
import { AbilityConfig } from './components/ability-config'

interface AbilitiesPanelProps {
  abilities: AnyAbility[]
  params: Record<string, Record<string, unknown>>
  onParamsChange: (abilityName: string, params: Record<string, unknown>) => void
}

function hasUI(ability: AnyAbility): boolean {
  return ability.enableUI === true || (ability.uiConfig?.length ?? 0) > 0
}

export function AbilitiesPanel({
  abilities,
  params,
  onParamsChange,
}: AbilitiesPanelProps): React.ReactElement {
  const groupedAbilities = pipe(
    abilities,
    filter(hasUI),
    groupBy(a => a.category),
  )

  const categories = pipe(groupedAbilities, keys(), arr => arr.sort())

  return (
    <div className={styles.container}>
      {categories.map(category => (
        <div key={category}>
          <div className={styles.categoryLabel}>{category}</div>
          <div className={styles.abilitiesList}>
            {groupedAbilities[category].map(ability => (
              <AbilityConfig
                key={ability.key}
                ability={ability}
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
