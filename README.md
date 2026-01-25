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
- Shadow DOM (UI isolation, planned)
- Build tooling (planned: Vite)

## Data Handling

- Message content is processed in memory only (no persistence)
- Message previews and user data (Bookmark/Tag/Memo) are stored locally in IndexedDB
- No external transmission (no server/API calls)

## Status

- Early development stage
- Work in progress (active development)
- Core structure and data flow are being defined
