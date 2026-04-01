import { clsx } from 'clsx'

import styles from './icon-button.module.css'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  isLoading?: boolean
}

export function IconButton({
  children,
  className,
  type = 'button',
  isLoading,
  disabled,
  ...props
}: IconButtonProps): React.ReactElement {
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
