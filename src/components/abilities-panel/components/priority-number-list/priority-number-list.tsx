import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragHandleDots2Icon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { useMemo, useState } from 'react'

import styles from './priority-number-list.module.css'

export interface PriorityNumberListItem {
  label: string
  value: string
  max?: number
}

interface PriorityNumberListProps {
  items: readonly PriorityNumberListItem[]
  value: Record<string, number>
  onChange: (values: Record<string, number>) => void
}

interface SortableRowProps {
  id: string
  label: string
  count: number
  max?: number
  onCountChange: (value: string, count: number) => void
}

function SortableRow({
  id,
  label,
  count,
  max,
  onCountChange,
}: SortableRowProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        styles.item,
        count > 0 && styles.active,
        isDragging && styles.dragging,
      )}
      {...attributes}
      {...listeners}
    >
      <span className={styles.label} title={label}>
        {label}
      </span>
      <span className={styles.dragHandle}>
        <DragHandleDots2Icon />
      </span>
      <input
        type="number"
        className={styles.input}
        value={count}
        min={0}
        max={max}
        onPointerDown={e => e.stopPropagation()}
        onChange={e => onCountChange(id, Number(e.target.value))}
        onFocus={e => e.target.select()}
      />
    </div>
  )
}

export function PriorityNumberList({
  items,
  value,
  onChange,
}: PriorityNumberListProps): React.ReactElement {
  const itemValues = useMemo(() => new Set(items.map(i => i.value)), [items])

  const [fullOrder, setFullOrder] = useState<string[]>(() => {
    // Active items (from value) first in their key order, then remaining items
    const activeInOrder = Object.keys(value).filter(v => itemValues.has(v))
    const inactive = items
      .map(i => i.value)
      .filter(v => !activeInOrder.includes(v))
    return [...activeInOrder, ...inactive]
  })

  // Recompute when items change (units added/removed)
  const displayOrder = useMemo(() => {
    const kept = fullOrder.filter(v => itemValues.has(v))
    const keptSet = new Set(kept)
    const newItems = items.map(i => i.value).filter(v => !keptSet.has(v))
    if (newItems.length === 0 && kept.length === fullOrder.length) {
      return fullOrder
    }
    return [...kept, ...newItems]
  }, [fullOrder, itemValues, items])

  if (displayOrder !== fullOrder) {
    setFullOrder(displayOrder)
  }

  const maxMap = useMemo(
    () => new Map(items.map(i => [i.value, i.max])),
    [items],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
  )

  function buildRecord(order: string[]): Record<string, number> {
    const result: Record<string, number> = {}
    for (const key of order) {
      const count = value[key]
      if (count && count > 0) {
        result[key] = count
      }
    }
    return result
  }

  function handleCountChange(itemValue: string, count: number): void {
    const max = maxMap.get(itemValue)
    const clamped = Math.max(0, max != null ? Math.min(count, max) : count)
    const newValue = { ...value }
    if (clamped === 0) {
      delete newValue[itemValue]
    } else {
      newValue[itemValue] = clamped
    }
    // Rebuild in display order
    const result: Record<string, number> = {}
    for (const key of displayOrder) {
      if (newValue[key]) result[key] = newValue[key]
    }
    onChange(result)
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = displayOrder.indexOf(active.id as string)
    const newIndex = displayOrder.indexOf(over.id as string)
    const newOrder = arrayMove(displayOrder, oldIndex, newIndex)
    setFullOrder(newOrder)

    const newRecord = buildRecord(newOrder)
    if (Object.keys(newRecord).join(',') !== Object.keys(value).join(',')) {
      onChange(newRecord)
    }
  }

  const labelMap = useMemo(
    () => new Map(items.map(i => [i.value, i.label])),
    [items],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={displayOrder}
        strategy={verticalListSortingStrategy}
      >
        <div className={styles.list}>
          {displayOrder.map(val => (
            <SortableRow
              key={val}
              id={val}
              label={labelMap.get(val) ?? val}
              count={value[val] ?? 0}
              max={maxMap.get(val)}
              onCountChange={handleCountChange}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
