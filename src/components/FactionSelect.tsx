import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import factions from '@/data/faction'
import type { FactionKey } from '@/types'

const FACTION_ENTRIES = Object.entries(factions) as Array<
  [string, { name: string }]
>

interface FactionSelectProps {
  value: FactionKey
  onValueChange: (value: FactionKey) => void
}

export function FactionSelect({ value, onValueChange }: FactionSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select faction" />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {FACTION_ENTRIES.map(([key, faction]) => (
          <SelectItem key={key} value={key}>
            {faction.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
