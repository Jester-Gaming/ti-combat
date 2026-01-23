import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import { useMemo, useState } from 'react'

import type { AnyAbility } from '@/combat/abilities'
import type { CombatSideState } from '@/combat/state'
import { Checkbox } from '@/components/ui/checkbox'

import { CheckboxList } from '../checkbox-list'
import { OrderList } from '../order-list'
import styles from './ability-config.module.css'

interface AbilityConfigProps {
  ability: AnyAbility
  sideState: CombatSideState
  params: Record<string, unknown>
  onParamsChange: (params: Record<string, unknown>) => void
}

export function AbilityConfig({
  ability,
  sideState,
  params,
  onParamsChange,
}: AbilityConfigProps): React.ReactElement {
  const uiConfigItems = useMemo(() => {
    if (!ability.uiConfig || typeof ability.uiConfig !== 'function') {
      return ability.uiConfig
    }
    const effectiveParams = { ...ability.defaultParams, ...params }
    return ability.uiConfig(sideState, effectiveParams)
  }, [ability, sideState, params])

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
          checked={!!params.isEnabled}
          onChange={checked => handleCheckboxChange('isEnabled', checked)}
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
            const defaultValue = ability.defaultParams?.[key]

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
