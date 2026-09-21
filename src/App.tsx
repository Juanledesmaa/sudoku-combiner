import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, DragEvent, FormEvent, ReactNode } from 'react'
import {
  bulkAdd, createBoard, db, deleteImage, exportAll, importFile, ingestFiles, lastExport, saveBoard, useImageUrl,
} from './db'
import { SHORT_TAG, SIZES, TAG, canSwap, kindsFor, comboCount, comboSlots, layoutFor, lineCombo, linesFor } from './model'
import type { Board, LineId } from './model'

type View = 'board' | 'all' | 'boards'
type Selection = { kind: 'line'; line: LineId } | { kind: 'combo'; n: number }
type Target = { area: 'grid' | 'extras'; index: number }

const CURRENT_KEY = 'sudoku-combiner:board'
const PAGE = 60 // outfits per page in the all-outfits view; 7x7 has 823,543
const fmt = (n: number) => n.toLocaleString('en-US')

const squareId = (t: Target) => `${t.area}-${t.index}`
const parseSquareId = (id: string): Target => {
  const [area, index] = id.split('-')
  return { area: area as Target['area'], index: Number(index) }
}

function compatible(board: Board, a: Target, b: Target): boolean {
  if (a.area !== b.area) return false
  if (a.area === 'grid') return canSwap(board.size, a.index, b.index)
  return a.index !== b.index && board.extras[a.index].kind === board.extras[b.index].kind
}

// StrictMode runs effects twice in dev; share one seed promise so only one board is created.
let seeding: Promise<unknown> | null = null

export default function App() {
  const boards = useLiveQuery(() =>
    db.boards.toArray().then((all) =>
      // `size ?? 3`: a tab still running the pre-size build can write a board without it.
      all.map((b) => ({ ...b, size: b.size ?? 3 })).sort((x, y) => x.createdAt - y.createdAt),
    ),
  )
  const [currentId, setCurrentId] = useState(() => localStorage.getItem(CURRENT_KEY))
  const [view, setView] = useState<View>('board')
  const [selection, setSelection] = useState<Selection>({ kind: 'line', line: 'R1' })
  const [viewerOpen, setViewerOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [sheet, setSheet] = useState<Target | null>(null)
  const [dragging, setDragging] = useState<Target | null>(null)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const justDragged = useRef(false)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long-press to drag on touch so a tap still opens the square sheet.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const run = (work: () => Promise<string | void>) => {
    work().then(
      (text) => text && setNotice({ text, error: false }),
      (e: unknown) => setNotice({ text: e instanceof Error ? e.message : 'Storage failed. Changes may not be saved.', error: true }),
    )
  }

  useEffect(() => {
    if (boards && boards.length === 0) {
      seeding ??= createBoard('My first board').finally(() => (seeding = null))
    }
  }, [boards])

  const board = boards?.find((b) => b.id === currentId) ?? boards?.[0]

  const boardId = board?.id
  useEffect(() => {
    if (boardId) localStorage.setItem(CURRENT_KEY, boardId)
  }, [boardId])

  if (!boards || !board) return <p className="loading">Loading…</p>

  const size = board.size
  const layout = layoutFor(size)
  const lines = linesFor(size)
  const count = comboCount(size)
  const lineByCombo = new Map(Object.keys(lines).map((l) => [lineCombo(size, l), l]))
  // A selection made on another board may not exist at this size; fall back instead of throwing.
  const activeLine = selection.kind === 'line' ? (lines[selection.line] ? selection.line : 'R1') : null
  const comboN = activeLine ? lineCombo(size, activeLine) : Math.min((selection as { n: number }).n, count)
  const slots = comboSlots(size, comboN) // always in kind order: top, bottom, layer, ...
  const lit = new Set<number>(slots)
  const pageCount = Math.ceil(count / PAGE)
  const pg = Math.min(page, pageCount - 1)
  const railIds = (prefix: string) => Array.from({ length: size }, (_, i) => `${prefix}${i + 1}`)
  // Full words stop fitting once squares get small: 5x5 and up on phones, 6x6 and up everywhere.
  const density = size >= 6 ? 'short-tags' : size === 5 ? 'short-tags-mobile' : ''

  const select = (s: Selection) => {
    setSelection(s)
    setViewerOpen(true)
  }

  const setImage = (t: Target, imageId: string | null) => {
    const next = { ...board, grid: [...board.grid], extras: [...board.extras] }
    if (t.area === 'grid') next.grid[t.index] = { ...next.grid[t.index], imageId }
    else next.extras[t.index] = { ...next.extras[t.index], imageId }
    run(() => saveBoard(next))
  }

  const report = (rejected: string[]) => (rejected.length ? Promise.reject(new Error(rejected.join(' · '))) : undefined)

  const uploadTo = (t: Target, files: FileList | File[]) =>
    run(async () => {
      const { ids, rejected } = await ingestFiles([...files].slice(0, 1))
      if (ids[0]) setImage(t, ids[0])
      return report(rejected)
    })

  const onBulk = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length) run(async () => report((await bulkAdd(board, files)).rejected))
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    justDragged.current = true
    setTimeout(() => (justDragged.current = false))
    if (!over) return
    const a = parseSquareId(String(active.id))
    const b = parseSquareId(String(over.id))
    if (!compatible(board, a, b)) return
    const list = a.area === 'grid' ? board.grid : board.extras
    const swapped = list.map((s, i) =>
      i === a.index ? { ...s, imageId: list[b.index].imageId } : i === b.index ? { ...s, imageId: list[a.index].imageId } : s,
    )
    run(() => saveBoard({ ...board, [a.area]: swapped }))
  }

  const square = (t: Target, tag: string, shortTag: string, label: string) => {
    const imageId = (t.area === 'grid' ? board.grid : board.extras)[t.index].imageId
    return (
      <Square
        key={squareId(t)}
        id={squareId(t)}
        imageId={imageId}
        tag={tag}
        shortTag={shortTag}
        label={label}
        lit={t.area === 'grid' && lit.has(t.index)}
        dimmed={!!dragging && squareId(dragging) !== squareId(t) && !compatible(board, dragging, t)}
        onOpen={() => !justDragged.current && setSheet(t)}
        onFiles={(files) => uploadTo(t, files)}
      />
    )
  }

  const rail = (line: LineId) => (
    <button
      key={line}
      className={`rail ${activeLine === line ? 'on' : ''}`}
      onClick={() => select({ kind: 'line', line })}
      aria-label={`Show outfit ${line}`}
    >
      {line}
    </button>
  )

  const shoes = board.extras.filter((e) => e.kind === 'shoe')
  const shoe = shoes.length ? shoes[board.shoeIdx % shoes.length] : null
  const bag = board.extras.find((e) => e.kind === 'bag') ?? null

  return (
    <div className="app">
      <header>
        <h1>SUDOKU COMBINER</h1>
        <nav aria-label="Sections">
          {(['board', 'all', 'boards'] as const).map((v) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v === 'all' ? `ALL ${fmt(count)}` : v.toUpperCase()}
            </button>
          ))}
        </nav>
        <div className="actions">
          <span className="board-name">{board.name} · {size}×{size}</span>
          <label className="btn red">
            + ADD PHOTOS
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={onBulk} />
          </label>
        </div>
      </header>

      {notice && (
        <p className={`notice ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}>
          {notice.text}
          <button onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
        </p>
      )}

      <main>
        <section className="stage">
          {view === 'board' && (
            <DndContext
              sensors={sensors}
              onDragStart={(e) => setDragging(parseSquareId(String(e.active.id)))}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDragging(null)}
            >
              <div className={`board ${density} ${board.extras.length ? '' : 'no-extras'}`} style={{ '--n': size } as CSSProperties}>
                <div className="cols">{railIds('C').map(rail)}</div>
                <div className="rows">{railIds('R').map(rail)}</div>
                <div className="grid">
                  {board.grid.map((_, i) =>
                    square({ area: 'grid', index: i }, TAG[layout[i]], SHORT_TAG[layout[i]], `${layout[i]} square ${i + 1}`),
                  )}
                </div>
                <button
                  className={`rail diag ${activeLine === 'D' ? 'on' : ''}`}
                  onClick={() => select({ kind: 'line', line: 'D' })}
                  aria-label="Show diagonal outfit"
                >
                  D ↗
                </button>
                {board.extras.length > 0 && (
                  <div className="extras">
                    <p className="label">EXTRAS</p>
                    <div className="extras-list">
                      {board.extras.map((e, i) => {
                        const tag = e.kind === 'shoe' ? 'SHOES' : 'BAG'
                        return square({ area: 'extras', index: i }, tag, tag, e.kind)
                      })}
                    </div>
                  </div>
                )}
              </div>
              <DragOverlay>{dragging && <DragGhost board={board} target={dragging} />}</DragOverlay>
            </DndContext>
          )}

          {view === 'all' && (
            <>
              {pageCount > 1 && (
                <div className="pager">
                  <button className="btn" disabled={pg === 0} onClick={() => setPage(pg - 1)}>‹ PAGE</button>
                  <span>
                    {fmt(pg * PAGE + 1)}–{fmt(Math.min((pg + 1) * PAGE, count))} of {fmt(count)}
                  </span>
                  <button className="btn" disabled={pg === pageCount - 1} onClick={() => setPage(pg + 1)}>PAGE ›</button>
                  <button
                    className="btn red"
                    onClick={() => {
                      const n = Math.floor(Math.random() * count) + 1
                      setPage(Math.floor((n - 1) / PAGE))
                      select({ kind: 'combo', n })
                    }}
                  >
                    RANDOM OUTFIT
                  </button>
                </div>
              )}
              <div className="combos" style={{ '--n': size } as CSSProperties}>
                {Array.from({ length: Math.min(PAGE, count - pg * PAGE) }, (_, i) => pg * PAGE + i + 1).map((n) => (
                  <button key={n} className={`combo ${n === comboN ? 'on' : ''}`} onClick={() => select({ kind: 'combo', n })}>
                    <span className="combo-n">
                      {fmt(n)}
                      {lineByCombo.has(n) && <b>{lineByCombo.get(n)}</b>}
                    </span>
                    <span className="combo-imgs">
                      {comboSlots(size, n).map((sl) => (
                        <Thumb key={sl} imageId={board.grid[sl].imageId} fallback={SHORT_TAG[layout[sl]]} />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {view === 'boards' && (
            <Boards boards={boards} current={board} onPick={(id) => { setCurrentId(id); setView('board') }} run={run} />
          )}
        </section>

        <aside className={`viewer ${viewerOpen ? 'open' : ''}`} aria-label="Selected outfit">
          <button className="close" onClick={() => setViewerOpen(false)} aria-label="Close outfit">×</button>
          <p className="label">SELECTED OUTFIT</p>
          <p className="big">
            {activeLine ?? lineByCombo.get(comboN) ?? 'MIX'}
            <small>{fmt(comboN)}/{fmt(count)}</small>
          </p>
          <div className="look">
            {slots.map((sl) => (
              <figure key={sl}>
                <Thumb imageId={board.grid[sl].imageId} fallback="" />
                <figcaption>{TAG[layout[sl]]}</figcaption>
              </figure>
            ))}
          </div>
          {(shoe || bag) && (
            <div className="look-extras">
              {shoe && <Thumb imageId={shoe.imageId} fallback="SHOES" />}
              {bag && <Thumb imageId={bag.imageId} fallback="BAG" />}
            </div>
          )}
          <div className="viewer-actions">
            <button className="btn" onClick={() => select({ kind: 'combo', n: comboN === 1 ? count : comboN - 1 })}>‹ PREV</button>
            <button className="btn" onClick={() => select({ kind: 'combo', n: (comboN % count) + 1 })}>NEXT ›</button>
            {shoes.length > 1 && (
              <button className="btn" onClick={() => run(() => saveBoard({ ...board, shoeIdx: (board.shoeIdx + 1) % shoes.length }))}>
                SHOES {(board.shoeIdx % shoes.length) + 1}/{shoes.length}
              </button>
            )}
          </div>
        </aside>
      </main>

      {sheet && (
        <SquareSheet
          hasImage={!!(sheet.area === 'grid' ? board.grid : board.extras)[sheet.index].imageId}
          onClose={() => setSheet(null)}
          onUpload={(files) => { uploadTo(sheet, files); setSheet(null) }}
          onPick={(id) => { setImage(sheet, id); setSheet(null) }}
          onDelete={(id) => run(() => deleteImage(id))}
        />
      )}
    </div>
  )
}

function Thumb({ imageId, fallback }: { imageId: string | null; fallback: string }) {
  const url = useImageUrl(imageId)
  return <span className="thumb">{url ? <img src={url} alt="" draggable={false} /> : <i>{fallback}</i>}</span>
}

function DragGhost({ board, target }: { board: Board; target: Target }) {
  const url = useImageUrl((target.area === 'grid' ? board.grid : board.extras)[target.index].imageId)
  return url ? <img className="ghost" src={url} alt="" /> : null
}

interface SquareProps {
  id: string
  imageId: string | null
  tag: string
  shortTag: string
  label: string
  lit: boolean
  dimmed: boolean
  onOpen: () => void
  onFiles: (files: File[]) => void
}

function Square({ id, imageId, tag, shortTag, label, lit, dimmed, onOpen, onFiles }: SquareProps) {
  const url = useImageUrl(imageId)
  const drag = useDraggable({ id, disabled: !imageId })
  const drop = useDroppable({ id })
  const [fileOver, setFileOver] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setFileOver(false)
    const files = [...e.dataTransfer.files]
    if (files.length) onFiles(files)
  }

  return (
    <button
      ref={(node) => { drag.setNodeRef(node); drop.setNodeRef(node) }}
      {...drag.listeners}
      {...drag.attributes}
      className={['sq', lit && 'lit', dimmed && 'dimmed', !imageId && 'empty', (drop.isOver || fileOver) && 'over', drag.isDragging && 'lifted']
        .filter(Boolean).join(' ')}
      onClick={onOpen}
      onDragOver={(e) => { e.preventDefault(); setFileOver(true) }}
      onDragLeave={() => setFileOver(false)}
      onDrop={onDrop}
      aria-label={imageId ? `${label}, change image` : `${label}, add image`}
    >
      <i className="tag">
        <span className="full">{tag}</span>
        <span className="short">{shortTag}</span>
      </i>
      {url ? <img src={url} alt="" draggable={false} /> : !imageId && <span className="drop"><b>+</b>ADD PHOTO</span>}
    </button>
  )
}

interface SheetProps {
  hasImage: boolean
  onClose: () => void
  onUpload: (files: File[]) => void
  onPick: (imageId: string | null) => void
  onDelete: (imageId: string) => void
}

function SquareSheet({ hasImage, onClose, onUpload, onPick, onDelete }: SheetProps) {
  const images = useLiveQuery(() => db.images.orderBy('createdAt').reverse().toArray())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Choose image" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-actions">
          <label className="btn red">
            UPLOAD NEW
            <input
              type="file" accept="image/png,image/jpeg,image/webp" hidden
              onChange={(e) => e.target.files?.length && onUpload([...e.target.files])}
            />
          </label>
          {hasImage && <button className="btn" onClick={() => onPick(null)}>CLEAR SQUARE</button>}
          <button className="btn" onClick={onClose}>CANCEL</button>
        </div>
        <p className="label">FROM LIBRARY</p>
        {images?.length ? (
          <div className="library">
            {images.map((img) => (
              <div key={img.id} className="lib-item">
                <button className="lib-pick" onClick={() => onPick(img.id)} aria-label={`Use ${img.name}`}>
                  <Thumb imageId={img.id} fallback="" />
                </button>
                <button
                  className="lib-del"
                  aria-label={`Delete ${img.name}`}
                  onClick={() => confirm(`Delete ${img.name} from library? It is removed from every board.`) && onDelete(img.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">No images yet. Upload one, or use + ADD PHOTOS to add many at once.</p>
        )}
      </div>
    </div>
  )
}

interface BoardsProps {
  boards: Board[]
  current: Board
  onPick: (id: string) => void
  run: (work: () => Promise<string | void>) => void
}

function Boards({ boards, current, onPick, run }: BoardsProps) {
  const exported = lastExport()

  const [name, setName] = useState('')
  const [size, setSize] = useState(3)

  const create = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) run(async () => onPick((await createBoard(trimmed, size)).id))
  }
  const rename = (b: Board) => {
    const name = prompt('Rename board', b.name)?.trim()
    if (name && name !== b.name) run(() => saveBoard({ ...b, name }))
  }
  const remove = (b: Board) => {
    if (confirm(`Delete board "${b.name}"? Images stay in library.`)) run(() => db.boards.delete(b.id))
  }

  return (
    <div className="boards">
      <ul>
        {boards.map((b) => (
          <li key={b.id} className={b.id === current.id ? 'on' : ''}>
            <button className="board-pick" onClick={() => onPick(b.id)}>
              <BoardPreview board={b} />
              <span>
                <b>{b.name}</b>
                <small>
                  {b.size}×{b.size} · {b.grid.filter((s) => s.imageId).length}/{b.grid.length} squares
                </small>
              </span>
            </button>
            <button className="btn" onClick={() => rename(b)}>RENAME</button>
            <button className="btn" onClick={() => remove(b)}>DELETE</button>
          </li>
        ))}
      </ul>
      <form className="new-board" onSubmit={create}>
        <p className="label">NEW BOARD</p>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Board name" maxLength={60}
          aria-label="Board name" required
        />
        <div className="sizes" role="radiogroup" aria-label="Grid size">
          {SIZES.map((n) => (
            <button
              key={n} type="button" role="radio" aria-checked={size === n}
              className={`btn ${size === n ? 'on' : ''}`} onClick={() => setSize(n)}
            >
              {n}×{n}
            </button>
          ))}
        </div>
        <p className="hint">
          {size}×{size}: {size} each of {kindsFor(size).map((k) => TAG[k]).join(', ')}. {size * size} photos, {fmt(comboCount(size))} outfits.
          Size is fixed once the board exists.
        </p>
        <button className="btn red" type="submit">+ CREATE BOARD</button>
      </form>
      <div className="boards-actions">
        <button className="btn" onClick={() => run(exportAll)}>EXPORT BACKUP</button>
        <label className="btn">
          IMPORT BACKUP
          <input
            type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(() => importFile(f)) }}
          />
        </label>
      </div>
      <p className="hint">
        Boards live in this browser only. Last backup: {exported ? new Date(exported).toLocaleDateString() : 'never'}.
      </p>
    </div>
  )
}

function BoardPreview({ board }: { board: Board }): ReactNode {
  return (
    <span className="preview" style={{ '--n': board.size } as CSSProperties}>
      {board.grid.map((s, i) => <Thumb key={i} imageId={s.imageId} fallback="" />)}
    </span>
  )
}
