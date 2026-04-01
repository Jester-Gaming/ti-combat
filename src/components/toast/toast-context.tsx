import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react'

import styles from './toast.module.css'

interface Toast {
  id: number
  message: string
}

interface ToastContextValue {
  toast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  return (
    <ToastContext value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className={styles.container}>
          {toasts.map(t => (
            <div key={t.id} className={styles.toast}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
