import { MoonIcon, SunIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { useEffect, useState } from 'react'

import { CombatSimulator } from '@/components/combat-simulator'
import { IconButton } from '@/components/ui/icon-button'

import styles from './app.module.css'

function App() {
  const [isDark, setIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return (
    <div className={styles.root}>
      {/* Background layers */}
      <div className={styles.starfield} />
      <div className={styles.nebulaOverlay} />

      {/* Main content */}
      <div className={styles.mainContent}>
        {/* Header */}
        <header className={clsx(styles.header, styles.animateFadeUp)}>
          <h1 className={styles.title}>Twilight Imperium Combat Calculator</h1>
          <IconButton
            onClick={() => setIsDark(!isDark)}
            className={styles.themeButton}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <SunIcon className={styles.themeIcon} />
            ) : (
              <MoonIcon className={styles.themeIcon} />
            )}
          </IconButton>
        </header>

        {/* Combat simulator */}
        <CombatSimulator
          className={clsx(styles.animateFadeUp, styles.animateDelay100)}
        />
      </div>
    </div>
  )
}

export default App
