import { GearIcon, ResetIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'

import { AbilitiesPanel } from '@/components/abilities-panel'
import { BattleCard } from '@/components/battle-card'
import { useToast } from '@/components/toast'
import { ButtonIcon } from '@/components/ui/button-icon'
import { GlassCard } from '@/components/ui/glass-card'
import { GlowText } from '@/components/ui/glow-text'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCombatSetup } from '@/hooks/use-combat-setup'
import { useSimulation } from '@/hooks/use-simulation'
import { useUrlSync } from '@/hooks/use-url-sync'
import type { CombatSide, UnitBaseType } from '@/types'
import { getUnitConfig } from '@/utils/get-unit-config'

import styles from './combat-simulator.module.css'

interface CombatSimulatorProps {
  className?: string
}

export function CombatSimulator({ className }: CombatSimulatorProps) {
  const {
    attackerFaction,
    defenderFaction,
    attackerSelections,
    defenderSelections,
    combatMode,
    abilities,
    stateData,
    getReadContext,
    getAvailableAbilities,
    isUpgraded,
    simulationInput,
    serializedConfig,
    loadConfig,
    allAbilities,
    setFaction,
    setUnitCount,
    setUpgraded,
    setAbilityParam,
    setCombatMode,
    resetUnits,
    resetAbilities,
    swap,
  } = useCombatSetup()

  const { toast } = useToast()
  useUrlSync(serializedConfig, loadConfig, allAbilities, toast)

  const [attackerSheetOpen, setAttackerSheetOpen] = useState(false)
  const [defenderSheetOpen, setDefenderSheetOpen] = useState(false)

  const attackerConfig = useMemo(
    () => getUnitConfig(attackerFaction),
    [attackerFaction],
  )
  const defenderConfig = useMemo(
    () => getUnitConfig(defenderFaction),
    [defenderFaction],
  )

  const attackerAbilities = useMemo(
    () => getAvailableAbilities('attacker'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attackerFaction],
  )
  const defenderAbilities = useMemo(
    () => getAvailableAbilities('defender'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defenderFaction],
  )

  const attackerReadContext = useMemo(
    () => getReadContext('attacker'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateData],
  )
  const defenderReadContext = useMemo(
    () => getReadContext('defender'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateData],
  )

  const { outcomes, isComputing } = useSimulation(simulationInput)

  const unitPriority = useMemo(() => {
    const key =
      combatMode === 'GROUND' ? 'groundUnitPriority' : 'spaceUnitPriority'
    const a = abilities.attacker['UNIT_PRIORITY']
    const d = abilities.defender['UNIT_PRIORITY']
    return {
      attacker: (a?.[key] as string[] | undefined) ?? [],
      defender: (d?.[key] as string[] | undefined) ?? [],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateData])

  const combatResult = useMemo(() => {
    if (!outcomes) return null
    let attackerWin = 0
    let draw = 0
    let defenderWin = 0
    for (const o of outcomes) {
      switch (o.winner) {
        case 'attacker':
          attackerWin += o.probability
          break
        case 'defender':
          defenderWin += o.probability
          break
        case 'draw':
          draw += o.probability
          break
      }
    }
    return { attackerWin, draw, defenderWin }
  }, [outcomes])

  const handleUpgradeToggle = (side: CombatSide, unit: UnitBaseType) => {
    setUpgraded(side, unit, !isUpgraded(side, unit))
  }

  return (
    <main className={clsx(styles.layout, className)}>
      {/* Left panel: Attacker abilities */}
      <GlassCard
        as="aside"
        className={clsx(styles.sidePanel, styles.sidePanel_attacker)}
      >
        <div className={styles.sidePanelHeader}>
          <GlowText
            as="h2"
            className={styles.sidePanelTitle}
            style={
              {
                '--glow-color': 'var(--color-accent-attacker-raw)',
              } as CSSProperties
            }
          >
            Attacker Abilities
          </GlowText>
          <button
            type="button"
            className={clsx(
              styles.resetAbilitiesButton,
              styles.resetAbilitiesButton_attacker,
            )}
            onClick={() => resetAbilities('attacker')}
            title="Reset attacker abilities to defaults"
          >
            <ResetIcon />
          </button>
        </div>
        <AbilitiesPanel
          abilities={attackerAbilities}
          readContext={attackerReadContext}
          combatMode={combatMode}
          params={abilities.attacker}
          onParamsChange={(abilityName, params) =>
            setAbilityParam('attacker', abilityName, params)
          }
        />
      </GlassCard>

      {/* Center column: Battle card */}
      <div className={styles.centerColumn}>
        <BattleCard
          attackerFaction={attackerFaction}
          defenderFaction={defenderFaction}
          attackerSelections={attackerSelections}
          defenderSelections={defenderSelections}
          attackerConfig={attackerConfig}
          defenderConfig={defenderConfig}
          combatResult={combatResult}
          outcomes={outcomes}
          unitPriority={unitPriority}
          isComputing={isComputing}
          combatMode={combatMode}
          onCombatModeChange={setCombatMode}
          onFactionChange={setFaction}
          onSwap={swap}
          onUnitCountChange={setUnitCount}
          onUpgradeToggle={handleUpgradeToggle}
          onResetUnits={resetUnits}
          attackerActions={
            <ButtonIcon
              className={clsx(styles.gearButton, styles.gearButton_attacker)}
              onClick={() => setAttackerSheetOpen(true)}
              title="Attacker abilities"
            >
              <GearIcon />
            </ButtonIcon>
          }
          defenderActions={
            <ButtonIcon
              className={clsx(styles.gearButton, styles.gearButton_defender)}
              onClick={() => setDefenderSheetOpen(true)}
              title="Defender abilities"
            >
              <GearIcon />
            </ButtonIcon>
          }
        />
      </div>

      {/* Attacker abilities sheet (mobile) */}
      <Sheet open={attackerSheetOpen} onOpenChange={setAttackerSheetOpen}>
        <SheetContent side="left" className={styles.sheetAttacker}>
          <SheetTitle className="sr-only">Attacker Abilities</SheetTitle>
          <div className={styles.sheetHeader}>
            <GlowText
              as="h2"
              className={styles.sidePanelTitle}
              style={
                {
                  '--glow-color': 'var(--color-accent-attacker-raw)',
                } as CSSProperties
              }
            >
              Attacker Abilities
            </GlowText>
            <button
              type="button"
              className={clsx(
                styles.resetAbilitiesButton,
                styles.resetAbilitiesButton_attacker,
              )}
              onClick={() => resetAbilities('attacker')}
              title="Reset attacker abilities to defaults"
            >
              <ResetIcon />
            </button>
          </div>
          <SheetDescription className="sr-only">
            Configure attacker abilities
          </SheetDescription>
          <AbilitiesPanel
            abilities={attackerAbilities}
            readContext={attackerReadContext}
            combatMode={combatMode}
            params={abilities.attacker}
            onParamsChange={(abilityName, params) =>
              setAbilityParam('attacker', abilityName, params)
            }
          />
        </SheetContent>
      </Sheet>

      {/* Defender abilities sheet (mobile) */}
      <Sheet open={defenderSheetOpen} onOpenChange={setDefenderSheetOpen}>
        <SheetContent side="right" className={styles.sheetDefender}>
          <SheetTitle className="sr-only">Defender Abilities</SheetTitle>
          <div className={styles.sheetHeader}>
            <GlowText
              as="h2"
              className={styles.sidePanelTitle}
              style={
                {
                  '--glow-color': 'var(--color-accent-defender-raw)',
                } as CSSProperties
              }
            >
              Defender Abilities
            </GlowText>
            <button
              type="button"
              className={clsx(
                styles.resetAbilitiesButton,
                styles.resetAbilitiesButton_defender,
              )}
              onClick={() => resetAbilities('defender')}
              title="Reset defender abilities to defaults"
            >
              <ResetIcon />
            </button>
          </div>
          <SheetDescription className="sr-only">
            Configure defender abilities
          </SheetDescription>
          <AbilitiesPanel
            abilities={defenderAbilities}
            readContext={defenderReadContext}
            combatMode={combatMode}
            params={abilities.defender}
            onParamsChange={(abilityName, params) =>
              setAbilityParam('defender', abilityName, params)
            }
          />
        </SheetContent>
      </Sheet>

      {/* Right panel: Defender abilities */}
      <GlassCard
        as="aside"
        className={clsx(styles.sidePanel, styles.sidePanel_defender)}
      >
        <div className={styles.sidePanelHeader}>
          <GlowText
            as="h2"
            className={styles.sidePanelTitle}
            style={
              {
                '--glow-color': 'var(--color-accent-defender-raw)',
              } as CSSProperties
            }
          >
            Defender Abilities
          </GlowText>
          <button
            type="button"
            className={clsx(
              styles.resetAbilitiesButton,
              styles.resetAbilitiesButton_defender,
            )}
            onClick={() => resetAbilities('defender')}
            title="Reset defender abilities to defaults"
          >
            <ResetIcon />
          </button>
        </div>
        <div className={styles.sidePanelScroll}>
          <AbilitiesPanel
            abilities={defenderAbilities}
            readContext={defenderReadContext}
            combatMode={combatMode}
            params={abilities.defender}
            onParamsChange={(abilityName, params) =>
              setAbilityParam('defender', abilityName, params)
            }
          />
        </div>
      </GlassCard>
    </main>
  )
}
