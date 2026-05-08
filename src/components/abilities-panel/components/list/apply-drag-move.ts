import { arrayMove } from '@dnd-kit/sortable'

/**
 * Compute the post-drag id order, or `null` if the move must be rejected.
 *
 * Rejection cases:
 * - `fromId` or `toId` not present in `ids`.
 * - `fromId` is itself stable (stable items can't be dragged).
 * - The pre-drag first id is stable and the move would displace it.
 * - The pre-drag last id is stable and the move would displace it.
 */
export function applyDragMove(
  ids: readonly string[],
  fromId: string,
  toId: string,
  stableIds: ReadonlySet<string>,
): string[] | null {
  const oldIndex = ids.indexOf(fromId)
  const newIndex = ids.indexOf(toId)
  if (oldIndex === -1 || newIndex === -1) return null
  if (stableIds.has(fromId)) return null

  const next = arrayMove([...ids], oldIndex, newIndex)
  const last = ids.length - 1

  const firstId = ids[0]
  if (firstId !== undefined && stableIds.has(firstId) && next[0] !== firstId) {
    return null
  }
  const lastId = ids[last]
  if (lastId !== undefined && stableIds.has(lastId) && next[last] !== lastId) {
    return null
  }
  return next
}
