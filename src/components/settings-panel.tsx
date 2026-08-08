import { GearIcon, QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { useId } from 'react'

import { AbilitiesDialog } from '@/components/abilities-dialog'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { Settings } from '@/hooks/use-settings'

import styles from './settings-panel.module.css'
import { Divider } from './ui/divider'
import { Tooltip } from './ui/tooltip'

type PrecisionKind = 'full' | 'limited'

const precisionOptions = [
  { value: 'full' as const, label: 'Full' },
  { value: 'limited' as const, label: 'Limited' },
]

interface SettingsPanelProps {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
}

export function SettingsPanel({
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  const id = useId()
  const anchorName = `--${id}`
  const precisionKind = settings.precision.kind
  const precisionDigits = settings.precision.digits

  function setPrecisionKind(kind: PrecisionKind): void {
    onSettingsChange({
      ...settings,
      precision: { kind, digits: precisionDigits },
    })
  }

  function setDigits(digits: number): void {
    onSettingsChange({
      ...settings,
      precision: { kind: 'limited', digits },
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <ButtonIcon className={styles.button} title="Settings">
          <GearIcon />
        </ButtonIcon>
      </DialogTrigger>
      <DialogContent className={styles.content}>
        <DialogTitle>Settings</DialogTitle>
        <Divider />

        <section className={styles.section}>
          <span className={styles.label}>
            Dice Roll Precision
            <Tooltip
              anchor={anchorName}
              content={`
                With limited precision, dice result outcomes (in each round) that have a probability less than ${(10 ** -precisionDigits).toFixed(precisionDigits)} (1 being maximum) will be merged with the next possible outcome.
                That almost doesn't affect the total % distribution, even with the lowest value, and significantly improves performance. But removes some ultra-rare outcomes from the details screen.
                `}
            >
              <QuestionMarkCircledIcon
                style={{ anchorName }}
                className={styles.descriptionIcon}
              />
            </Tooltip>
          </span>
          <div className={styles.precisionControls}>
            <ToggleGroup<PrecisionKind>
              options={precisionOptions}
              value={precisionKind}
              onChange={setPrecisionKind}
            />
            <Input
              value={precisionDigits}
              onChange={setDigits}
              min={2}
              max={15}
              step={1}
              disabled={precisionKind !== 'limited'}
            />
          </div>
        </section>
        <Divider />

        <div className={styles.section}>
          <AbilitiesDialog />
        </div>
      </DialogContent>
    </Dialog>
  )
}
