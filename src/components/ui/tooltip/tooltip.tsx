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
  // Captured on pointerdown: by the time click fires, the browser's light
  // dismiss may have already closed an open popover, so we record the prior
  // open state and the pointer type up front to drive the touch toggle.
  const lastPointerTypeRef = useRef('')
  const wasOpenRef = useRef(false)

  const onPointerEnter = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    popoverRef.current?.showPopover()
  }, [])

  const onPointerLeave = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    popoverRef.current?.hidePopover()
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    lastPointerTypeRef.current = e.pointerType
    wasOpenRef.current = popoverRef.current?.matches(':popover-open') ?? false
  }, [])

  const onClick = useCallback((e: React.MouseEvent) => {
    if (lastPointerTypeRef.current !== 'touch') return
    e.stopPropagation()
    if (wasOpenRef.current) popoverRef.current?.hidePopover()
    else popoverRef.current?.showPopover()
  }, [])

  return (
    <span
      className={clsx(styles.wrapper, className)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onClick={onClick}
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
