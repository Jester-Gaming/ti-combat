import { GearIcon } from '@radix-ui/react-icons'

import { AbilitiesDialog } from '@/components/abilities-dialog'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { Settings, Theme } from '@/hooks/use-settings'

import styles from './settings-panel.module.css'
import { Divider } from './ui/divider'

const themeOptions = [
  { value: 'system' as const, label: 'System' },
  { value: 'dark' as const, label: 'Dark' },
  { value: 'light' as const, label: 'Light' },
]

interface SettingsPanelProps {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
}

export function SettingsPanel({
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <ButtonIcon className={styles.button} title="Settings">
          <GearIcon />
        </ButtonIcon>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className={styles.title}>Settings</DialogTitle>
        <Divider />
        <div className={styles.section}>
          <span className={styles.label}>Theme</span>
          <ToggleGroup<Theme>
            options={themeOptions}
            value={settings.theme}
            onChange={theme => onSettingsChange({ ...settings, theme })}
          />
        </div>
        <Divider />
        <div className={styles.section}>
          <AbilitiesDialog />
        </div>
      </DialogContent>
    </Dialog>
  )
}
