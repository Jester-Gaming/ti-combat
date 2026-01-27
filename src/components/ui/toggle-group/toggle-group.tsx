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
    <div className={clsx('inline-flex rounded-lg bg-white/5 p-1', className)}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
            value === option.value
              ? 'bg-white/20 text-white shadow-sm'
              : 'text-white/60 hover:bg-white/10 hover:text-white/80',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
