import { clsx } from 'clsx'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import factions from '@/data/faction'
import type { Faction, FactionKey } from '@/types'

import styles from './faction-select.module.css'

const FACTION_ENTRIES = (
  Object.entries(factions) as Array<[string, Faction]>
).sort((a, b) => {
  if (a[0] === 'NEUTRAL') return 1
  if (b[0] === 'NEUTRAL') return -1
  return a[1].name.localeCompare(b[1].name)
})

function FactionIcon({ icon }: { icon: string }) {
  return (
    <span className={styles.icon} dangerouslySetInnerHTML={{ __html: icon }} />
  )
}

interface FactionSelectProps {
  value: FactionKey
  onValueChange: (value: FactionKey) => void
  className?: string
  align?: 'start' | 'center' | 'end'
}

export function FactionSelect({
  value,
  onValueChange,
  className,
  align,
}: FactionSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={clsx(styles.trigger, className)}>
        <SelectValue placeholder="Select faction" />
      </SelectTrigger>
      <SelectContent className={styles.content} align={align}>
        {FACTION_ENTRIES.map(([key, faction]) => (
          <SelectItem key={key} value={key} className={styles.item}>
            <span className={styles.itemContent}>
              {faction.icon ? (
                <FactionIcon icon={faction.icon} />
              ) : (
                <span className={styles.iconIndent} />
              )}
              <span className={styles.itemName}>{faction.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
