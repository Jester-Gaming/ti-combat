import { clsx } from 'clsx'

interface ToggleOption<T extends string> {
  value: T
  label: string
}

interface ToggleGroupProps<T extends string> {
  options: ToggleOption<T>[]
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
    <div
      className={clsx('bg-foreground/5 inline-flex rounded-lg p-1', className)}
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
            value === option.value
              ? 'bg-foreground/15 text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-foreground/8 hover:text-foreground/80',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
