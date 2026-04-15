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

import { Checkbox } from '@/components/ui/checkbox'

import styles from './priority-list.module.css'

interface PriorityListItem {
  label: string
  value: string
}

interface PriorityListProps {
  items: readonly PriorityListItem[]
  value: string[]
  onChange: (values: string[]) => void
}

interface SortableRowProps {
  id: string
  label: string
  checked: boolean
  onToggle: (value: string) => void
}

function SortableRow({
  id,
  label,
  checked,
  onToggle,
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
        checked && styles.checked,
        isDragging && styles.dragging,
      )}
      onClick={() => onToggle(id)}
      {...attributes}
      {...listeners}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.dragHandle}>
        <DragHandleDots2Icon />
      </span>
      <span
        className={styles.checkboxWrapper}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <Checkbox checked={checked} onChange={() => onToggle(id)} />
      </span>
    </div>
  )
}

export function PriorityList({
  items,
  value,
  onChange,
}: PriorityListProps): React.ReactElement {
  const itemValues = useMemo(() => new Set(items.map(i => i.value)), [items])

  const [fullOrder, setFullOrder] = useState<string[]>(() => {
    const checkedInOrder = value.filter(v => itemValues.has(v))
    const unchecked = items
      .map(i => i.value)
      .filter(v => !checkedInOrder.includes(v))
    return [...checkedInOrder, ...unchecked]
  })

  // Recompute fullOrder when items change (units added/removed)
  const displayOrder = useMemo(() => {
    const kept = fullOrder.filter(v => itemValues.has(v))
    const keptSet = new Set(kept)
    const itemsOrder = items.map(i => i.value)
    const newItems = itemsOrder.filter(v => !keptSet.has(v))
    if (newItems.length === 0 && kept.length === fullOrder.length) {
      return fullOrder
    }
    if (newItems.length === 0) {
      return kept
    }
    // Insert new items at their natural position relative to existing items
    const result = [...kept]
    for (const newItem of newItems) {
      const naturalIndex = itemsOrder.indexOf(newItem)
      let insertAfter = -1
      for (let i = naturalIndex - 1; i >= 0; i--) {
        const idx = result.indexOf(itemsOrder[i])
        if (idx !== -1) {
          insertAfter = idx
          break
        }
      }
      result.splice(insertAfter + 1, 0, newItem)
    }
    return result
  }, [fullOrder, itemValues, items])

  // Sync internal state if displayOrder diverged
  if (displayOrder !== fullOrder) {
    setFullOrder(displayOrder)
  }

  const checkedSet = useMemo(() => new Set(value), [value])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
  )

  function handleToggle(itemValue: string): void {
    if (checkedSet.has(itemValue)) {
      onChange(value.filter(v => v !== itemValue))
    } else {
      // Insert at position relative to other checked items in display order
      const newValue: string[] = []
      for (const v of displayOrder) {
        if (v === itemValue || checkedSet.has(v)) {
          newValue.push(v)
        }
      }
      onChange(newValue)
    }
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = displayOrder.indexOf(active.id as string)
    const newIndex = displayOrder.indexOf(over.id as string)
    const newOrder = arrayMove(displayOrder, oldIndex, newIndex)
    setFullOrder(newOrder)

    // Recompute checked value in new display order
    const newValue = newOrder.filter(v => checkedSet.has(v))
    if (newValue.join(',') !== value.join(',')) {
      onChange(newValue)
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
              checked={checkedSet.has(val)}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
