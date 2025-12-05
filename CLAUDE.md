# Claude Development Guide

This file is the minimal "state" needed to hydrate full project context. Read the code to derive everything else.

## Principles

**Gall's Law**: "A complex system that works is invariably found to have evolved from a simple system that worked."

- Small, atomic commits that leave the system working
- Extend incrementally; resist over-engineering
- Simple first, then make extensible

**Single source of truth**: `EngineState` in `engine.ts` drives both UI and WebAudio graph. State changes trigger idempotent rebuilds.

**Registry pattern**: `STAGE_REGISTRY` in `stages.ts` defines all stage types. Adding a new effect = adding one registry entry.

## Gotchas

- When rebuilding the audio graph, only disconnect `output` nodes - disconnecting `input` breaks internal stage wiring (learned the hard way with the delay effect)
- Mono signals need `channelInterpretation='speakers'` to upmix to stereo for metering

## Debugging

`window.engine` in console, or click "Debug" button (bottom-right).
