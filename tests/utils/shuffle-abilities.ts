import { afterEach, beforeEach, onTestFailed } from 'vitest'

import { setAbilityShuffleSeed } from './shuffle'

const envSeed = process.env.SHUFFLE_SEED

if (envSeed) {
  let currentSeed = 0

  beforeEach(() => {
    currentSeed =
      envSeed === 'random'
        ? (Math.random() * 0xffffffff) >>> 0
        : parseInt(envSeed, 10)

    setAbilityShuffleSeed(currentSeed)

    onTestFailed(() => {
      console.info(
        `[shuffle-abilities] Failed with seed: ${currentSeed}\n` +
          `  Reproduce: SHUFFLE_SEED=${currentSeed} npx vitest run <test-file>`,
      )
    })
  })

  afterEach(() => {
    setAbilityShuffleSeed(null)
  })
}
