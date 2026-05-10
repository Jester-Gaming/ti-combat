import { GearIcon, ResetIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { useMemo, useState } from 'react'

import { AbilitiesPanel } from '@/components/abilities-panel'
import { BattleCard } from '@/components/battle-card'
import { useToast } from '@/components/toast'
import { ButtonIcon } from '@/components/ui/button-icon'
import { GlassCard } from '@/components/ui/glass-card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useCombatSetup } from '@/hooks/use-combat-setup'
import { useSimulation } from '@/hooks/use-simulation'
import { useUrlSync } from '@/hooks/use-url-sync'
import type { CombatSide, UnitBaseType } from '@/types'
import { getUnitConfig } from '@/utils/get-unit-config'

import { ButtonIconPlain } from '../ui/button-icon-plain'
import { Divider } from '../ui/divider'
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
    const flatten = (list: unknown): string[] =>
      Array.isArray(list) ? list.map(entry => entry[0]) : []
    return {
      attacker: flatten(a?.[key]),
      defender: flatten(d?.[key]),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateData])

  const participatingTypes = useMemo(() => {
    const key =
      combatMode === 'GROUND'
        ? 'groundCombatParticipating'
        : 'spaceCombatParticipating'
    const read = (side: 'attacker' | 'defender'): string[] => {
      const list = abilities[side]['SETTINGS']?.[key]
      return Array.isArray(list) ? (list as string[]) : []
    }
    return { attacker: read('attacker'), defender: read('defender') }
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

  const attackerAbilitiesElement = (
    <div className={clsx(styles.abilities, 'theme-attacker')}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Attacker Abilities
          <ButtonIconPlain
            type="button"
            className={clsx(styles.resetAbilitiesButton)}
            onClick={() => resetAbilities('attacker')}
            title="Reset attacker abilities to defaults"
          >
            <ResetIcon />
          </ButtonIconPlain>
        </h2>
        <Divider />
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
    </div>
  )

  const defenderAbilitiesElement = (
    <div className={clsx(styles.abilities, 'theme-defender')}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Defender Abilities
          <ButtonIconPlain
            className={clsx(styles.resetAbilitiesButton)}
            onClick={() => resetAbilities('defender')}
            title="Reset defender abilities to defaults"
          >
            <ResetIcon />
          </ButtonIconPlain>
        </h2>

        <Divider />
      </div>
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
  )

  return (
    <main className={clsx(styles.layout, className)}>
      {/* Left panel: Attacker abilities */}
      <GlassCard as="aside" className={clsx(styles.sidePanel)}>
        {attackerAbilitiesElement}
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
          participatingTypes={participatingTypes}
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
              className={clsx(styles.gearButton, 'theme-attacker')}
              onClick={() => setAttackerSheetOpen(true)}
              title="Attacker abilities"
            >
              <GearIcon />
            </ButtonIcon>
          }
          defenderActions={
            <ButtonIcon
              className={clsx(styles.gearButton, 'theme-defender')}
              onClick={() => setDefenderSheetOpen(true)}
              title="Defender abilities"
            >
              <GearIcon />
            </ButtonIcon>
          }
        />
      </div>

      {/* Right panel: Defender abilities */}
      <GlassCard as="aside" className={clsx(styles.sidePanel)}>
        {defenderAbilitiesElement}
      </GlassCard>

      {/* Attacker abilities sheet (mobile) */}
      <Sheet open={attackerSheetOpen} onOpenChange={setAttackerSheetOpen}>
        <SheetContent side="left">{attackerAbilitiesElement}</SheetContent>
      </Sheet>

      {/* Defender abilities sheet (mobile) */}
      <Sheet open={defenderSheetOpen} onOpenChange={setDefenderSheetOpen}>
        <SheetContent side="right">{defenderAbilitiesElement}</SheetContent>
      </Sheet>
    </main>
  )
}
