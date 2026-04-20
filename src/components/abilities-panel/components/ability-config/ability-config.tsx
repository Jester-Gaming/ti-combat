import {
  ChevronDownIcon,
  ChevronRightIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons'
import { useId, useMemo, useState } from 'react'

import {
  type Ability,
  type AbilityReadContext,
  type CombatMode,
  extractDefaults,
} from '@/combat'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'

import { CheckboxList } from '../checkbox-list'
import { NumberList } from '../number-list'
import { OrderList } from '../order-list'
import { PriorityList } from '../priority-list'
import { PriorityNumberList } from '../priority-number-list'
import styles from './ability-config.module.css'

interface AbilityConfigProps {
  ability: Ability
  readContext: AbilityReadContext
  combatMode: CombatMode
  params: Record<string, unknown>
  onParamsChange: (params: Record<string, unknown>) => void
}

export function AbilityConfig({
  ability,
  readContext,
  combatMode,
  params,
  onParamsChange,
}: AbilityConfigProps): React.ReactElement {
  const id = useId()
  const anchorName = `--a${id.replaceAll(':', '')}`
  const defaults = useMemo(() => extractDefaults(ability), [ability])

  const uiConfigItems = useMemo(() => {
    if (typeof ability.uiConfig !== 'function') {
      return ability.uiConfig
    }
    const effectiveParams = { ...defaults, ...params }
    // Inherit readContext via prototype so class getters (`state`, `api`, …)
    // still resolve; shadow `this` with the ability being rendered.
    const ctx: AbilityReadContext = Object.create(readContext, {
      this: { value: ability, enumerable: true },
    })
    return ability.uiConfig(ctx, effectiveParams)
  }, [ability, defaults, readContext, params])

  const hasConfigItems = uiConfigItems && uiConfigItems.length > 0
  const isCollapsible = !!hasConfigItems
  const [isCollapsed, setIsCollapsed] = useState(true)

  function handleCheckboxChange(key: string, checked: boolean): void {
    onParamsChange({ ...params, [key]: checked })
  }

  function handleListChange(key: string, items: string[]): void {
    onParamsChange({ ...params, [key]: items })
  }

  function handleNumberChange(key: string, value: number): void {
    onParamsChange({ ...params, [key]: value })
  }

  function handleSelectChange(key: string, value: string): void {
    onParamsChange({ ...params, [key]: value })
  }

  function handleRecordNumberChange(
    key: string,
    record: Record<string, number>,
  ): void {
    onParamsChange({ ...params, [key]: record })
  }

  function toggleCollapsed(): void {
    setIsCollapsed(prev => !prev)
  }

  const descriptionIcon = ability.description ? (
    <Tooltip content={ability.description} anchor={anchorName}>
      <QuestionMarkCircledIcon className={styles.descriptionIcon} />
    </Tooltip>
  ) : null

  const headerParamKey = ability.headerUI
  const headerParamValue = headerParamKey
    ? (params[headerParamKey] ?? defaults?.[headerParamKey])
    : undefined
  const isHeaderBoolean = typeof headerParamValue === 'boolean'
  const isHeaderNumber = typeof headerParamValue === 'number'

  function handleContainerClick(e: React.MouseEvent): void {
    if (headerParamKey && isHeaderBoolean && !ability.readOnly) {
      e.stopPropagation()
      handleCheckboxChange(headerParamKey, !params[headerParamKey])
    }
  }

  function handleCollapseClick(e: React.MouseEvent): void {
    e.stopPropagation()
    toggleCollapsed()
  }

  const headerControl = headerParamKey ? (
    isHeaderBoolean ? (
      <Checkbox
        checked={!!params[headerParamKey]}
        disabled={ability.readOnly}
        onChange={checked => handleCheckboxChange(headerParamKey, checked)}
        onClick={event => event.stopPropagation()}
      />
    ) : isHeaderNumber ? (
      <input
        type="number"
        className={styles.headerNumberInput}
        value={
          (params[headerParamKey] ?? defaults?.[headerParamKey] ?? 0) as number
        }
        min={0}
        disabled={ability.readOnly}
        onChange={e => {
          e.stopPropagation()
          handleNumberChange(headerParamKey, Number(e.target.value))
        }}
        onFocus={e => e.target.select()}
        onClick={e => e.stopPropagation()}
      />
    ) : null
  ) : null

  const header = (
    <div className={styles.header}>
      {headerParamKey ? (
        <>
          {isCollapsible ? (
            <button
              type="button"
              className={styles.collapseButton}
              onClick={handleCollapseClick}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
            </button>
          ) : (
            <span className={styles.collapseIndent} />
          )}
          {ability.icon && (
            <span
              className={styles.icon}
              dangerouslySetInnerHTML={{ __html: ability.icon }}
            />
          )}
          <span className={styles.title}>{ability.name}</span>
          {descriptionIcon}
          {headerControl}
        </>
      ) : (
        <button
          type="button"
          className={styles.headerLabel}
          onClick={isCollapsible ? toggleCollapsed : undefined}
          disabled={!isCollapsible}
        >
          {isCollapsible ? (
            <span className={styles.collapseIcon}>
              {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
            </span>
          ) : (
            <span className={styles.collapseIndent} />
          )}
          {ability.icon && (
            <span
              className={styles.icon}
              dangerouslySetInnerHTML={{ __html: ability.icon }}
            />
          )}
          <span className={styles.title}>{ability.name}</span>
          {descriptionIcon}
        </button>
      )}
    </div>
  )

  return (
    <div
      className={`${styles.container} ${headerParamKey ? styles.hasHeaderControl : ''} ${headerParamKey && isHeaderBoolean ? styles.clickable : ''} ${ability.readOnly ? styles.readOnly : ''} ${ability.context && ability.context !== combatMode ? styles.dimmed : ''}`}
      style={
        ability.description
          ? ({ anchorName } as React.CSSProperties)
          : undefined
      }
      onClick={
        headerParamKey && isHeaderBoolean && !ability.readOnly
          ? handleContainerClick
          : undefined
      }
    >
      {header}
      {hasConfigItems && !isCollapsed && (
        <div className={styles.configItems} onClick={e => e.stopPropagation()}>
          {uiConfigItems!.map(config => {
            const key = config.key as string
            const defaultValue = config.defaultValue ?? defaults?.[key]

            if (config.type === 'checkbox') {
              const value = params[key] ?? defaultValue ?? false
              return (
                <label key={key} className={styles.configItemLabel}>
                  <span className={styles.configItemText}>{config.label}</span>
                  <Checkbox
                    checked={!!value}
                    onChange={checked => handleCheckboxChange(key, checked)}
                  />
                </label>
              )
            }

            if (config.type === 'number') {
              const value = (params[key] ?? defaultValue ?? 0) as number
              return (
                <label key={key} className={styles.configItemLabel}>
                  <span className={styles.configItemText}>{config.label}</span>
                  <input
                    type="number"
                    className={styles.numberInput}
                    value={value}
                    min={config.min}
                    max={config.max}
                    onChange={e =>
                      handleNumberChange(key, Number(e.target.value))
                    }
                    onFocus={e => e.target.select()}
                  />
                </label>
              )
            }

            if (config.type === 'select') {
              const value = (params[key] ?? defaultValue ?? '') as string
              return (
                <div key={key} className={styles.configItemLabel}>
                  <span className={styles.configItemText}>{config.label}</span>
                  <Select
                    value={value}
                    onValueChange={v => handleSelectChange(key, v)}
                  >
                    <SelectTrigger className={styles.selectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={styles.selectContent}>
                      {config.items.map(item =>
                        'group' in item ? (
                          <SelectGroup key={item.group}>
                            <SelectLabel className={styles.selectLabel}>
                              {item.group}
                            </SelectLabel>
                            {item.items.map(gi => (
                              <SelectItem
                                key={gi.value}
                                value={gi.value}
                                className={styles.selectItem}
                              >
                                {gi.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ) : (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                            className={styles.selectItem}
                          >
                            {item.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )
            }

            if (
              config.type === 'order-list' ||
              config.type === 'checkbox-list' ||
              config.type === 'priority-list'
            ) {
              const value = (params[key] ?? defaultValue ?? []) as string[]
              const ListComponent =
                config.type === 'order-list'
                  ? OrderList
                  : config.type === 'priority-list'
                    ? PriorityList
                    : CheckboxList

              return (
                <div key={key} className={styles.configItemGroup}>
                  {config.label && (
                    <span className={styles.configItemText}>
                      {config.label}
                    </span>
                  )}
                  <ListComponent
                    items={config.items}
                    value={value}
                    onChange={items => handleListChange(key, items)}
                  />
                </div>
              )
            }

            if (
              config.type === 'number-list' ||
              config.type === 'priority-number-list'
            ) {
              const value = (params[key] ?? defaultValue ?? {}) as Record<
                string,
                number
              >
              const ListComp =
                config.type === 'priority-number-list'
                  ? PriorityNumberList
                  : NumberList
              return (
                <div key={key} className={styles.configItemGroup}>
                  {config.label && (
                    <span className={styles.configItemText}>
                      {config.label}
                    </span>
                  )}
                  <ListComp
                    items={config.items}
                    value={value}
                    onChange={record => handleRecordNumberChange(key, record)}
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
