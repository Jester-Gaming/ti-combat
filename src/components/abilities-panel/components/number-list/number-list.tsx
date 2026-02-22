import { clsx } from 'clsx'

import styles from './number-list.module.css'

interface NumberListItem {
  label: string
  value: string
  max?: number
}

interface NumberListProps {
  items: readonly NumberListItem[]
  value: Record<string, number>
  onChange: (values: Record<string, number>) => void
}

export function NumberList({
  items,
  value,
  onChange,
}: NumberListProps): React.ReactElement {
  function handleChange(itemValue: string, count: number, max?: number): void {
    const clamped = Math.max(0, max != null ? Math.min(count, max) : count)
    if (clamped === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [itemValue]: _, ...rest } = value
      onChange(rest)
    } else {
      onChange({ ...value, [itemValue]: clamped })
    }
  }

  return (
    <div className={styles.list}>
      {items.map(item => {
        const count = value[item.value] ?? 0
        const isActive = count > 0
        return (
          <div
            key={item.value}
            className={clsx(styles.item, isActive && styles.active)}
          >
            <span className={styles.label}>{item.label}</span>
            <input
              type="number"
              className={styles.input}
              value={count}
              min={0}
              max={item.max}
              onChange={e =>
                handleChange(item.value, Number(e.target.value), item.max)
              }
              onFocus={e => e.target.select()}
            />
          </div>
        )
      })}
    </div>
  )
}
