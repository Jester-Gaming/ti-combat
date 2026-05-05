import { clsx } from 'clsx'

import styles from './button-icon-plain.module.css'

interface ButtonIconPlainProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function ButtonIconPlain({
  children,
  className,
  type = 'button',
  ...props
}: ButtonIconPlainProps): React.ReactElement {
  return (
    <button type={type} className={clsx(styles.button, className)} {...props}>
      {children}
    </button>
  )
}
