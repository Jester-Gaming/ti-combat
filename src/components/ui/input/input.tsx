import { clsx } from 'clsx'
import { forwardRef } from 'react'

import styles from './input.module.css'

interface InputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  square?: boolean
  active?: boolean
  disabled?: boolean
  onClick?: React.MouseEventHandler<HTMLInputElement>
  onPointerDown?: React.PointerEventHandler<HTMLInputElement>
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    value,
    onChange,
    min,
    max,
    step = 1,
    square,
    active,
    disabled,
    onClick,
    onPointerDown,
  },
  ref,
): React.ReactElement {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const raw = e.target.valueAsNumber
    const parsed = isNaN(raw) ? 0 : Math.trunc(raw)
    const lower = min ?? 0
    const upper = max ?? Infinity
    const clamped = Math.min(upper, Math.max(lower, parsed))
    onChange(clamped)
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>): void {
    e.target.select()
  }

  return (
    <input
      ref={ref}
      type="number"
      className={clsx(styles.input, {
        [styles.input_square]: square,
        [styles.input_active]: active,
      })}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={handleChange}
      onFocus={handleFocus}
      onClick={onClick}
      onPointerDown={onPointerDown}
    />
  )
})
