import { clsx } from 'clsx'

import { Checkbox } from '@/components/ui/checkbox'

import styles from './checkbox-list.module.css'

export interface CheckboxListItem {
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
  const selectedSet = new Set(value)

  function handleToggle(itemValue: string): void {
    if (selectedSet.has(itemValue)) {
      onChange(value.filter(v => v !== itemValue))
    } else {
      onChange([...value, itemValue])
    }
  }

  return (
    <div className={styles.list}>
      {items.map(item => {
        const isSelected = selectedSet.has(item.value)
        return (
          <div
            key={item.value}
            className={clsx(styles.item, isSelected && styles.selected)}
            onClick={() => handleToggle(item.value)}
          >
            <span
              className={styles.checkboxWrapper}
              onClick={e => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => handleToggle(item.value)}
              />
            </span>
            <span className={styles.label}>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}
