import { Dexie, type EntityTable } from 'dexie'
import { useEffect, useState } from 'react'
import { fillEmpty, newBoard, removeImage } from './model'
import type { Board, ImageAsset } from './model'
import { parse, planMerge, serialize } from './transfer'

export const db = new Dexie('sudoku-combiner') as Dexie & {
  boards: EntityTable<Board, 'id'>
  images: EntityTable<ImageAsset, 'id'>
}

db.version(1).stores({
  boards: 'id, updatedAt',
  images: 'id, createdAt',
})

// v2: boards gained `size`. Everything saved before that is a 3x3.
db.version(2).upgrade((tx) =>
  tx.table('boards').toCollection().modify((b: { size?: number }) => {
    b.size ??= 3
  }),
)

const MAX_BYTES = 15 * 1024 * 1024
const MAX_EDGE = 1200
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']
const LAST_EXPORT_KEY = 'sudoku-combiner:lastExport'

export async function saveBoard(board: Board): Promise<void> {
  await db.boards.put({ ...board, updatedAt: Date.now() })
}

export async function createBoard(name: string, size = 3): Promise<Board> {
  const board = newBoard(name, size)
  await db.boards.add(board)
  return board
}

async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // Browsers without WebP encoding fall back to PNG here, which also keeps alpha.
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Could not read ${file.name}.`))), 'image/webp', 0.85),
  )
}

export interface IngestResult {
  ids: string[]
  rejected: string[]
}

export async function ingestFiles(files: Iterable<File>): Promise<IngestResult> {
  const ids: string[] = []
  const rejected: string[] = []
  let first = true
  for (const file of files) {
    if (!ACCEPTED.includes(file.type)) rejected.push(`${file.name}: use PNG, JPG or WebP`)
    else if (file.size > MAX_BYTES) rejected.push(`${file.name}: over 15 MB`)
    else {
      try {
        const asset: ImageAsset = {
          id: crypto.randomUUID(),
          blob: await downscale(file),
          name: file.name,
          source: 'upload',
          createdAt: Date.now(),
        }
        await db.images.add(asset)
        ids.push(asset.id)
        // iOS Safari evicts IndexedDB after ~7 idle days unless storage is persisted.
        if (first) void navigator.storage?.persist?.()
        first = false
      } catch (e) {
        rejected.push(e instanceof Error ? e.message : `${file.name}: could not be read`)
      }
    }
  }
  return { ids, rejected }
}

export async function bulkAdd(board: Board, files: Iterable<File>): Promise<IngestResult> {
  const result = await ingestFiles(files)
  if (result.ids.length) await saveBoard(fillEmpty(board, result.ids).board)
  return result
}

export async function deleteImage(imageId: string): Promise<void> {
  await db.transaction('rw', db.boards, db.images, async () => {
    const boards = await db.boards.toArray()
    for (const b of boards) {
      const next = removeImage(b, imageId)
      if (JSON.stringify(next) !== JSON.stringify(b)) await db.boards.put({ ...next, updatedAt: Date.now() })
    }
    await db.images.delete(imageId)
  })
  const url = urls.get(imageId)
  if (url) URL.revokeObjectURL(url)
  urls.delete(imageId)
}

export async function exportAll(): Promise<void> {
  const json = await serialize(await db.boards.toArray(), await db.images.toArray())
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  a.download = `sudoku-combiner-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()))
}

export function lastExport(): number | null {
  const v = Number(localStorage.getItem(LAST_EXPORT_KEY))
  return v || null
}

export async function importFile(file: File): Promise<string> {
  const incoming = parse(await file.text())
  const plan = planMerge(
    incoming,
    new Set(await db.boards.toCollection().primaryKeys()),
    new Set(await db.images.toCollection().primaryKeys()),
  )
  await db.transaction('rw', db.boards, db.images, async () => {
    await db.images.bulkAdd(plan.images)
    await db.boards.bulkAdd(plan.boards)
  })
  const parts = [`${plan.boards.length} boards, ${plan.images.length} images imported`]
  if (plan.copiedBoards) parts.push(`${plan.copiedBoards} existing boards kept, imported as copies`)
  if (plan.skippedImages) parts.push(`${plan.skippedImages} images already here`)
  return parts.join(' · ')
}

// One object URL per image for the life of the page; revoked on delete.
const urls = new Map<string, string>()

export function useImageUrl(imageId: string | null): string | null {
  const [, setLoadedId] = useState<string | null>(null)
  useEffect(() => {
    if (!imageId || urls.has(imageId)) return
    let live = true
    void db.images.get(imageId).then((asset) => {
      if (!asset) return
      if (!urls.has(imageId)) urls.set(imageId, URL.createObjectURL(asset.blob))
      if (live) setLoadedId(imageId) // re-render now that the cache has it
    })
    return () => {
      live = false
    }
  }, [imageId])
  return imageId ? (urls.get(imageId) ?? null) : null
}
