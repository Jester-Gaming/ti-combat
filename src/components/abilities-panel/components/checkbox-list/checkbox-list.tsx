import { clsx } from 'clsx'
import { useMemo, useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'

import styles from './checkbox-list.module.css'

interface CheckboxListItem {
  label: string
  value: string
}

interface CheckboxListProps {
  items: readonly CheckboxListItem[]
  value: string[]
  onChange: (values: string[]) => void
}

export function CheckboxList({
  items,
  value,
  onChange,
}: CheckboxListProps): React.ReactElement {
  const itemValues = useMemo(() => new Set(items.map(i => i.value)), [items])

  const [fullOrder, setFullOrder] = useState<string[]>(() => {
    const checkedInOrder = value.filter(v => itemValues.has(v))
    const unchecked = items
      .map(i => i.value)
      .filter(v => !checkedInOrder.includes(v))
    return [...checkedInOrder, ...unchecked]
  })

  const displayOrder = useMemo(() => {
    const kept = fullOrder.filter(v => itemValues.has(v))
    const keptSet = new Set(kept)
    const itemsOrder = items.map(i => i.value)
    const newItems = itemsOrder.filter(v => !keptSet.has(v))
    if (newItems.length === 0 && kept.length === fullOrder.length) {
      return fullOrder
    }
    if (newItems.length === 0) {
      return kept
    }
    const valueSet = new Set(value)
    const result = [...kept]
    for (const newItem of newItems) {
      const refOrder = valueSet.has(newItem) ? value : itemsOrder
      const naturalIndex = refOrder.indexOf(newItem)
      let insertAfter = -1
      for (let i = naturalIndex - 1; i >= 0; i--) {
        const idx = result.indexOf(refOrder[i])
        if (idx !== -1) {
          insertAfter = idx
          break
        }
      }
      result.splice(insertAfter + 1, 0, newItem)
    }
    return result
  }, [fullOrder, itemValues, items, value])

  if (displayOrder !== fullOrder) {
    setFullOrder(displayOrder)
  }

  const checkedSet = useMemo(() => new Set(value), [value])
  const labelMap = useMemo(
    () => new Map(items.map(i => [i.value, i.label])),
    [items],
  )

  function handleToggle(itemValue: string): void {
    if (checkedSet.has(itemValue)) {
      onChange(value.filter(v => v !== itemValue))
    } else {
      const newValue: string[] = []
      for (const v of displayOrder) {
        if (v === itemValue || checkedSet.has(v)) {
          newValue.push(v)
        }
      }
      onChange(newValue)
    }
  }

  return (
    <div className={styles.list}>
      {displayOrder.map(val => {
        const isSelected = checkedSet.has(val)
        return (
          <div
            key={val}
            className={clsx(styles.item, isSelected && styles.selected)}
            onClick={() => handleToggle(val)}
          >
            <span className={styles.label} title={labelMap.get(val) ?? val}>
              {labelMap.get(val) ?? val}
            </span>
            <span
              className={styles.checkboxWrapper}
              onClick={e => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => handleToggle(val)}
              />
            </span>
          </div>
        )
      })}
    </div>
  )
}
