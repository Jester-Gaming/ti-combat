import type { AnyAbility } from '@/combat/abilities'
import { Checkbox } from '@/components/ui/checkbox'

import styles from './ability-config.module.css'

interface AbilityConfigProps {
  ability: AnyAbility
  params: Record<string, unknown>
  onParamsChange: (params: Record<string, unknown>) => void
}

export function AbilityConfig({
  ability,
  params,
  onParamsChange,
}: AbilityConfigProps): React.ReactElement {
  const isEnabled = ability.enableUI ? !!params['ENABLED'] : true

  function handleCheckboxChange(key: string, checked: boolean): void {
    onParamsChange({ ...params, [key]: checked })
  }

  const header = ability.enableUI ? (
    <label className={styles.headerLabel}>
      <Checkbox
        checked={isEnabled}
        onChange={checked => handleCheckboxChange('ENABLED', checked)}
      />
      <span className={styles.title}>{ability.name}</span>
    </label>
  ) : (
    <span className={styles.title}>{ability.name}</span>
  )

  const hasConfigItems = ability.uiConfig && ability.uiConfig.length > 0

  return (
    <div className={styles.container}>
      {header}
      {hasConfigItems && (
        <div className={styles.configItems}>
          {ability.uiConfig!.map(config => {
            if (config.type !== 'checkbox') return null

            const key = config.key as string
            return (
              <label key={key} className={styles.configItemLabel}>
                <Checkbox
                  checked={!!params[key]}
                  onChange={checked => handleCheckboxChange(key, checked)}
                />
                <span className={styles.configItemText}>{config.label}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
