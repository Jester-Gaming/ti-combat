export type AbilitySlot =
  | 'GENERAL'
  | 'ADVANCED'
  | 'TECHNOLOGY'
  | 'ACTION_CARD'
  | 'RELIC'
  | 'AGENDA'
  | 'ENVIRONMENT'
  | 'FACTION_ABILITY'
  | 'FACTION_TECHNOLOGY'
  | 'FACTION_AGENT'
  | 'FACTION_COMMANDER'
  | 'FACTION_HERO'
  | 'FACTION_BREAKTHROUGH'
  | 'PROMISSORY'
  | 'AGENT'
  | 'COMMANDER'
  | 'FACTION_FLAGSHIP'
  | 'FACTION_MECH'
  | 'FACTION_UNIT'
  | 'OTHER'

export interface SlotDisplay {
  category: string
  subcategory?: string
}

export const SLOT_DISPLAY: Record<AbilitySlot, SlotDisplay> = {
  GENERAL: { category: 'GENERAL' },
  ADVANCED: { category: 'ADVANCED' },
  TECHNOLOGY: { category: 'TECHNOLOGY' },
  ACTION_CARD: { category: 'ACTION_CARD' },
  RELIC: { category: 'RELIC' },
  AGENDA: { category: 'AGENDA' },
  ENVIRONMENT: { category: 'ENVIRONMENT' },
  PROMISSORY: { category: 'PROMISSORY' },
  AGENT: { category: 'AGENT' },
  COMMANDER: { category: 'COMMANDER' },
  FACTION_ABILITY: { category: 'FACTION', subcategory: 'ABILITY' },
  FACTION_TECHNOLOGY: { category: 'FACTION', subcategory: 'TECHNOLOGY' },
  FACTION_AGENT: { category: 'FACTION', subcategory: 'AGENT' },
  FACTION_COMMANDER: { category: 'FACTION', subcategory: 'COMMANDER' },
  FACTION_HERO: { category: 'FACTION', subcategory: 'HERO' },
  FACTION_BREAKTHROUGH: { category: 'FACTION', subcategory: 'BREAKTHROUGH' },
  FACTION_FLAGSHIP: { category: 'FACTION', subcategory: 'FLAGSHIP' },
  FACTION_MECH: { category: 'FACTION', subcategory: 'MECH' },
  FACTION_UNIT: { category: 'FACTION', subcategory: 'UNIT' },
  OTHER: { category: 'OTHER' },
}

/** Render order — used by the abilities panel to sort top-level groups
 *  (and FACTION subgroups). */
export const SLOT_ORDER: readonly AbilitySlot[] = [
  'GENERAL',
  'FACTION_ABILITY',
  'FACTION_FLAGSHIP',
  'FACTION_AGENT',
  'FACTION_COMMANDER',
  'FACTION_HERO',
  'FACTION_MECH',
  'FACTION_BREAKTHROUGH',
  'FACTION_TECHNOLOGY',
  'FACTION_UNIT',
  'TECHNOLOGY',
  'ACTION_CARD',
  'PROMISSORY',
  'AGENT',
  'COMMANDER',
  'RELIC',
  'AGENDA',
  'ENVIRONMENT',
  'OTHER',
  'ADVANCED',
]
