import { clsx } from 'clsx'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

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
  const [open, setOpen] = useState(false)

  const show = useCallback(() => {
    delayRef.current = setTimeout(() => {
      popoverRef.current?.showPopover()
      setOpen(true)
    }, 300)
  }, [])

  const hide = useCallback(() => {
    clearTimeout(delayRef.current)
    popoverRef.current?.hidePopover()
    setOpen(false)
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

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (open) {
        hide()
      } else {
        clearTimeout(delayRef.current)
        popoverRef.current?.showPopover()
        setOpen(true)
      }
    },
    [open, hide],
  )

  useEffect(() => {
    if (!open) return
    const dismiss = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return
      if (popoverRef.current?.contains(e.target)) return
      hide()
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open, hide])

  return (
    <span
      className={clsx(styles.wrapper, className)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={toggle}
    >
      {children}
      <span
        ref={popoverRef}
        className={styles.tooltip}
        role="tooltip"
        popover="manual"
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
