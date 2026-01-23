import { clsx } from 'clsx'

import styles from './icon-button.module.css'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function IconButton({
  children,
  className,
  type = 'button',
  ...props
}: IconButtonProps): React.ReactElement {
  return (
    <button type={type} className={clsx(styles.button, className)} {...props}>
      {children}
    </button>
  )
}
