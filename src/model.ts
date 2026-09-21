export type Kind = 'top' | 'bottom' | 'layer' | 'shoes' | 'bag' | 'accessory' | 'outerwear'
export type ExtraKind = 'shoe' | 'bag'
/** 'R1'..'R7', 'C1'..'C7', or 'D'. Which ones exist depends on the board size. */
export type LineId = string

export interface ImageAsset {
  id: string
  blob: Blob
  name: string
  source: 'upload' | 'generated'
  createdAt: number
}

export interface Slot {
  category: Kind
  imageId: string | null
}

export interface Extra {
  kind: ExtraKind
  imageId: string | null
}

export interface Board {
  id: string
  name: string
  size: number // 3..7; the grid is size x size
  grid: Slot[] // length size*size, row-major
  extras: Extra[] // pieces whose kind is not in the grid at this size
  shoeIdx: number
  createdAt: number
  updatedAt: number
}

export const MIN_SIZE = 3
export const MAX_SIZE = 7
export const SIZES: readonly number[] = [3, 4, 5, 6, 7]

// A size-N board uses the first N kinds, N pieces of each.
export const KINDS: readonly Kind[] = ['top', 'bottom', 'layer', 'shoes', 'bag', 'accessory', 'outerwear']

export const TAG: Record<Kind, string> = {
  top: 'TOP', bottom: 'BOTTOM', layer: 'LAYER', shoes: 'SHOES', bag: 'BAG', accessory: 'ACCESSORY', outerwear: 'OUTERWEAR',
}
export const SHORT_TAG: Record<Kind, string> = {
  top: 'TOP', bottom: 'BOT', layer: 'LAY', shoes: 'SHO', bag: 'BAG', accessory: 'ACC', outerwear: 'OUT',
}

// Even sizes need hand-picked squares: the cyclic pattern used for odd sizes has
// no diagonal with one of each kind when N is even.
const EVEN_LAYOUTS: Record<number, readonly number[][]> = {
  4: [
    [0, 1, 2, 3],
    [2, 3, 0, 1],
    [3, 2, 1, 0],
    [1, 0, 3, 2],
  ],
  6: [
    [0, 1, 2, 3, 4, 5],
    [1, 0, 3, 5, 2, 4],
    [2, 3, 4, 0, 5, 1],
    [4, 5, 1, 2, 0, 3],
    [5, 4, 0, 1, 3, 2],
    [3, 2, 5, 4, 1, 0],
  ],
}

function assertSize(size: number): void {
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) throw new RangeError(`size ${size}`)
}

export function kindsFor(size: number): readonly Kind[] {
  assertSize(size)
  return KINDS.slice(0, size)
}

const layouts = new Map<number, readonly Kind[]>()

/**
 * Fixed kind layout for a board size. Positions never change kind: swapping two
 * squares of different kinds always breaks a row or column of a latin square.
 */
export function layoutFor(size: number): readonly Kind[] {
  assertSize(size)
  let layout = layouts.get(size)
  if (!layout) {
    const even = EVEN_LAYOUTS[size]
    layout = Array.from({ length: size * size }, (_, i) => {
      const r = Math.floor(i / size)
      const c = i % size
      // Odd sizes: each row is the one above shifted right. Size 3 gives T B L / L T B / B L T.
      return KINDS[even ? even[r][c] : (((c - r) % size) + size) % size]
    })
    layouts.set(size, layout)
  }
  return layout
}

/** Rows, columns, and D (bottom-left to top-right). The other diagonal is never a full outfit here. */
export function linesFor(size: number): Record<LineId, readonly number[]> {
  assertSize(size)
  const idx = Array.from({ length: size }, (_, i) => i)
  const lines: Record<LineId, readonly number[]> = {}
  for (const r of idx) lines[`R${r + 1}`] = idx.map((c) => r * size + c)
  for (const c of idx) lines[`C${c + 1}`] = idx.map((r) => r * size + c)
  lines.D = idx.map((i) => (size - 1 - i) * size + i)
  return lines
}

export function comboCount(size: number): number {
  assertSize(size)
  return size ** size
}

export function isLatinSquare(cats: readonly Kind[], size: number): boolean {
  if (cats.length !== size * size) return false
  const lines = linesFor(size)
  return Object.keys(lines)
    .filter((l) => l !== 'D')
    .every((l) => new Set(lines[l].map((i) => cats[i])).size === size)
}

/** Grid indices holding a kind, in grid order. */
export function slotsOf(size: number, kind: Kind): number[] {
  return layoutFor(size).flatMap((k, i) => (k === kind ? [i] : []))
}

/** Grid indices, one per kind in KINDS order, for combo number n (1..size^size). */
export function comboSlots(size: number, n: number): number[] {
  const count = comboCount(size)
  if (!Number.isInteger(n) || n < 1 || n > count) throw new RangeError(`combo ${n}`)
  // n-1 written in base `size`: most significant digit picks the top, the next the bottom, and so on.
  return kindsFor(size).map((kind, k) => slotsOf(size, kind)[Math.floor((n - 1) / size ** (size - 1 - k)) % size])
}

/** Combo number for grid indices holding exactly one of each kind. */
export function comboNumber(size: number, slots: readonly number[]): number {
  const layout = layoutFor(size)
  return (
    kindsFor(size).reduce((acc, kind) => {
      const idx = slots.find((i) => layout[i] === kind)
      if (idx === undefined) throw new Error(`no ${kind} in ${slots.join(',')}`)
      return acc * size + slotsOf(size, kind).indexOf(idx)
    }, 0) + 1
  )
}

export function lineCombo(size: number, line: LineId): number {
  const slots = linesFor(size)[line]
  if (!slots) throw new Error(`no line ${line} at size ${size}`)
  return comboNumber(size, slots)
}

/** True when two grid squares may swap images. */
export function canSwap(size: number, a: number, b: number): boolean {
  const layout = layoutFor(size)
  return a !== b && layout[a] !== undefined && layout[a] === layout[b]
}

/** Shoes and bag sit outside the grid only while the grid is too small to hold them as kinds. */
export function extrasFor(size: number): Extra[] {
  assertSize(size)
  const shoes: Extra[] = size < 4 ? [0, 1, 2].map(() => ({ kind: 'shoe', imageId: null })) : []
  const bag: Extra[] = size < 5 ? [{ kind: 'bag', imageId: null }] : []
  return [...shoes, ...bag]
}

export function newBoard(name: string, size = 3, now = Date.now()): Board {
  return {
    id: crypto.randomUUID(),
    name,
    size,
    grid: layoutFor(size).map((category) => ({ category, imageId: null })),
    extras: extrasFor(size),
    shoeIdx: 0,
    createdAt: now,
    updatedAt: now,
  }
}

/** Boards saved before sizes existed have no `size`; they are 3x3. Throws on a grid that does not fit its size. */
export function normalizeBoard(board: Omit<Board, 'size'> & { size?: number }): Board {
  const size = board.size ?? 3
  assertSize(size)
  if (!Array.isArray(board.grid) || board.grid.length !== size * size) {
    throw new Error(`Board "${board.name}" does not fit a ${size}x${size} grid.`)
  }
  return { ...board, size }
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
