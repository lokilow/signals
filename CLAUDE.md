# Claude Development Guide

Read this file at the start of every conversation. See README.md for project overview.

## Core Principle: Gall's Law

"A complex system that works is invariably found to have evolved from a simple system that worked."

- Start simple, extend incrementally
- Each commit should be small, atomic, and leave the system working
- Add complexity only when the simple solution no longer works
- Resist over-engineering upfront

## Development Approach

1. **Progressive iteration** - Small, focused changes over big rewrites
2. **Single source of truth** - `EngineState` drives everything; UI is declarative
3. **Registry pattern** - New stage types are added to `STAGE_REGISTRY` in `stages.ts`
4. **Idempotent rebuilds** - State changes trigger full graph rebuild (simple to reason about)

## Key Patterns

### Adding a New Stage Type
Add one entry to `STAGE_REGISTRY` in `src/audio/stages.ts`. The UI automatically picks it up.

### State Updates
All state changes go through `engine.updateState()` which: mutates → emits to subscribers → rebuilds graph.

### Complex Stage Wiring
For stages with internal nodes (like delay), only disconnect `output` during rebuild - disconnecting `input` breaks internal wiring.

## Debugging

- **Debug panel**: Click "Debug" button (bottom-right corner)
- **Console**: `window.engine` exposes `getState()`, `getStereoLevels()`, `getDebugInfo()`
- **Chrome DevTools**: WebAudio inspector (More tools → WebAudio)

## Tech Debt / Known Issues

- Both Master and Output meters show same signal (post-chain, pre-masterGain)
- No state persistence (lost on reload)
