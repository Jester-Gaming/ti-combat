import { Cross1Icon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { useEffect } from 'react'

import { CombatSimulator } from '@/components/combat-simulator'
import { SettingsPanel } from '@/components/settings-panel'
import { Starfield } from '@/components/starfield'
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
      <Starfield />
      <div className={styles.root}>
        {/* Background layers */}
        <div className={styles.starfield} />
        <div className={styles.nebulaOverlay} />

        <header className={clsx(styles.header, styles.animateFadeUp)}>
          <div className={styles.headerTitle}>
            <h1 className={clsx(styles.title, styles.titleWithSpacing)}>
              <a href="/" className={styles.titleLink}>
                Twilight Imperium Combat Simulator
              </a>
            </h1>
          </div>

          <div className={styles.headerActions}>
            <SettingsPanel settings={settings} onSettingsChange={setSettings} />

            <ButtonIcon
              className={styles.closeButton}
              title="Close combat simulator"
              onClick={() => {
                window.parent.postMessage(
                  { type: 'close-combat-simulator' },
                  '*',
                )
              }}
            >
              <Cross1Icon />
            </ButtonIcon>
          </div>
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
