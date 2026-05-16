import { clsx } from 'clsx'

import styles from './toggle-group.module.css'

interface ToggleGroupOption<T extends string> {
  value: T
  label: string
}

interface ToggleGroupProps<T extends string> {
  options: ToggleGroupOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  className,
}: ToggleGroupProps<T>) {
  return (
    <div className={clsx(styles.group, className)}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className={clsx(
            styles.button,
            option.value === value && styles.active,
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
