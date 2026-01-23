import { clsx } from 'clsx'

import styles from './glow-text.module.css'

interface GlowTextProps {
  children: React.ReactNode
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'label'
  className?: string
  style?: React.CSSProperties
}

export function GlowText({
  children,
  as: Component = 'span',
  className,
  style,
}: GlowTextProps): React.ReactElement {
  return (
    <Component className={clsx(styles.text, className)} style={style}>
      {children}
    </Component>
  )
}
