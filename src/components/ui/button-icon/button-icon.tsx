import { clsx } from 'clsx'

import styles from './button-icon.module.css'

interface ButtonIconProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  isLoading?: boolean
}

export function ButtonIcon({
  children,
  className,
  type = 'button',
  isLoading,
  disabled,
  ...props
}: ButtonIconProps): React.ReactElement {
  return (
    <button
      type={type}
      className={clsx(styles.button, className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className={styles.dots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </span>
      ) : (
        children
      )}
    </button>
  )
}
