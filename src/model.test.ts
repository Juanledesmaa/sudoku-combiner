import { describe, expect, it } from 'vitest'
import {
  CATEGORIES, COMBO_COUNT, LAYOUT, LINES, canSwap, comboNumber, comboSlots, fillEmpty,
  isLatinSquare, lineCombo, newBoard, removeImage, slotsOf,
} from './model'
import type { Category, ImageAsset, LineId } from './model'
import { parse, planMerge, serialize } from './transfer'

describe('layout', () => {
  it('is a latin square', () => expect(isLatinSquare(LAYOUT)).toBe(true))

  it('rejects any cross-category swap', () => {
    for (let a = 0; a < 9; a++)
      for (let b = a + 1; b < 9; b++) {
        if (LAYOUT[a] === LAYOUT[b]) continue
        const cats = [...LAYOUT] as Category[]
        ;[cats[a], cats[b]] = [cats[b], cats[a]]
        expect(isLatinSquare(cats)).toBe(false)
      }
  })

  it('rejects wrong sizes', () => expect(isLatinSquare(LAYOUT.slice(0, 8))).toBe(false))

  it('every line has one of each category, including D', () => {
    for (const line of Object.keys(LINES) as LineId[]) {
      expect(new Set(LINES[line].map((i) => LAYOUT[i]))).toEqual(new Set(CATEGORIES))
    }
  })

  it('D is bottom-left to top-right; the other diagonal is invalid', () => {
    expect(LINES.D).toEqual([6, 4, 2])
    expect(new Set([0, 4, 8].map((i) => LAYOUT[i])).size).toBe(1)
  })

  it('canSwap only within a category', () => {
    expect(canSwap(0, 4)).toBe(true)
    expect(canSwap(0, 1)).toBe(false)
    expect(canSwap(3, 3)).toBe(false)
  })
})

describe('combos', () => {
  it('enumerates 27 distinct outfits, one of each category', () => {
    const seen = new Set<string>()
    for (let n = 1; n <= COMBO_COUNT; n++) {
      const slots = comboSlots(n)
      expect(slots.map((i) => LAYOUT[i])).toEqual(['top', 'bottom', 'layer'])
      seen.add(slots.join())
      expect(comboNumber(slots)).toBe(n)
    }
    expect(seen.size).toBe(27)
  })

  it('throws out of range', () => {
    expect(() => comboSlots(0)).toThrow(RangeError)
    expect(() => comboSlots(28)).toThrow(RangeError)
    expect(() => comboNumber([0, 4, 8])).toThrow()
  })

  it('maps the 7 lines to 7 distinct combo numbers', () => {
    const nums = (Object.keys(LINES) as LineId[]).map(lineCombo)
    expect(new Set(nums).size).toBe(7)
    expect(lineCombo('R1')).toBe(comboNumber([0, 1, 2]))
    // R1 = first top, first bottom, first layer
    expect(lineCombo('R1')).toBe(1)
  })

  it('slotsOf returns grid order', () => expect(slotsOf('top')).toEqual([0, 4, 8]))
})

describe('board ops', () => {
  it('fillEmpty fills grid then extras and keeps existing images', () => {
    const b = newBoard('t', 1)
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

  it('removeImage nulls every use', () => {
    const b = newBoard('t', 1)
    b.grid[2].imageId = 'x'
    b.extras[3].imageId = 'x'
    const out = removeImage(b, 'x')
    expect(out.grid[2].imageId).toBeNull()
    expect(out.extras[3].imageId).toBeNull()
  })
})

describe('export / import', () => {
  const img = (id: string, bytes: number[]): ImageAsset => ({
    id, name: `${id}.webp`, source: 'upload', createdAt: 5, blob: new Blob([new Uint8Array(bytes)], { type: 'image/webp' }),
  })

  it('round-trips boards and image bytes', async () => {
    const board = newBoard('Lisbon Weekend', 10)
    board.grid[4].imageId = 'a'
    const big = Array.from({ length: 70000 }, (_, i) => i % 256) // crosses the base64 chunk size
    const json = await serialize([board], [img('a', [0, 255, 7, 128]), img('b', big)], 99)
    const back = parse(json)
    expect(back.boards).toEqual([board])
    expect(back.images[0].blob.type).toBe('image/webp')
    expect([...new Uint8Array(await back.images[0].blob.arrayBuffer())]).toEqual([0, 255, 7, 128])
    expect([...new Uint8Array(await back.images[1].blob.arrayBuffer())]).toEqual(big)
  })

  it('rejects junk and wrong versions', () => {
    expect(() => parse('nope')).toThrow(/JSON/)
    expect(() => parse('{"version":2,"boards":[],"images":[]}')).toThrow(/version 1/)
    expect(() => parse('null')).toThrow(/version 1/)
  })

  it('skips known images and copies colliding boards', () => {
    const board = newBoard('A', 1)
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
