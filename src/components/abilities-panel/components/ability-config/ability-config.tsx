import {
  ChevronDownIcon,
  ChevronRightIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons'
import clsx from 'clsx'
import { useId, useMemo, useRef, useState } from 'react'

import {
  type Ability,
  type AbilityReadContext,
  type CombatMode,
  extractDefaults,
} from '@/combat'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'

import { List } from '../list'
import { Select } from '../select'
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
  const headerUiRef = useRef<HTMLInputElement>(null)

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
  const headerParamType = typeof headerParamValue as 'boolean' | 'number'
  const isHeaderBoolean = typeof headerParamValue === 'boolean'

  function handleContainerClick(e: React.MouseEvent): void {
    if (ability.readOnly || !headerParamKey) {
      return
    }

    if (headerParamType === 'boolean') {
      e.stopPropagation()
      handleCheckboxChange(headerParamKey, !params[headerParamKey])
    }

    if (headerParamType === 'number') {
      e.stopPropagation()
      headerUiRef.current?.focus()
    }
  }

  function handleCollapseClick(e: React.MouseEvent): void {
    e.stopPropagation()
    toggleCollapsed()
  }

  const headerControl =
    !!headerParamKey &&
    {
      boolean: (
        <Checkbox
          checked={!!params[headerParamKey]}
          disabled={ability.readOnly}
          className={styles.headerCheckbox}
          onChange={checked => handleCheckboxChange(headerParamKey, checked)}
          onClick={event => event.stopPropagation()}
          ref={headerUiRef}
        />
      ),
      number: (
        <Input
          square
          value={
            (params[headerParamKey] ??
              defaults?.[headerParamKey] ??
              0) as number
          }
          min={0}
          disabled={ability.readOnly}
          onChange={value => handleNumberChange(headerParamKey, value)}
          onClick={e => e.stopPropagation()}
          ref={headerUiRef}
          active={!!params[headerParamKey]}
        />
      ),
    }[headerParamType]

  const header = (
    <div className={styles.header}>
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
    </div>
  )

  return (
    <div
      className={clsx({
        [styles.container]: true,
        [styles.container_clickable]: headerParamKey && isHeaderBoolean,
        [styles.container_readOnly]: ability.readOnly,
        [styles.container_active]: !!headerParamValue,
        [styles.container_dimmed]:
          ability.context && ability.context !== combatMode,
      })}
      style={
        ability.description
          ? ({ anchorName } as React.CSSProperties)
          : undefined
      }
      onClick={handleContainerClick}
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
                  <Input
                    value={value}
                    min={config.min}
                    max={config.max}
                    onChange={v => handleNumberChange(key, v)}
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
                    items={config.items}
                    value={value}
                    onChange={v => handleSelectChange(key, v)}
                  />
                </div>
              )
            }

            if (
              config.type === 'order-list' ||
              config.type === 'checkbox-list' ||
              config.type === 'checkbox-list-sortable'
            ) {
              const value = (params[key] ?? defaultValue ?? []) as string[]
              const mode = config.type === 'order-list' ? 'order' : 'checkbox'
              return (
                <div key={key} className={styles.configItemGroup}>
                  {config.label && (
                    <span className={styles.configItemText}>
                      {config.label}
                    </span>
                  )}
                  <List
                    mode={mode}
                    sortable={config.type === 'checkbox-list-sortable'}
                    items={config.items}
                    value={value}
                    onChange={items => handleListChange(key, items)}
                  />
                </div>
              )
            }

            if (
              config.type === 'number-list' ||
              config.type === 'number-list-sortable'
            ) {
              const value = (params[key] ?? defaultValue ?? {}) as Record<
                string,
                number
              >
              return (
                <div key={key} className={styles.configItemGroup}>
                  {config.label && (
                    <span className={styles.configItemText}>
                      {config.label}
                    </span>
                  )}
                  <List
                    mode="number"
                    sortable={config.type === 'number-list-sortable'}
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
