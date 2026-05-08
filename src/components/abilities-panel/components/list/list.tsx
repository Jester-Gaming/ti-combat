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
import { useMemo } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

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

export type OrderListValue = [string][]
export type CheckboxListValue = [string, boolean][]
export type NumberListValue = [string, number][]

export type ListProps = CommonProps &
  (
    | {
        mode: 'order'
        value: OrderListValue
        onChange: (value: OrderListValue) => void
      }
    | {
        mode: 'checkbox'
        value: CheckboxListValue
        onChange: (value: CheckboxListValue) => void
      }
    | {
        mode: 'number'
        value: NumberListValue
        onChange: (value: NumberListValue) => void
      }
  )

export function List(props: ListProps): React.ReactElement {
  const sortable = props.mode === 'order' || props.sortable === true
  const labelMap = useMemo(
    () => new Map(props.items.map(i => [i.value, i.label])),
    [props.items],
  )
  const maxMap = useMemo(
    () => new Map(props.items.map(i => [i.value, i.max])),
    [props.items],
  )
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
  )

  const ids = props.value.map(([id]) => id)

  function handleToggle(id: string): void {
    if (props.mode !== 'checkbox') return
    props.onChange(props.value.map(([k, v]) => (k === id ? [k, !v] : [k, v])))
  }

  function handleCountChange(id: string, count: number): void {
    if (props.mode !== 'number') return
    const max = maxMap.get(id)
    const clamped = Math.max(0, max != null ? Math.min(count, max) : count)
    props.onChange(
      props.value.map(([k, v]) => (k === id ? [k, clamped] : [k, v])),
    )
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    if (props.mode === 'order') {
      props.onChange(arrayMove(props.value, oldIndex, newIndex))
    } else if (props.mode === 'checkbox') {
      props.onChange(arrayMove(props.value, oldIndex, newIndex))
    } else {
      props.onChange(arrayMove(props.value, oldIndex, newIndex))
    }
  }

  function isActive(index: number): boolean {
    if (props.mode === 'checkbox') return props.value[index][1] === true
    if (props.mode === 'number') return (props.value[index][1] ?? 0) > 0
    return true
  }

  function renderRight(id: string, index: number): React.ReactElement {
    if (props.mode === 'checkbox') {
      const checked = props.value[index][1]
      return (
        <Checkbox
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          checked={checked}
          onChange={() => handleToggle(id)}
        />
      )
    }
    if (props.mode === 'number') {
      const count = props.value[index][1]
      return (
        <Input
          square
          value={count}
          active={!!count}
          min={0}
          max={maxMap.get(id)}
          onPointerDown={e => e.stopPropagation()}
          onChange={value => handleCountChange(id, value)}
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
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className={styles.list}>
            {ids.map((id, index) => (
              <SortableRow
                key={id}
                id={id}
                label={labelMap.get(id) ?? id}
                active={isActive(index)}
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
      {ids.map((id, index) => {
        const label = labelMap.get(id) ?? id
        return (
          <div
            key={id}
            className={clsx(
              styles.item,
              isActive(index) && styles.item_active,
              isClickable && styles.item_clickable,
            )}
            onClick={isClickable ? () => handleToggle(id) : undefined}
          >
            <span className={styles.label} title={label}>
              {label}
            </span>
            <div className={styles.right}>{renderRight(id, index)}</div>
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
      <div className={styles.right}>{children}</div>
    </div>
  )
}
