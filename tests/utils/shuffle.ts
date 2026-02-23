// Seeded PRNG (mulberry32) + Fisher-Yates shuffle for testing ability
// order independence. Controlled via SHUFFLE_SEED env var in tests.

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let _prng: (() => number) | null = null

export function setAbilityShuffleSeed(seed: number | null): void {
  _prng = seed !== null ? mulberry32(seed) : null
}

export function shuffleInPlace<T>(arr: T[]): void {
  if (!_prng || arr.length <= 1) return
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (_prng() * (i + 1)) | 0
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
}
