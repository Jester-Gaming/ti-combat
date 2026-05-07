import {
  Select as SelectRoot,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import styles from './select.module.css'

export interface SelectOption {
  label: string
  value: string
}

export interface SelectOptionGroup {
  group: string
  items: readonly SelectOption[]
}

interface SelectProps {
  items: readonly (SelectOption | SelectOptionGroup)[]
  value: string
  onChange: (value: string) => void
}

export function Select({
  items,
  value,
  onChange,
}: SelectProps): React.ReactElement {
  return (
    <SelectRoot value={value} onValueChange={onChange}>
      <SelectTrigger className={styles.trigger}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={styles.content}>
        {items.map(item =>
          'group' in item ? (
            <SelectGroup key={item.group}>
              <SelectLabel className={styles.label}>{item.group}</SelectLabel>
              {item.items.map(gi => (
                <SelectItem
                  key={gi.value}
                  value={gi.value}
                  className={styles.item}
                >
                  {gi.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : (
            <SelectItem
              key={item.value}
              value={item.value}
              className={styles.item}
            >
              {item.label}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </SelectRoot>
  )
}
