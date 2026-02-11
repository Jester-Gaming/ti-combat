import { clsx } from 'clsx'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import factions from '@/data/faction'
import type { FactionKey } from '@/types'

import styles from './faction-select.module.css'

const FACTION_ENTRIES = (
  Object.entries(factions) as Array<[string, { name: string }]>
).sort((a, b) => {
  if (a[0] === 'NEUTRAL') return 1
  if (b[0] === 'NEUTRAL') return -1
  return a[1].name.localeCompare(b[1].name)
})

interface FactionSelectProps {
  value: FactionKey
  onValueChange: (value: FactionKey) => void
  className?: string
}

export function FactionSelect({
  value,
  onValueChange,
  className,
}: FactionSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={clsx(styles.trigger, className)}>
        <SelectValue placeholder="Select faction" />
      </SelectTrigger>
      <SelectContent className={styles.content}>
        {FACTION_ENTRIES.map(([key, faction]) => (
          <SelectItem key={key} value={key} className={styles.item}>
            {faction.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
