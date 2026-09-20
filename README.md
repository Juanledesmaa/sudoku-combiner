# Sudoku Combiner

Outfit planner for the sudoku packing method: 3 tops, 3 bottoms, 3 layers on a 3x3 latin square.
Every row, column and the bottom-left to top-right diagonal is an outfit; any top x bottom x layer gives 27.

- Images and boards live in this browser only (IndexedDB). Use BOARDS > EXPORT BACKUP to move them.
- Category positions are fixed. Drag swaps images between same-category squares (long-press on touch).

```bash
npm install
npm run dev     # local dev
npm test        # unit tests (layout, combos, export/import)
npm run build   # static site in dist/
```

## Deploy (Netlify)

`netlify.toml` holds all settings. In Netlify: Add new site > Import an existing project > pick this repo > Deploy.
Every push to `main` runs the tests, builds, and publishes `dist/`. A failing test blocks the deploy.
