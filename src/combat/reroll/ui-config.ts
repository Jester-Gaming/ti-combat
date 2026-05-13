import type { UIConfigItem } from '@/combat/abilities-engine/types'

import type { RerollStrategy } from './types'

const KIND_ITEMS = [
  { label: 'Never', value: 'NEVER' },
  { label: 'Always', value: 'ALWAYS' },
  { label: 'If hits ≤ N', value: 'IF_HITS_AMOUNT_LE' },
  { label: 'If hits ≥ N', value: 'IF_HITS_AMOUNT_GE' },
  { label: 'If worse than N%', value: 'IF_HITS_PERCENT_LE' },
  { label: 'If better than N%', value: 'IF_HITS_PERCENT_GE' },
]

export function rerollStrategyConfig<TParams = Record<string, unknown>>(
  kindKey: keyof TParams,
  thresholdKey: keyof TParams,
  kindValue: RerollStrategy['kind'],
  label?: string,
): UIConfigItem<TParams>[] {
  const items: UIConfigItem<TParams>[] = [
    { type: 'select', key: kindKey, label, items: KIND_ITEMS },
  ]
  if (kindValue !== 'NEVER' && kindValue !== 'ALWAYS') {
    items.push({
      type: 'number',
      key: thresholdKey,
      label: 'Threshold',
      min: 0,
    })
  }
  return items
}

export function buildRerollStrategy(
  kind: RerollStrategy['kind'],
  threshold: number,
): RerollStrategy {
  if (kind === 'NEVER' || kind === 'ALWAYS') return { kind }
  return { kind, threshold }
}
