import { describe, expect, it } from 'vitest'
import {
  KINDS, SIZES, canSwap, comboCount, comboNumber, comboSlots, extrasFor, fillEmpty, isLatinSquare, kindsFor,
  layoutFor, lineCombo, linesFor, newBoard, normalizeBoard, removeImage, slotsOf,
} from './model'
import type { ImageAsset, Kind } from './model'
import { parse, planMerge, serialize } from './transfer'

describe('sizes', () => {
  it('offers 3 to 7 and rejects anything else', () => {
    expect(SIZES).toEqual([3, 4, 5, 6, 7])
    for (const bad of [2, 8, 3.5, NaN]) {
      expect(() => layoutFor(bad)).toThrow(RangeError)
      expect(() => linesFor(bad)).toThrow(RangeError)
      expect(() => comboCount(bad)).toThrow(RangeError)
    }
  })

  it('a size-N board uses the first N kinds', () => {
    expect(kindsFor(3)).toEqual(['top', 'bottom', 'layer'])
    expect(kindsFor(7)).toEqual(KINDS)
  })

  it('size 3 keeps the original layout so saved boards still line up', () => {
    expect(layoutFor(3)).toEqual(['top', 'bottom', 'layer', 'layer', 'top', 'bottom', 'bottom', 'layer', 'top'])
  })
})

describe.each(SIZES)('layout %ix%i', (size) => {
  const layout = layoutFor(size)
  const lines = linesFor(size)

  it('is a latin square with N of each kind', () => {
    expect(isLatinSquare(layout, size)).toBe(true)
    for (const kind of kindsFor(size)) expect(slotsOf(size, kind)).toHaveLength(size)
  })

  it('has N rows, N columns and D, each with one of every kind', () => {
    expect(Object.keys(lines)).toHaveLength(2 * size + 1)
    for (const slots of Object.values(lines)) {
      expect(new Set(slots.map((i) => layout[i]))).toEqual(new Set(kindsFor(size)))
    }
  })

  it('D runs bottom-left to top-right', () => {
    expect(lines.D[0]).toBe((size - 1) * size)
    expect(lines.D[size - 1]).toBe(size - 1)
  })

  it('breaks on every cross-kind swap', () => {
    for (let a = 0; a < layout.length; a++)
      for (let b = a + 1; b < layout.length; b++) {
        expect(canSwap(size, a, b)).toBe(layout[a] === layout[b])
        if (layout[a] === layout[b]) continue
        const cats = [...layout] as Kind[]
        ;[cats[a], cats[b]] = [cats[b], cats[a]]
        expect(isLatinSquare(cats, size)).toBe(false)
      }
    expect(canSwap(size, 0, 0)).toBe(false)
    expect(canSwap(size, 0, size * size)).toBe(false)
  })

  it('numbers lines with distinct combo numbers that round-trip', () => {
    const nums = Object.keys(lines).map((l) => lineCombo(size, l))
    expect(new Set(nums).size).toBe(nums.length)
    for (const l of Object.keys(lines)) {
      expect([...comboSlots(size, lineCombo(size, l))].sort()).toEqual([...lines[l]].sort())
    }
  })

  it('combo numbers round-trip at the edges and in the middle', () => {
    const count = comboCount(size)
    expect(count).toBe(size ** size)
    for (const n of [1, 2, size, Math.ceil(count / 2), count - 1, count]) {
      const slots = comboSlots(size, n)
      expect(slots.map((i) => layout[i])).toEqual(kindsFor(size))
      expect(comboNumber(size, slots)).toBe(n)
    }
    expect(() => comboSlots(size, 0)).toThrow(RangeError)
    expect(() => comboSlots(size, count + 1)).toThrow(RangeError)
  })

  it('new boards fit the size', () => {
    const b = newBoard('t', size, 1)
    expect(b.size).toBe(size)
    expect(b.grid.map((s) => s.category)).toEqual(layout)
    expect(b.extras).toEqual(extrasFor(size))
  })
})

describe('combos 3x3', () => {
  it('enumerates 27 distinct outfits', () => {
    const seen = new Set<string>()
    for (let n = 1; n <= 27; n++) seen.add(comboSlots(3, n).join())
    expect(seen.size).toBe(27)
  })

  it('keeps the published line numbers', () => {
    expect(['R1', 'R2', 'R3', 'C1', 'C2', 'C3', 'D'].map((l) => lineCombo(3, l))).toEqual([1, 14, 27, 8, 12, 22, 16])
  })

  it('throws on a missing kind or unknown line', () => {
    expect(() => comboNumber(3, [0, 4, 8])).toThrow()
    expect(() => lineCombo(3, 'R4')).toThrow()
  })
})

describe('extras', () => {
  it('shoes and bag leave the strip once the grid holds them', () => {
    expect(extrasFor(3).map((e) => e.kind)).toEqual(['shoe', 'shoe', 'shoe', 'bag'])
    expect(extrasFor(4).map((e) => e.kind)).toEqual(['bag'])
    for (const size of [5, 6, 7]) expect(extrasFor(size)).toEqual([])
  })
})

describe('board ops', () => {
  it('fillEmpty fills grid then extras and keeps existing images', () => {
    const b = newBoard('t', 3, 1)
    b.grid[0].imageId = 'keep'
    const ids = Array.from({ length: 14 }, (_, i) => `i${i}`)
    const { board, rest } = fillEmpty(b, ids)
    expect(board.grid[0].imageId).toBe('keep')
    expect(board.grid[1].imageId).toBe('i0')
    expect(board.grid.every((s) => s.imageId)).toBe(true)
    expect(board.extras.map((e) => e.imageId)).toEqual(['i8', 'i9', 'i10', 'i11'])
    expect(rest).toEqual(['i12', 'i13'])
    expect(b.grid[1].imageId).toBeNull() // input untouched
  })

  it('fillEmpty on a 5x5 has no extras to fill', () => {
    const { board, rest } = fillEmpty(newBoard('t', 5, 1), Array.from({ length: 26 }, (_, i) => `i${i}`))
    expect(board.grid.every((s) => s.imageId)).toBe(true)
    expect(rest).toEqual(['i25'])
  })

  it('removeImage nulls every use', () => {
    const b = newBoard('t', 3, 1)
    b.grid[2].imageId = 'x'
    b.extras[3].imageId = 'x'
    const out = removeImage(b, 'x')
    expect(out.grid[2].imageId).toBeNull()
    expect(out.extras[3].imageId).toBeNull()
  })

  it('normalizeBoard treats sizeless boards as 3x3 and rejects misfits', () => {
    const { size: _size, ...legacy } = newBoard('old', 3, 1)
    expect(normalizeBoard(legacy).size).toBe(3)
    expect(() => normalizeBoard({ ...newBoard('bad', 4, 1), size: 5 })).toThrow(/5x5/)
    expect(() => normalizeBoard({ ...newBoard('bad', 3, 1), size: 9 })).toThrow(RangeError)
  })
})

describe('export / import', () => {
  const img = (id: string, bytes: number[]): ImageAsset => ({
    id, name: `${id}.webp`, source: 'upload', createdAt: 5, blob: new Blob([new Uint8Array(bytes)], { type: 'image/webp' }),
  })

  it('round-trips boards of any size and image bytes', async () => {
    const small = newBoard('Lisbon Weekend', 3, 10)
    small.grid[4].imageId = 'a'
    const big = newBoard('Month away', 7, 11)
    const bytes = Array.from({ length: 70000 }, (_, i) => i % 256) // crosses the base64 chunk size
    const json = await serialize([small, big], [img('a', [0, 255, 7, 128]), img('b', bytes)], 99)
    const back = parse(json)
    expect(back.boards).toEqual([small, big])
    expect(back.images[0].blob.type).toBe('image/webp')
    expect([...new Uint8Array(await back.images[0].blob.arrayBuffer())]).toEqual([0, 255, 7, 128])
    expect([...new Uint8Array(await back.images[1].blob.arrayBuffer())]).toEqual(bytes)
  })

  it('imports backups made before sizes existed', async () => {
    const { size: _size, ...legacy } = newBoard('old', 3, 1)
    const json = JSON.stringify({ version: 1, exportedAt: 1, boards: [legacy], images: [] })
    expect(parse(json).boards[0].size).toBe(3)
  })

  it('rejects junk, wrong versions and misfit boards', () => {
    expect(() => parse('nope')).toThrow(/JSON/)
    expect(() => parse('{"version":2,"boards":[],"images":[]}')).toThrow(/version 1/)
    expect(() => parse('null')).toThrow(/version 1/)
    const misfit = JSON.stringify({ version: 1, exportedAt: 1, boards: [{ ...newBoard('x', 3, 1), size: 4 }], images: [] })
    expect(() => parse(misfit)).toThrow(/4x4/)
  })

  it('skips known images and copies colliding boards', () => {
    const board = newBoard('A', 3, 1)
    const plan = planMerge(
      { boards: [board, { ...board, id: 'fresh' }], images: [img('a', [1]), img('b', [2])] },
      new Set([board.id]), new Set(['a']), () => 'new-id',
    )
    expect(plan.images.map((i) => i.id)).toEqual(['b'])
    expect(plan.skippedImages).toBe(1)
    expect(plan.copiedBoards).toBe(1)
    expect(plan.boards.map((b) => [b.id, b.name])).toEqual([['new-id', 'A (imported)'], ['fresh', 'A']])
  })
})
