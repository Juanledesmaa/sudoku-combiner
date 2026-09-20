import type { Board, ImageAsset } from './model'

export const EXPORT_VERSION = 1

interface ExportedImage extends Omit<ImageAsset, 'blob'> {
  type: string
  data: string // base64
}

export interface ExportFile {
  version: number
  exportedAt: number
  boards: Board[]
  images: ExportedImage[]
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function fromBase64(data: string): Uint8Array<ArrayBuffer> {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export async function serialize(boards: Board[], images: ImageAsset[], now = Date.now()): Promise<string> {
  const out: ExportFile = {
    version: EXPORT_VERSION,
    exportedAt: now,
    boards,
    images: await Promise.all(
      images.map(async ({ blob, ...rest }) => ({
        ...rest,
        type: blob.type,
        data: toBase64(new Uint8Array(await blob.arrayBuffer())),
      })),
    ),
  }
  return JSON.stringify(out)
}

export function parse(json: string): { boards: Board[]; images: ImageAsset[] } {
  let file: ExportFile
  try {
    file = JSON.parse(json)
  } catch {
    throw new Error('Not a valid JSON file.')
  }
  if (file?.version !== EXPORT_VERSION || !Array.isArray(file.boards) || !Array.isArray(file.images)) {
    throw new Error('Not a Sudoku Combiner export (version 1).')
  }
  const images = file.images.map(({ data, type, ...rest }) => ({ ...rest, blob: new Blob([fromBase64(data)], { type }) }))
  return { boards: file.boards, images }
}

export interface MergePlan {
  boards: Board[]
  images: ImageAsset[]
  skippedImages: number
  copiedBoards: number
}

/** Images are immutable: same id is skipped. A board id collision imports as a copy. */
export function planMerge(
  incoming: { boards: Board[]; images: ImageAsset[] },
  existingBoardIds: ReadonlySet<string>,
  existingImageIds: ReadonlySet<string>,
  newId: () => string = () => crypto.randomUUID(),
): MergePlan {
  const images = incoming.images.filter((i) => !existingImageIds.has(i.id))
  let copiedBoards = 0
  const boards = incoming.boards.map((b) => {
    if (!existingBoardIds.has(b.id)) return b
    copiedBoards++
    return { ...b, id: newId(), name: `${b.name} (imported)` }
  })
  return { boards, images, skippedImages: incoming.images.length - images.length, copiedBoards }
}
