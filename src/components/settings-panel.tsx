import { GearIcon } from '@radix-ui/react-icons'

import { AbilitiesDialog } from '@/components/abilities-dialog'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { Settings, Theme } from '@/hooks/use-settings'

import styles from './settings-panel.module.css'

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
        <IconButton
          className="ml-4 flex h-8 w-8 items-center justify-center rounded"
          title="Settings"
        >
          <GearIcon className="h-4 w-4" />
        </IconButton>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Settings</DialogTitle>
        <div className={styles.divider} />
        <div className={styles.section}>
          <span className={styles.label}>Theme</span>
          <ToggleGroup<Theme>
            options={themeOptions}
            value={settings.theme}
            onChange={theme => onSettingsChange({ ...settings, theme })}
          />
        </div>
        <div className={styles.divider} />
        <AbilitiesDialog />
      </DialogContent>
    </Dialog>
  )
}
