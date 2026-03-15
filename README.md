# MapHack

This repository is the current development line of MapHack, restructured based on insights from earlier releases and iterations.

At the current commit, Phase 1 focuses on establishing a clear and maintainable
architecture before scaling functionality.

## Design Focus

- Separation of features and use cases
- Clear responsibility boundaries between modules
- Explicit dependency direction
- Structure designed with change in mind

## Tech / Environment

- TypeScript
- React (panel UI)
- Chrome Extension Manifest V3
- Content Scripts (MAIN/ISOLATED split)
- Background Service Worker
- Shadow DOM
- Build tooling: esbuild

## Data Handling

- Message content is processed in memory only (no persistence)
- Bookmarks are stored locally in IndexedDB
- No external transmission (no server/API calls)

## Status

- Working slice implemented: Base + Bookmark on ChatGPT
- Work in progress (active development)
- Current priority: structural boundary refinement
