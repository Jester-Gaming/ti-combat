import { clsx } from 'clsx'

import styles from './divider.module.css'

interface DividerProps {
  className?: string
}

export function Divider({ className }: DividerProps) {
  return <div className={clsx(styles.divider, className)} />
}
