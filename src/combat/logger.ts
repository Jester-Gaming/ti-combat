import type { CombatSide } from '@/types'

export interface LogEntry {
  path: string[]
  side?: CombatSide
  data?: unknown[]
}

export class Logger {
  private _entries: LogEntry[]
  private _path: string[]
  private _side?: CombatSide

  private constructor(entries: LogEntry[], path: string[], side?: CombatSide) {
    this._entries = entries
    this._path = path
    this._side = side
  }

  static create(): Logger {
    return new Logger([], [])
  }

  child(segment: string): Logger {
    return new Logger(this._entries, [...this._path, segment], this._side)
  }

  forSide(side: CombatSide): Logger {
    return new Logger(this._entries, this._path, side)
  }

  fork(): Logger {
    return new Logger([...this._entries], [...this._path], this._side)
  }

  log(...data: unknown[]): void {
    const entry: LogEntry = { path: [...this._path] }
    if (this._side) entry.side = this._side
    if (data.length > 0) entry.data = data
    this._entries.push(entry)
  }

  get entries(): readonly LogEntry[] {
    return this._entries
  }
}
