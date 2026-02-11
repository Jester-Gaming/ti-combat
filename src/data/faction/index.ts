import type { Faction } from '@/types'

import { nekro_virus } from './nekro_virus'
import { otherFactions } from './other-factions'

export default {
  ...otherFactions,
  NEKRO_VIRUS: nekro_virus,
} satisfies Record<string, Faction>
