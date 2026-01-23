import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragHandleDots2Icon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'

import styles from './order-list.module.css'

interface SortableItemProps {
  id: string
  label: string
  index: number
}

function SortableItem({
  id,
  label,
  index,
}: SortableItemProps): React.ReactElement {
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
      className={clsx(styles.item, isDragging && styles.dragging)}
      {...attributes}
      {...listeners}
    >
      <span className={styles.dragHandle}>
        <DragHandleDots2Icon />
      </span>
      <span className={styles.label}>{label}</span>
      <span className={styles.priorityNumber}>{index + 1}</span>
    </div>
  )
}

export interface OrderListItem {
  label: string
  value: string
}

interface OrderListProps {
  items: readonly OrderListItem[]
  value: string[]
  onChange: (values: string[]) => void
}

export function OrderList({
  items,
  value,
  onChange,
}: OrderListProps): React.ReactElement {
  // Always use items as the source of truth for what to display
  // Order by value, with items not in value appearing at the end
  const itemValues = new Set(items.map(item => item.value))
  const orderedValues = [
    // First: values that exist in items, in value order
    ...value.filter(v => itemValues.has(v)),
    // Then: items not in value, in items order
    ...items.map(item => item.value).filter(v => !value.includes(v)),
  ]

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = orderedValues.indexOf(active.id as string)
      const newIndex = orderedValues.indexOf(over.id as string)
      onChange(arrayMove(orderedValues, oldIndex, newIndex))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={orderedValues}
        strategy={verticalListSortingStrategy}
      >
        <div className={styles.list}>
          {orderedValues.map((val, index) => {
            const item = items.find(i => i.value === val)
            return (
              <SortableItem
                key={val}
                id={val}
                label={item?.label ?? val}
                index={index}
              />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}
