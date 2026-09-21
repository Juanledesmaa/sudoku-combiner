# Sudoku Combiner

An outfit planner for the sudoku packing method. You put 9 garments on a 3x3 grid (3 tops, 3 bottoms, 3 layers), and every row, every column, and one diagonal reads as a complete outfit. Any top with any bottom with any layer gives 27 outfits from 9 pieces.

Grids go from 3x3 up to 7x7. Each step up adds one more kind of piece (shoes, bag, accessory, outerwear), so rows and columns stay complete outfits at every size.

You use your own photos. Boards are saved by name. Everything stays in your browser: no account, no server.

Method reference: [The Sudoku Packing Method](https://mademoisellejaime.substack.com/p/the-sudoku-packing-method-aka-the).

**Contents**

- [Quick start](#quick-start)
- [Tutorial: build your first board](#tutorial-build-your-first-board)
- [How to move your boards to another device](#how-to-move-your-boards-to-another-device)
- [How to deploy on Netlify](#how-to-deploy-on-netlify)
- [How to install it on your phone](#how-to-install-it-on-your-phone)
- [Reference](#reference)
- [Why it works this way](#why-it-works-this-way)
- [Development](#development)

## Quick start

You need Node 22 or newer (see `.nvmrc`).

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The app creates a board called "My first board" on first load.

## Tutorial: build your first board

You will fill a board with 13 photos, read outfits off it, and rearrange it. It takes about five minutes once you have the photos.

### What you'll need

- The app running (see [Quick start](#quick-start)) or your deployed site.
- 13 photos: 3 tops, 3 bottoms, 3 layers (blazer, cardigan, coat), 3 pairs of shoes, 1 bag. PNG, JPG, or WebP, each under 15 MB. A plain background works best. PNGs with a transparent background look cleanest.

### Step 1: Add all your photos at once

Select **+ ADD PHOTOS** in the header and pick all 13 files in one go.

The photos land in your image library, then fill the empty squares in reading order: the 9 grid squares first, then the 4 EXTRAS squares (SHOES, SHOES, SHOES, BAG). You now have a full board, but pieces are probably in the wrong squares. That is expected.

### Step 2: Put each piece in a square of its category

Each grid square has a corner tag: **TOP**, **BOTTOM**, or **LAYER**. The tags never move. Your job is to get a top into every TOP square, a bottom into every BOTTOM, a layer into every LAYER.

Select any square that holds the wrong piece. A sheet opens with **FROM LIBRARY**. Pick the right photo for that square. Repeat until all 9 tags match their photos. Do the same for the EXTRAS column: shoes in the three **SHOES** squares, the bag in **BAG**.

### Step 3: Read an outfit

Select **R2** on the left rail. The three squares in row 2 get a red outline, and the viewer shows that outfit large, with its number out of 27, plus your selected shoes and the bag.

Try **C1**, **C3**, and **D ↗** (the diagonal). On a phone, the viewer slides up from the bottom. Close it with **×**.

### Step 4: Browse all 27

Select **ALL 27**. You see every top x bottom x layer combination. The 7 that match a rail carry a red label (`R1`, `C2`, `D`, and so on). Select any card to see it large. In the viewer, **‹ PREV** and **NEXT ›** step through all 27, and **SHOES 1/3** cycles which pair is shown.

### Step 5: Rearrange

Back on **BOARD**, drag one top onto another top. The two photos swap. While you drag, squares you cannot drop on fade out: a top can only swap with a top. On a phone, press and hold for a quarter second, then drag.

Swapping changes which pieces share a row or column, so the 7 rail outfits change. The set of 27 stays the same.

### What you built

A saved board. Reload the page and it is still there. From here:

- Make a board per trip under **BOARDS > NEW BOARD**: type a name, pick a size from 3×3 to 7×7, select **+ CREATE BOARD**. The hint under the size buttons tells you which kinds and how many photos that size needs. All boards share one image library.
- Back it up: see [How to move your boards to another device](#how-to-move-your-boards-to-another-device).

## How to move your boards to another device

Boards live in one browser on one device. This copies everything (all boards, all images) to another browser or device.

### Prerequisites

- The app open on both devices. They can be different deployments, for example `localhost` and your Netlify site.

### Steps

1. On the source device, open **BOARDS** and select **EXPORT BACKUP**. The browser downloads `sudoku-combiner-YYYY-MM-DD.json`.
2. Get that file to the other device (AirDrop, email, cloud drive).
3. On the target device, open **BOARDS**, select **IMPORT BACKUP**, and pick the file.

### Verification

A notice appears, for example `2 boards, 13 images imported`. The boards show up in the **BOARDS** list with their square counts.

### Troubleshooting

| You see | Cause | Fix |
|---|---|---|
| `Not a valid JSON file.` | The file is not JSON, or got truncated in transfer. | Export again and resend. |
| `Not a Sudoku Combiner export (version 1).` | Valid JSON, but not an export from this app, or from a future format version. | Pick the right file, or update the app. |
| `N existing boards kept, imported as copies` | A board with the same id already exists here. Import never overwrites. | Nothing. The copy is named `<name> (imported)`. Delete whichever you do not want. |
| `N images already here` | Those images were imported before. Images never change once stored, so they are skipped. | Nothing. |
| Large file, slow import | Images are embedded as base64, which is about a third larger than the stored image. | Delete unused images from the library sheet before exporting. |

## How to deploy on Netlify

You get a public URL that redeploys on every push to `main`.

### Prerequisites

- This repo on GitHub.
- A Netlify account connected to your GitHub.

### Steps

1. In Netlify, select **Add new site > Import an existing project > GitHub**.
2. Pick this repository.
3. Leave the build settings alone. `netlify.toml` supplies them.
4. Select **Deploy**.

### Verification

Open the site URL. You see an empty "My first board". In the deploy log, the build step shows `Tests  50 passed` before the Vite build output.

### Troubleshooting

- **Deploy fails at the test step.** The build command is `npm test && npm run build`, so a failing unit test blocks the deploy on purpose. Run `npm test` locally and fix it.
- **Deploy fails with a Node or Vite engine error.** `netlify.toml` pins `NODE_VERSION = "22"`. If you changed or removed it, restore it. Vite 8 needs a recent Node.
- **The site is empty but localhost had boards.** Storage is per browser and per site address. See [How to move your boards to another device](#how-to-move-your-boards-to-another-device).

## How to install it on your phone

Installing matters on iPhone: Safari can delete a site's stored data after about 7 days without visits, unless the site is on your home screen.

1. Open your deployed site in the phone browser.
2. iPhone (Safari): **Share > Add to Home Screen**. Android (Chrome): **menu > Add to Home screen** or **Install app**.
3. Open it from the home screen icon.

The app also asks the browser for persistent storage the first time you add an image. Still, keep a backup: the **BOARDS** page shows the date of your last export.

The app needs a connection to load. There is no offline mode.

## Reference

### Screens

| Screen | What it holds |
|---|---|
| **BOARD** | The grid, the rails, the EXTRAS column, and the outfit viewer. |
| **ALL n** | One card per combination (n is 27 for 3x3, up to 823,543 for 7x7). Shown 60 per page. Above one page you get **‹ PAGE**, **PAGE ›**, and **RANDOM OUTFIT**, which jumps to a random combination and opens it. |
| **BOARDS** | Board list with size and fill count, create (name + size), rename, delete, export, import. |

On screens narrower than 1024px, the three screen buttons sit in a fixed bottom bar, the layout is one column, EXTRAS is a row under the grid, and the viewer is a bottom sheet.

### Sizes and kinds

A size-N board is an N×N grid holding N kinds of piece, N of each. Size is chosen when the board is created and cannot change afterwards.

| Size | Kinds in the grid | Photos | Outfits (N^N) | EXTRAS strip |
|---|---|---|---|---|
| 3×3 | TOP, BOTTOM, LAYER | 9 | 27 | 3 shoes + 1 bag |
| 4×4 | + SHOES | 16 | 256 | 1 bag |
| 5×5 | + BAG | 25 | 3,125 | none |
| 6×6 | + ACCESSORY | 36 | 46,656 | none |
| 7×7 | + OUTERWEAR | 49 | 823,543 | none |

Shoes and the bag sit in EXTRAS only while the grid is too small to hold them as kinds. Extras are shown with every outfit but do not count toward the outfit number.

Square tags show the full word. They shorten to three letters (TOP, BOT, LAY, SHO, BAG, ACC, OUT) on 6×6 and 7×7, and on 5×5 when the screen is narrower than 1024px. The viewer always captions each piece with the full word.

### Grid layout

Positions are numbered from 0 in reading order. Kinds are fixed per position. 3×3:

```
        C1      C2      C3
R1    0 T     1 B     2 L
R2    3 L     4 T     5 B
R3    6 B     7 L     8 T
```

Odd sizes (3, 5, 7) follow the same pattern: each row is the row above shifted one step right. Even sizes use fixed squares, by kind number (0 = TOP, 1 = BOTTOM, 2 = LAYER, 3 = SHOES, 4 = BAG, 5 = ACCESSORY):

```
4×4           6×6
0 1 2 3       0 1 2 3 4 5
2 3 0 1       1 0 3 5 2 4
3 2 1 0       2 3 4 0 5 1
1 0 3 2       4 5 1 2 0 3
              5 4 0 1 3 2
              3 2 5 4 1 0
```

### Lines

Every size has rails R1..RN, C1..CN, and **D**, the diagonal from bottom-left to top-right: 2N + 1 rails. The other diagonal is never a complete outfit in these layouts, so it has no rail.

3×3 rails:

| Rail | Grid positions | Outfit number |
|---|---|---|
| R1 | 0, 1, 2 | 1 |
| R2 | 3, 4, 5 | 14 |
| R3 | 6, 7, 8 | 27 |
| C1 | 0, 3, 6 | 8 |
| C2 | 1, 4, 7 | 12 |
| C3 | 2, 5, 8 | 22 |
| D | 6, 4, 2 | 16 |

### Outfit numbering

Within each kind, pieces are indexed from zero by grid position. An outfit is one index per kind, read as a base-N number with TOP as the most significant digit, plus 1:

```
number = (((top * N + bottom) * N + layer) * N + ...) + 1
```

3×3 example: tops sit at positions 0, 4, 8, bottoms at 1, 5, 6, layers at 2, 3, 7. R2 is the layer at 3 (index 1), the top at 4 (index 1), the bottom at 5 (index 1), so `1*9 + 1*3 + 1 + 1 = 14`. The viewer always shows pieces in kind order.

### Actions

| Action | How | Result |
|---|---|---|
| Add many photos | **+ ADD PHOTOS**, pick several files | All go to the library. Empty grid squares fill in order, then empty EXTRAS. Filled squares are never replaced. Leftovers stay in the library. |
| Set one square | Select the square, then **UPLOAD NEW** or a library photo | Only that square changes. Its category tag does not. |
| Drop a file | Drag an image file from your computer onto a square | Same as **UPLOAD NEW**. Only the first file is used. |
| Clear a square | Select the square, **CLEAR SQUARE** | Square is empty. The photo stays in the library. |
| Swap two pieces | Drag a filled square onto another square. Touch: hold 250 ms, then drag | Photos swap. Allowed only between grid squares of the same kind, or between shoe squares in EXTRAS. A lone bag square in EXTRAS has no swap partner. |
| Delete a photo | Square sheet, **×** on a library photo, confirm | Removed from the library and from every square on every board. |
| Cycle shoes | **SHOES n/3** in the viewer (3×3 boards only) | Changes which EXTRAS shoe the viewer shows. Saved per board. |
| Close sheet | **CANCEL**, select outside it, or Escape | |

### Image handling

| Rule | Value |
|---|---|
| Accepted types | `image/png`, `image/jpeg`, `image/webp` |
| Max file size | 15 MB. Larger files are rejected with `<name>: over 15 MB`. |
| Wrong type | Rejected with `<name>: use PNG, JPG or WebP`. |
| Resize | Longest edge scaled down to 1200 px. Smaller images are not enlarged. |
| Rotation | Phone photo orientation (EXIF) is applied. |
| Stored format | WebP at quality 0.85, transparency kept. Browsers that cannot encode WebP store PNG instead. |

Rejections appear in the red notice under the header. Other files in the same batch still import.

### Data model (`src/model.ts`)

```ts
type Kind = 'top' | 'bottom' | 'layer' | 'shoes' | 'bag' | 'accessory' | 'outerwear'
type ExtraKind = 'shoe' | 'bag'

interface ImageAsset { id: string; blob: Blob; name: string; source: 'upload' | 'generated'; createdAt: number }
interface Slot  { category: Kind;  imageId: string | null }
interface Extra { kind: ExtraKind; imageId: string | null }

interface Board {
  id: string
  name: string
  size: number      // 3..7
  grid: Slot[]      // length size*size, reading order
  extras: Extra[]   // see Sizes and kinds
  shoeIdx: number   // which EXTRAS shoe the viewer shows
  createdAt: number
  updatedAt: number
}
```

Boards saved before sizes existed have no `size`. They are read as 3×3: the database upgrades them in place (schema version 2), and old backup files import the same way.

`source: 'generated'` is reserved for a future AI image feature. Nothing writes it today.

| Export | Signature | Does |
|---|---|---|
| `SIZES` | `readonly number[]` | `[3, 4, 5, 6, 7]`. Functions below throw `RangeError` for any other size. |
| `KINDS` | `readonly Kind[]` | All 7 kinds in order. |
| `kindsFor` | `(size) => readonly Kind[]` | The first `size` kinds. |
| `layoutFor` | `(size) => readonly Kind[]` | The fixed kind layout, `size*size` long. |
| `linesFor` | `(size) => Record<LineId, readonly number[]>` | Grid positions per rail: `R1..RN`, `C1..CN`, `D`. |
| `comboCount` | `(size) => number` | `size ** size`. |
| `isLatinSquare` | `(cats, size) => boolean` | True when every row and column has `size` distinct kinds. False on wrong length. |
| `slotsOf` | `(size, kind) => number[]` | Grid positions of a kind, in order. |
| `comboSlots` | `(size, n) => number[]` | Grid positions for outfit `n`, in kind order. Throws `RangeError` outside `1..comboCount(size)`. |
| `comboNumber` | `(size, slots) => number` | Inverse of `comboSlots`. Throws if a kind is missing. |
| `lineCombo` | `(size, line) => number` | Outfit number of a rail. Throws on a rail that does not exist at that size. |
| `canSwap` | `(size, a, b) => boolean` | True for two different grid positions of the same kind. |
| `extrasFor` | `(size) => Extra[]` | The empty EXTRAS strip for a size. |
| `newBoard` | `(name, size = 3, now?) => Board` | Empty board with a random id. |
| `normalizeBoard` | `(board) => Board` | Defaults a missing `size` to 3. Throws if the grid length is not `size*size`. |
| `fillEmpty` | `(board, imageIds) => { board, rest }` | Fills empty grid squares, then empty extras. Returns unused ids. Does not mutate. |
| `removeImage` | `(board, imageId) => Board` | Clears every square that uses the image. Does not mutate. |

### Storage

| Where | Key | Holds |
|---|---|---|
| IndexedDB database `sudoku-combiner` | table `boards` (key `id`, index `updatedAt`) | Boards |
| | table `images` (key `id`, index `createdAt`) | Image blobs and metadata |
| `localStorage` | `sudoku-combiner:board` | Id of the board you last had open |
| | `sudoku-combiner:lastExport` | Timestamp of your last export |

If the saved board id no longer exists, the oldest board opens. If no boards exist, "My first board" is created.

### Export file (`src/transfer.ts`)

Filename: `sudoku-combiner-YYYY-MM-DD.json`.

```json
{
  "version": 1,
  "exportedAt": 1789948000000,
  "boards": [ { "id": "…", "name": "Lisbon Weekend", "size": 3, "grid": [], "extras": [], "shoeIdx": 0, "createdAt": 0, "updatedAt": 0 } ],
  "images": [ { "id": "…", "name": "blazer.png", "source": "upload", "createdAt": 0, "type": "image/webp", "data": "<base64>" } ]
}
```

Import rules: an image whose `id` already exists is skipped. A board whose `id` already exists is imported under a new id as `<name> (imported)`. Nothing is overwritten. A board whose grid does not fit its size rejects the whole file with `Board "<name>" does not fit a NxN grid.` Boards and images are written in one transaction, so a failed import leaves nothing half-written.

### `netlify.toml`

| Setting | Value | Effect |
|---|---|---|
| `build.command` | `npm test && npm run build` | Tests gate every deploy. |
| `build.publish` | `dist` | Vite output folder. |
| `NODE_VERSION` | `22` | Build runtime. |
| redirect `/*` to `/index.html`, 200 | | Any path serves the app. |
| `/assets/*` | `Cache-Control: public, max-age=31536000, immutable` | Hashed files cache for a year. `index.html` is not cached this way, so new deploys show up at once. |
| `/*` | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` | Basic hardening. |

## Why it works this way

### Category positions are fixed

The method needs a latin square: each kind exactly once in every row and every column. That is what makes every row and column a wearable outfit.

**The problem.** Letting you drag any square anywhere seems friendlier. But in a latin square of any size, swapping any two squares of different kinds always breaks it. Swap a top and a bottom in the same row, and both of their columns now hold a duplicate. Swap across rows, and both rows and both columns break. There is no cross-category swap that survives. `src/model.test.ts` checks every such pair at every size.

**The approach.** Positions own their category. Photos move, tags do not. A swap is only offered between squares of the same category, so the board cannot reach a broken state, and there is no error state to design or explain. Invalid targets fade while you drag so the rule is visible without reading anything.

**Trade-off.** You cannot pick a different layout or rename the kinds. The app ships the 3×3 from the method article and extends it. Whole-row or whole-column swaps would preserve the square and are not built.

### Bigger grids add kinds, not just pieces

**The problem.** The article's larger version is 4 tops, 4 bottoms, 4 layers: 12 pieces. That is a 3-column list, not a square, so it has no column or diagonal outfits and a "4×4" label would be false.

**The approach.** An N×N latin square needs N kinds. Each size adds the next most useful kind, and shoes and bag move from the EXTRAS strip into the grid as soon as it can hold them. Every rail stays a complete outfit.

**Trade-offs.** Photo count grows as N² (49 at 7×7). Outfit count grows as N^N, so past 3×3 nobody browses them all: the view pages 60 at a time and offers a random jump. A 7×7 on a phone has squares about 41px wide, below the usual 44px touch target.

**Why even sizes have their own layouts.** The shift-right pattern gives a complete-outfit diagonal only when N is odd. For 4 and 6 the app uses hand-picked squares that do have one, and the tests verify them.

### Only one diagonal

In the 3×3, the bottom-left to top-right diagonal holds a bottom, a top, and a layer. The other diagonal holds three tops. So there is one **D** rail, and it points up and to the right.

### Extras stay outside the outfit number

On a 3×3, shoes would multiply outfits (3 pairs would make 81), but the method counts them as styling on top of an outfit, not as part of the grid. Keeping them as display-only extras keeps outfit numbers stable: outfit 14 is the same three garments whatever shoes are showing.

### Local-only storage

**The problem.** Sync across devices needs accounts, a server, and image hosting. That is a different, much larger project, and it puts photos of your wardrobe on someone's server.

**The approach.** IndexedDB holds everything, and a single JSON file carries it between devices.

**Trade-offs.** Your phone and laptop do not share boards automatically. Clearing site data deletes everything. iOS Safari may evict data from sites you have not visited in about a week unless installed to the home screen. The app requests persistent storage and shows your last backup date to soften this, but the backup file is the real safety net.

### Images are re-encoded on the way in

A phone photo is often 4 to 12 MB. Thirteen of them would make a backup file over 100 MB and slow the grid. Scaling to 1200 px and encoding as WebP cuts that to a fraction of the size while keeping transparency, which matters for cut-out garment PNGs. The original file is not kept.

### Import never overwrites

Images are treated as immutable: same id means same bytes, so skipping is safe. Boards do change, and two devices can edit the same board differently. Picking a winner by timestamp would silently discard one side's edits, so the import keeps both and lets you delete one.

## Development

```bash
npm run dev      # dev server with hot reload
npm test         # 50 unit tests: every size's layout, lines, numbering; board ops; export/import
npm run lint     # oxlint
npm run build    # type-check, then static build into dist/
npm run preview  # serve dist/ locally
```

| File | Role |
|---|---|
| `src/model.ts` | Pure rules: layout, lines, numbering, board operations. No browser APIs. |
| `src/transfer.ts` | Pure export/import: serialize, parse, merge plan. |
| `src/db.ts` | Dexie database, image ingest, export/import wiring, `useImageUrl` hook. |
| `src/App.tsx` | All UI components and drag-and-drop. |
| `src/index.css` | Styles, including the under-1024px layout. |
| `src/model.test.ts` | Tests for `model.ts` and `transfer.ts`. |

Stack: Vite 8, React 19, TypeScript 6, Dexie 4 (IndexedDB), `@dnd-kit/core` 6 (drag and drop), Vitest 5.
