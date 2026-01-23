import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import { useState } from 'react'

import type { AnyAbility } from '@/combat/abilities'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckboxList } from '@/components/ui/checkbox-list'
import { OrderList } from '@/components/ui/order-list'

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

  // Merge params with defaults for uiConfig function
  const effectiveParams = { ...ability.params, ...params }

  // Resolve uiConfig (can be array or function)
  const uiConfigItems =
    typeof ability.uiConfig === 'function'
      ? ability.uiConfig(effectiveParams)
      : ability.uiConfig

  const hasConfigItems = uiConfigItems && uiConfigItems.length > 0
  const showLabels = uiConfigItems && uiConfigItems.length > 1
  const isCollapsible = hasConfigItems && ability.defaultCollapsed !== undefined
  const [isCollapsed, setIsCollapsed] = useState(
    ability.defaultCollapsed ?? false,
  )

  function handleCheckboxChange(key: string, checked: boolean): void {
    onParamsChange({ ...params, [key]: checked })
  }

  function handleOrderChange(key: string, items: string[]): void {
    onParamsChange({ ...params, [key]: items })
  }

  function toggleCollapsed(): void {
    setIsCollapsed(prev => !prev)
  }

  const header = (
    <div className={styles.header}>
      <button
        type="button"
        className={styles.headerButton}
        onClick={isCollapsible ? toggleCollapsed : undefined}
        aria-expanded={isCollapsible ? !isCollapsed : undefined}
        disabled={!isCollapsible}
      >
        <span className={styles.title}>{ability.name}</span>
        {isCollapsible && (
          <span className={styles.collapseIcon}>
            {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
          </span>
        )}
      </button>
      {ability.enableUI && (
        <Checkbox
          checked={isEnabled}
          onChange={checked => handleCheckboxChange('ENABLED', checked)}
        />
      )}
    </div>
  )

  return (
    <div className={styles.container}>
      {header}
      {hasConfigItems && !isCollapsed && (
        <div className={styles.configItems}>
          {uiConfigItems!.map(config => {
            const key = config.key as string
            const defaultValue = ability.params?.[key]

            if (config.type === 'checkbox') {
              const value = params[key] ?? defaultValue ?? false
              return (
                <label key={key} className={styles.configItemLabel}>
                  <Checkbox
                    checked={!!value}
                    onChange={checked => handleCheckboxChange(key, checked)}
                  />
                  <span className={styles.configItemText}>{config.label}</span>
                </label>
              )
            }

            if (config.type === 'order-list') {
              const value = (params[key] ?? defaultValue ?? []) as string[]

              return (
                <div key={key} className={styles.configItemGroup}>
                  {showLabels && (
                    <span className={styles.configItemText}>
                      {config.label}
                    </span>
                  )}
                  <OrderList
                    items={config.items}
                    value={value}
                    onChange={items => handleOrderChange(key, items)}
                  />
                </div>
              )
            }

            if (config.type === 'checkbox-list') {
              const value = (params[key] ?? defaultValue ?? []) as string[]

              return (
                <div key={key} className={styles.configItemGroup}>
                  {showLabels && (
                    <span className={styles.configItemText}>
                      {config.label}
                    </span>
                  )}
                  <CheckboxList
                    items={config.items}
                    value={value}
                    onChange={items => handleOrderChange(key, items)}
                  />
                </div>
              )
            }

            return null
          })}
        </div>
      )}
    </div>
  )
}
