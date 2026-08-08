import { ReloadIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { useEffect } from 'react'

import { CombatSimulator } from '@/components/combat-simulator'
import { SettingsPanel } from '@/components/settings-panel'
import { ToastProvider } from '@/components/toast'
import { ButtonIcon } from '@/components/ui/button-icon'
import { useSettings } from '@/hooks/use-settings'

import styles from './app.module.css'

function App() {
  const [settings, setSettings] = useSettings()

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark')
      return
    }
    if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark')
      return
    }
    // system
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    document.documentElement.classList.toggle('dark', mq.matches)
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings.theme])

  return (
    <ToastProvider>
      <div className={styles.root}>
        {/* Background layers */}
        <div className={styles.starfield} />
        <div className={styles.nebulaOverlay} />

        <header className={clsx(styles.header, styles.animateFadeUp)}>
          <h1 className={clsx(styles.title, styles.titleWithSpacing)}>
            <a href="/" className={styles.titleLink}>
              Imperium Companion Combat Simulator
            </a>
          </h1>

          <ButtonIcon
            title="Reset combat"
            onClick={() => (window.location.href = '/')}
          >
            <ReloadIcon />
          </ButtonIcon>

          <SettingsPanel settings={settings} onSettingsChange={setSettings} />
        </header>

        {/* Combat simulator */}
        <CombatSimulator
          className={clsx(styles.animateFadeUp, styles.animateDelay100)}
          precision={settings.precision}
        />
      </div>
    </ToastProvider>
  )
}

export default App
