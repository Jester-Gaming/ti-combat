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

import styles from './list.module.css'

export interface ListItem {
  label: string
  value: string
  max?: number
}

interface CommonProps {
  items: readonly ListItem[]
  sortable?: boolean
}

export type ListProps = CommonProps &
  (
    | {
        mode: 'checkbox'
        value: string[]
        onChange: (values: string[]) => void
      }
    | {
        mode: 'number'
        value: Record<string, number>
        onChange: (values: Record<string, number>) => void
      }
    | {
        mode: 'order'
        value: string[]
        onChange: (values: string[]) => void
      }
  )

export function List(props: ListProps): React.ReactElement {
  const sortable = props.mode === 'order' || props.sortable === true
  const [displayOrder, setFullOrder] = useDisplayOrder(props)
  const labelMap = useMemo(
    () => new Map(props.items.map(i => [i.value, i.label])),
    [props.items],
  )
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
  )

  function handleToggle(id: string): void {
    if (props.mode !== 'checkbox') return
    const checked = new Set(props.value)
    if (checked.has(id)) {
      props.onChange(props.value.filter(v => v !== id))
    } else {
      const next: string[] = []
      for (const v of displayOrder) {
        if (v === id || checked.has(v)) next.push(v)
      }
      props.onChange(next)
    }
  }

  function handleCountChange(id: string, count: number): void {
    if (props.mode !== 'number') return
    const item = props.items.find(i => i.value === id)
    const max = item?.max
    const clamped = Math.max(0, max != null ? Math.min(count, max) : count)
    const next = { ...props.value }
    if (clamped === 0) delete next[id]
    else next[id] = clamped
    const result: Record<string, number> = {}
    for (const key of displayOrder) {
      if (next[key]) result[key] = next[key]
    }
    props.onChange(result)
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = displayOrder.indexOf(active.id as string)
    const newIndex = displayOrder.indexOf(over.id as string)
    const newOrder = arrayMove(displayOrder, oldIndex, newIndex)
    setFullOrder(newOrder)

    if (props.mode === 'order') {
      props.onChange(newOrder)
      return
    }
    if (props.mode === 'checkbox') {
      const checked = new Set(props.value)
      const next = newOrder.filter(v => checked.has(v))
      if (next.join(',') !== props.value.join(',')) props.onChange(next)
      return
    }
    const result: Record<string, number> = {}
    for (const key of newOrder) {
      const c = props.value[key]
      if (c && c > 0) result[key] = c
    }
    if (Object.keys(result).join(',') !== Object.keys(props.value).join(',')) {
      props.onChange(result)
    }
  }

  function isActive(id: string): boolean {
    if (props.mode === 'checkbox') return props.value.includes(id)
    if (props.mode === 'number') return (props.value[id] ?? 0) > 0
    return false
  }

  function renderRight(id: string, index: number): React.ReactElement {
    if (props.mode === 'checkbox') {
      const checked = props.value.includes(id)
      return (
        <span
          className={styles.checkboxWrapper}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <Checkbox checked={checked} onChange={() => handleToggle(id)} />
        </span>
      )
    }
    if (props.mode === 'number') {
      const item = props.items.find(i => i.value === id)
      const count = props.value[id] ?? 0
      return (
        <input
          type="number"
          className={styles.input}
          value={count}
          min={0}
          max={item?.max}
          onPointerDown={e => e.stopPropagation()}
          onChange={e => handleCountChange(id, Number(e.target.value))}
          onFocus={e => e.target.select()}
        />
      )
    }
    return <span className={styles.priorityNumber}>{index + 1}</span>
  }

  if (sortable) {
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
            {displayOrder.map((id, index) => (
              <SortableRow
                key={id}
                id={id}
                label={labelMap.get(id) ?? id}
                active={isActive(id)}
                onRowClick={
                  props.mode === 'checkbox' ? () => handleToggle(id) : undefined
                }
              >
                {renderRight(id, index)}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    )
  }

  const isClickable = props.mode === 'checkbox'
  return (
    <div className={styles.list}>
      {displayOrder.map((id, index) => {
        const label = labelMap.get(id) ?? id
        return (
          <div
            key={id}
            className={clsx(
              styles.item,
              isActive(id) && styles.item_active,
              isClickable && styles.item_clickable,
            )}
            onClick={isClickable ? () => handleToggle(id) : undefined}
          >
            <span className={styles.label} title={label}>
              {label}
            </span>
            {renderRight(id, index)}
          </div>
        )
      })}
    </div>
  )
}

interface SortableRowProps {
  id: string
  label: string
  active: boolean
  onRowClick?: () => void
  children: React.ReactNode
}

function SortableRow({
  id,
  label,
  active,
  onRowClick,
  children,
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
        styles.item_sortable,
        active && styles.item_active,
        isDragging && styles.item_dragging,
      )}
      onClick={onRowClick}
      {...attributes}
      {...listeners}
    >
      <span className={styles.label} title={label}>
        {label}
      </span>
      <span className={styles.dragHandle}>
        <DragHandleDots2Icon />
      </span>
      {children}
    </div>
  )
}

function useDisplayOrder(
  props: ListProps,
): [string[], (next: string[]) => void] {
  const items = props.items
  const itemValues = useMemo(() => new Set(items.map(i => i.value)), [items])

  const activeKeys = useMemo(() => {
    if (props.mode === 'checkbox') return props.value
    if (props.mode === 'number') {
      return Object.keys(props.value).filter(k => (props.value[k] ?? 0) > 0)
    }
    return [] as string[]
  }, [props.mode, props.value])

  const [fullOrder, setFullOrder] = useState<string[]>(() => {
    if (props.mode === 'order') return props.value
    const activeInOrder = activeKeys.filter(v => itemValues.has(v))
    const inactive = items
      .map(i => i.value)
      .filter(v => !activeInOrder.includes(v))
    return [...activeInOrder, ...inactive]
  })

  const displayOrder = useMemo(() => {
    if (props.mode === 'order') return props.value
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
    const activeSet = new Set(activeKeys)
    const result = [...kept]
    for (const newItem of newItems) {
      const refOrder = activeSet.has(newItem) ? activeKeys : itemsOrder
      const naturalIndex = refOrder.indexOf(newItem)
      let insertAfter = -1
      for (let i = naturalIndex - 1; i >= 0; i--) {
        const idx = result.indexOf(refOrder[i])
        if (idx !== -1) {
          insertAfter = idx
          break
        }
      }
      result.splice(insertAfter + 1, 0, newItem)
    }
    return result
  }, [fullOrder, itemValues, items, activeKeys, props.mode, props.value])

  if (props.mode !== 'order' && displayOrder !== fullOrder) {
    setFullOrder(displayOrder)
  }

  return [displayOrder, setFullOrder]
}
