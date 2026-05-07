import { clsx } from 'clsx'
import { type ReactNode, useCallback, useRef } from 'react'

import styles from './tooltip.module.css'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  anchor?: string
  className?: string
}

export function Tooltip({
  content,
  children,
  anchor,
  className,
}: TooltipProps): React.ReactElement {
  const popoverRef = useRef<HTMLSpanElement>(null)
  const delayRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback(() => {
    popoverRef.current?.showPopover()
  }, [])

  const hide = useCallback(() => {
    clearTimeout(delayRef.current)
    popoverRef.current?.hidePopover()
  }, [])

  const onPointerEnter = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      show()
    },
    [show],
  )

  const onPointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      hide()
    },
    [hide],
  )

  return (
    <span
      className={clsx(styles.wrapper, className)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
      <span
        ref={popoverRef}
        className={styles.tooltip}
        role="tooltip"
        popover="auto"
        style={
          anchor
            ? ({ positionAnchor: anchor } as React.CSSProperties)
            : undefined
        }
      >
        {content}
      </span>
    </span>
  )
}
