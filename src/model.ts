export type Category = 'top' | 'bottom' | 'layer'
export type ExtraKind = 'shoe' | 'bag'
export type LineId = 'R1' | 'R2' | 'R3' | 'C1' | 'C2' | 'C3' | 'D'

export interface ImageAsset {
  id: string
  blob: Blob
  name: string
  source: 'upload' | 'generated'
  createdAt: number
}

export interface Slot {
  category: Category
  imageId: string | null
}

export interface Extra {
  kind: ExtraKind
  imageId: string | null
}

export interface Board {
  id: string
  name: string
  grid: Slot[] // length 9, row-major
  extras: Extra[] // 3 shoes + 1 bag
  shoeIdx: number
  createdAt: number
  updatedAt: number
}

// Fixed category layout from the sudoku packing method. Positions never change
// category: any cross-category swap in a 3x3 latin square breaks a row or column.
export const LAYOUT: readonly Category[] = [
  'top', 'bottom', 'layer',
  'layer', 'top', 'bottom',
  'bottom', 'layer', 'top',
]

export const CATEGORIES: readonly Category[] = ['top', 'bottom', 'layer']
export const TAG: Record<Category, string> = { top: 'TOP', bottom: 'BOTTOM', layer: 'LAYER' }

// D runs bottom-left to top-right; the other diagonal is three tops.
export const LINES: Record<LineId, readonly [number, number, number]> = {
  R1: [0, 1, 2], R2: [3, 4, 5], R3: [6, 7, 8],
  C1: [0, 3, 6], C2: [1, 4, 7], C3: [2, 5, 8],
  D: [6, 4, 2],
}

export const COMBO_COUNT = 27

export function isLatinSquare(cats: readonly Category[]): boolean {
  if (cats.length !== 9) return false
  const distinct = (idx: readonly number[]) => new Set(idx.map((i) => cats[i])).size === 3
  return (['R1', 'R2', 'R3', 'C1', 'C2', 'C3'] as const).every((l) => distinct(LINES[l]))
}

/** Grid indices holding a category, in grid order. */
export function slotsOf(category: Category): number[] {
  return LAYOUT.flatMap((c, i) => (c === category ? [i] : []))
}

/** Grid indices [top, bottom, layer] for combo number n (1..27). */
export function comboSlots(n: number): [number, number, number] {
  if (!Number.isInteger(n) || n < 1 || n > COMBO_COUNT) throw new RangeError(`combo ${n}`)
  const k = n - 1
  return [
    slotsOf('top')[Math.floor(k / 9)],
    slotsOf('bottom')[Math.floor(k / 3) % 3],
    slotsOf('layer')[k % 3],
  ]
}

/** Combo number (1..27) for three grid indices holding one of each category. */
export function comboNumber(slots: readonly number[]): number {
  const rank = (cat: Category) => {
    const idx = slots.find((i) => LAYOUT[i] === cat)
    if (idx === undefined) throw new Error(`no ${cat} in ${slots.join(',')}`)
    return slotsOf(cat).indexOf(idx)
  }
  return rank('top') * 9 + rank('bottom') * 3 + rank('layer') + 1
}

export function lineCombo(line: LineId): number {
  return comboNumber(LINES[line])
}

/** True when two grid squares may swap images. */
export function canSwap(a: number, b: number): boolean {
  return a !== b && LAYOUT[a] === LAYOUT[b]
}

export function newBoard(name: string, now = Date.now()): Board {
  return {
    id: crypto.randomUUID(),
    name,
    grid: LAYOUT.map((category) => ({ category, imageId: null })),
    extras: [
      { kind: 'shoe', imageId: null },
      { kind: 'shoe', imageId: null },
      { kind: 'shoe', imageId: null },
      { kind: 'bag', imageId: null },
    ],
    shoeIdx: 0,
    createdAt: now,
    updatedAt: now,
  }
}

/** Fill empty grid squares, then empty extras, in order. Returns leftover ids. */
export function fillEmpty(board: Board, imageIds: readonly string[]): { board: Board; rest: string[] } {
  const queue = [...imageIds]
  const grid = board.grid.map((s) => (s.imageId || !queue.length ? s : { ...s, imageId: queue.shift()! }))
  const extras = board.extras.map((e) => (e.imageId || !queue.length ? e : { ...e, imageId: queue.shift()! }))
  return { board: { ...board, grid, extras }, rest: queue }
}

export function removeImage(board: Board, imageId: string): Board {
  const clear = <T extends { imageId: string | null }>(s: T): T => (s.imageId === imageId ? { ...s, imageId: null } : s)
  return { ...board, grid: board.grid.map(clear), extras: board.extras.map(clear) }
}
