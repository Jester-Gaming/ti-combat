import { afterEach, beforeEach, describe, it } from 'vitest'

import { setReversed } from './combat-test'

function itForEachSide(name: string, fn: () => void | Promise<void>) {
  it(name, () => {
    setReversed(false)
    return fn()
  })
  it(`[reversed] ${name}`, () => {
    setReversed(true)
    return fn()
  })
}

function describeForEachSide(name: string, fn: () => void) {
  describe(`${name}`, fn)
  describe(`[reversed] ${name}`, () => {
    beforeEach(() => {
      setReversed(true)
    })
    afterEach(() => {
      setReversed(false)
    })
    fn()
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(it as any).forEachSide = itForEachSide
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(describe as any).forEachSide = describeForEachSide
