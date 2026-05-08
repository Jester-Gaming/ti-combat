import { z } from 'zod/mini'

/** Zod schema for `UnitList` (order-mode tuple-array). */
export const UnitListSchema = z.array(z.tuple([z.string()]))

/** Zod schema for `UnitList<boolean>` (checkbox-mode tuple-array). */
export const UnitListBooleanSchema = z.array(z.tuple([z.string(), z.boolean()]))

/** Zod schema for `UnitList<number>` (number-mode tuple-array). */
export const UnitListNumberSchema = z.array(z.tuple([z.string(), z.number()]))
