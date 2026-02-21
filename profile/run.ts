import { readdir } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'

import type { CombatState } from '@/combat/combat-state/combat-state'

import { runProfile } from './profiler'

async function getProfiles(): Promise<string[]> {
  const files = await readdir(new URL('./configs', import.meta.url))
  return files
    .filter(f => f.endsWith('.ts'))
    .map(f => f.replace(/\.ts$/, ''))
    .sort()
}

async function selectProfile(profiles: string[]): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.info('\nAvailable profiles:\n')
  for (let i = 0; i < profiles.length; i++) {
    console.info(`  ${i + 1}. ${profiles[i]}`)
  }

  const answer = await rl.question('\nSelect profile (number or name): ')
  rl.close()

  const num = parseInt(answer, 10)
  if (num >= 1 && num <= profiles.length) return profiles[num - 1]
  if (profiles.includes(answer)) return answer

  console.error(`Unknown profile: ${answer}`)
  process.exit(1)
}

async function main() {
  const profiles = await getProfiles()
  const arg = process.argv[2]
  const name = arg || (await selectProfile(profiles))

  if (!profiles.includes(name)) {
    console.error(`Unknown profile: ${name}\nAvailable: ${profiles.join(', ')}`)
    process.exit(1)
  }

  const mod: { default: CombatState } = await import(`./configs/${name}.ts`)

  const profilePath = `/tmp/profile-${name}.cpuprofile`

  console.info(`\nRunning profile: ${name}\n`)
  await runProfile(mod.default, profilePath)
}

main()
