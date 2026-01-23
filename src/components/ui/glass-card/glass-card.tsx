import { clsx } from 'clsx'

import styles from './glass-card.module.css'

type GlassCardProps<T extends React.ElementType = 'div'> = {
  as?: T
  children: React.ReactNode
  className?: string
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

export function GlassCard<T extends React.ElementType = 'div'>({
  as,
  children,
  className,
  ...props
}: GlassCardProps<T>): React.ReactElement {
  const Component = as || 'div'
  return (
    <Component className={clsx(styles.card, className)} {...props}>
      {children}
    </Component>
  )
}
