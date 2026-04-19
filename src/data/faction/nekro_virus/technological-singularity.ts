import type {
  Ability,
  AbilityCallContext,
  AbilityReadContext,
  SelectGroup,
  SelectItem,
} from '../../../combat/abilities-engine/types'
import type { UnitType } from '../../../types'

type SingularityAbilityEntry = {
  key: string
  name: string
  subcategory?: string
  prepareCalls: ((ctx: AbilityCallContext, ...rest: unknown[]) => void)[]
}

type TSParams = {
  enableAbilityKey: string
  disableAbilityKey: string
  enableMordred: boolean
  opponentDestroyed?: boolean
}

export function createTechnologicalSingularity(
  enableAbilityList: Ability[],
  disableAbilityList: Ability[],
  mordredAbility: Ability,
): Ability<TSParams> {
  const NONE = 'none'
  const enableAbilities = enableAbilityList.map(collectInvokes)
  const disableAbilities = disableAbilityList.map(collectInvokes)

  const abilityLookup = new Map<string, SingularityAbilityEntry>(
    [...enableAbilities, ...disableAbilities].map(e => [e.key, e]),
  )

  const mordredEntry = collectInvokes(mordredAbility)

  return {
    key: 'TECHNOLOGICAL_SINGULARITY',
    name: 'Technological Singularity',
    description:
      "Once per combat, after 1 of your opponent's units is destroyed, you may gain 1 technology that is owned by that player.",
    category: 'FACTION',
    subcategory: 'ABILITY',
    params: {
      isEnabled: true,
      uses: Infinity,
      enableAbilityKey: NONE,
      disableAbilityKey: NONE,
      enableMordred: false,
    },
    headerUI: 'isEnabled',
    readOnly: true,
    uiConfig: ctx => {
      const disableGroups = buildSelectGroups(
        disableAbilities,
        ctx,
        enabled => enabled,
      )
      return [
        {
          key: 'enableAbilityKey' as const,
          label: 'Enable ability',
          type: 'select' as const,
          items: [
            { label: 'None', value: NONE } satisfies SelectItem,
            ...buildSelectGroups(enableAbilities, ctx, enabled => !enabled),
          ],
        },
        ...(disableGroups.length > 0
          ? [
              {
                key: 'disableAbilityKey' as const,
                label: 'Disable ability',
                type: 'select' as const,
                items: [
                  { label: 'None', value: NONE } satisfies SelectItem,
                  ...disableGroups,
                ],
              },
            ]
          : []),
        {
          key: 'enableMordred' as const,
          label: 'Enable Mordred',
          type: 'checkbox' as const,
        },
      ]
    },
    onParamSet: (currentParams, key, value) => {
      if (
        key === 'enableAbilityKey' &&
        value !== NONE &&
        value === currentParams.disableAbilityKey
      ) {
        return { ...currentParams, disableAbilityKey: NONE }
      }
      if (
        key === 'disableAbilityKey' &&
        value !== NONE &&
        value === currentParams.enableAbilityKey
      ) {
        return { ...currentParams, enableAbilityKey: NONE }
      }
      return currentParams
    },
    invoke: [
      {
        timing: 'AFTER_DESTROY',
        context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
        isCallable: (params, _ctx, units) => {
          if (params.opponentDestroyed) return false
          for (const key in units.opponent) {
            if (units.opponent[key as UnitType]?.length > 0) return true
          }
          return false
        },
        call: (ctx, params) => {
          ctx.api.own.updateAbilityConfig({ opponentDestroyed: true })

          // Run disables first so their reset reverts don't overwrite
          // newly applied PREPARE stats
          if (params.disableAbilityKey !== NONE) {
            const config = ctx.api.own.getAbilityConfig(
              params.disableAbilityKey as keyof AbilityConfigMap,
            ) as unknown as { reset: (ctx: AbilityCallContext) => void }
            if (config.reset) {
              config.reset(ctx)
            }
          }

          if (params.enableAbilityKey !== NONE) {
            const entry = abilityLookup.get(params.enableAbilityKey)
            if (entry) {
              const abilityParams =
                ctx.api.own.getAbilityConfig(
                  entry.key as keyof AbilityConfigMap,
                ) ?? {}
              for (const call of entry.prepareCalls) call(ctx, abilityParams)
              ctx.api.own.updateAbilityConfig(params.enableAbilityKey, {
                isEnabled: true,
              })
            }
          }

          if (params.enableMordred) {
            for (const call of mordredEntry.prepareCalls)
              call(
                ctx,
                ctx.api.own.getAbilityConfig(
                  'MORDRED' as keyof AbilityConfigMap,
                ) ?? {},
              )
            ctx.api.own.updateAbilityConfig('MORDRED', { isEnabled: true })
          }
        },
      },
    ],
  }
}

function collectInvokes(ability: Ability): SingularityAbilityEntry {
  const prepareCalls: ((
    ctx: AbilityCallContext,
    ...rest: unknown[]
  ) => void)[] = []
  for (const inv of ability.invoke) {
    if (inv.timing === 'PREPARE')
      prepareCalls.push(
        inv.call as (ctx: AbilityCallContext, ...rest: unknown[]) => void,
      )
  }
  return {
    key: ability.key,
    name: ability.name,
    subcategory: ability.subcategory,
    prepareCalls,
  }
}

function buildSelectGroups(
  entries: SingularityAbilityEntry[],
  ctx: AbilityReadContext,
  filter: (isEnabled: boolean) => boolean,
): SelectGroup[] {
  const SUBCATEGORY_LABELS: Record<string, string> = {
    FLAGSHIP: 'Flagship',
    TECHNOLOGY: 'Technology',
    UNIT: 'Unit',
  }
  const grouped = new Map<string, { label: string; value: string }[]>()
  for (const entry of entries) {
    const config = ctx.api.own.getAbilityConfig(
      entry.key as keyof AbilityConfigMap,
    )
    const isEnabled = !!config?.isEnabled
    if (!filter(isEnabled)) continue
    const sub = entry.subcategory ?? 'ABILITY'
    if (!grouped.has(sub)) grouped.set(sub, [])
    grouped.get(sub)!.push({ label: entry.name, value: entry.key })
  }
  return [...grouped.entries()].map(([sub, items]) => ({
    group: SUBCATEGORY_LABELS[sub] ?? sub,
    items,
  }))
}
