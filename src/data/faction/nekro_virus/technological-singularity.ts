import type { UnitType } from '@/types'

import type {
  Ability,
  AbilityCallContext,
  AbilityReadContext,
} from '../../../combat/abilities-engine/types'

type DeferredFn = (ctx: AbilityCallContext) => void

type Params = {
  opponentDestroyed?: boolean
  deferredPrepares?: Record<string, DeferredFn>
  deferredDisables?: Record<string, DeferredFn>
}

const ENABLE_SETTING = {
  key: 'enableBySingularity',
  label: 'Enable by Technological Singularity',
  type: 'checkbox',
}

const DISABLE_SETTING = {
  key: 'disableBySingularity',
  label: 'Disable by Technological Singularity',
  type: 'checkbox',
}

function isOpponentDestroyed(ctx: AbilityReadContext) {
  return !!ctx.api.own.getAbilityConfig('TECHNOLOGICAL_SINGULARITY')
    ?.opponentDestroyed
}

export function registerDeferredPrepare(
  ctx: AbilityCallContext,
  abilityKey: string,
  prepareFn: DeferredFn,
) {
  ctx.api.own.updateAbilityConfig('TECHNOLOGICAL_SINGULARITY', {
    deferredPrepares: (prev: Record<string, DeferredFn> | undefined) => ({
      ...(prev ?? {}),
      [abilityKey]: prepareFn,
    }),
  })
}

function registerDeferredDisable(
  ctx: AbilityCallContext,
  abilityKey: string,
  disableFn: DeferredFn,
) {
  ctx.api.own.updateAbilityConfig('TECHNOLOGICAL_SINGULARITY', {
    deferredDisables: (prev: Record<string, DeferredFn> | undefined) => ({
      ...(prev ?? {}),
      [abilityKey]: disableFn,
    }),
  })
}

interface ConnectOptions {
  canDisable?: boolean
}

export function connectTechnologicalSingularity(
  ability: Ability,
  options?: ConnectOptions,
): Ability {
  const canDisable = options?.canDisable ?? false
  const existingUiConfig = ability.uiConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invokes = ability.invoke as any[]

  // Collect PREPARE and CLEANUP calls
  const prepareCalls: ((
    ctx: AbilityCallContext,
    ...rest: unknown[]
  ) => void)[] = []
  const cleanupCalls: ((ctx: AbilityCallContext) => void)[] = []
  for (const inv of invokes) {
    if (inv.timing === 'PREPARE') prepareCalls.push(inv.call)
    if (inv.timing === 'CLEANUP') cleanupCalls.push(inv.call)
  }

  const deferredPrepareFn = (ctx: AbilityCallContext) => {
    const params = ctx.api.own.getAbilityConfig(ability.key) ?? {}
    for (const call of prepareCalls) call(ctx, params)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any[] = []

  // Single unified PREPARE: register with TS when deferred, run originals otherwise
  result.push({
    timing: 'PREPARE' as const,
    call: (ctx: AbilityCallContext, params: Record<string, unknown>) => {
      if (params.enableBySingularity) {
        registerDeferredPrepare(ctx, ability.key, deferredPrepareFn)
      } else if (params.isEnabled) {
        for (const call of prepareCalls) call(ctx, params)
        if (params.disableBySingularity && cleanupCalls.length > 0) {
          registerDeferredDisable(ctx, ability.key, cleanupCtx => {
            for (const call of cleanupCalls) call(cleanupCtx)
          })
        }
      }
    },
  })

  for (const inv of invokes) {
    if (inv.timing === 'PREPARE' || inv.timing === 'CLEANUP') continue // handled above

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origIsCallable = (inv as any).isCallable as
      | ((...args: unknown[]) => boolean)
      | undefined

    // Wrap non-PREPARE invoke with singularity gates
    result.push({
      ...inv,
      isCallable: (
        params: Record<string, unknown>,
        ctx: AbilityReadContext,
        ...rest: unknown[]
      ) => {
        if (params.enableBySingularity && !isOpponentDestroyed(ctx))
          return false
        if (params.disableBySingularity && isOpponentDestroyed(ctx))
          return false
        return origIsCallable ? origIsCallable(params, ctx, ...rest) : true
      },
    })
  }

  return {
    ...ability,
    params: {
      ...ability.params,
      enableBySingularity: false,
      ...(canDisable && { disableBySingularity: false }),
    },
    onParamSet: canDisable
      ? (currentParams, key, value) => {
          if (key === 'enableBySingularity' && value) {
            return {
              ...currentParams,
              isEnabled: false,
              disableBySingularity: false,
            }
          }
          if (key === 'disableBySingularity' && value) {
            return {
              ...currentParams,
              isEnabled: true,
              enableBySingularity: false,
            }
          }
          if (key === 'isEnabled' && value) {
            return { ...currentParams, enableBySingularity: false }
          }
          return currentParams
        }
      : (currentParams, key, value) => {
          if (key === 'enableBySingularity' && value) {
            return { ...currentParams, isEnabled: false }
          }
          if (key === 'isEnabled' && value) {
            return { ...currentParams, enableBySingularity: false }
          }
          return currentParams
        },
    uiConfig: (() => {
      const settings = canDisable
        ? [ENABLE_SETTING, DISABLE_SETTING]
        : [ENABLE_SETTING]
      return typeof existingUiConfig === 'function'
        ? (...args: [AbilityReadContext, Record<string, unknown>]) => [
            ...settings,
            ...existingUiConfig(...args),
          ]
        : [...settings, ...(existingUiConfig ?? [])]
    })(),
    invoke: result,
  } as Ability
}

export const technologicalSingularity: Ability<Params> = {
  key: 'TECHNOLOGICAL_SINGULARITY',
  name: 'Technological Singularity',
  category: 'FACTION',
  subcategory: 'ABILITY',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
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

        // Run disables first so their CLEANUP reverts don't overwrite
        // newly applied PREPARE stats (e.g. switching unit upgrades)
        const disables = params.deferredDisables || {}
        for (const [key, run] of Object.entries(disables)) {
          run(ctx)
          ctx.api.own.updateAbilityConfig(key, { isEnabled: false })
        }

        const prepares = params.deferredPrepares || {}
        for (const [key, run] of Object.entries(prepares)) {
          run(ctx)
          ctx.api.own.updateAbilityConfig(key, { isEnabled: true })
        }
      },
    },
  ],
}
