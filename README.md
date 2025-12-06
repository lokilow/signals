# Signals

A WebAudio-based audio processing application built with SolidJS and TypeScript. Features a DAW-style horizontal signal chain with real-time visualization and stereo metering.

## Features

- **Modular Signal Chain** - Add, remove, and reorder audio processing stages
- **Built-in Effects** - Gain, Stereo Pan, Delay (with feedback)
- **Real-time Visualization** - Waveform and spectrum analyzers
- **Stereo Metering** - L/R level meters with peak hold and clipping indicators
- **Multiple Sources** - Oscillator (with waveform selection) or microphone input
- **Mobile-First Design** - Fully responsive, works on phones, tablets, and desktops

## Tech Stack

- SolidJS, TypeScript, WebAudio API, uPlot, Tailwind CSS, Vite

## Getting Started

```bash
bun install
bun run dev         # dev server (accessible on local network at http://mbp.local:5173)
bun run typecheck   # type check
bun run build       # production build
bun run preview     # preview production build
```

### Testing on Mobile Devices

The dev server is configured to be accessible from your local network:
- Start the dev server: `bun run dev`
- On your phone/tablet (same WiFi): visit `http://<your-hostname>.local:5173`
- Example: `http://my-macbook.local:5173`

## Deployment

Automatically deploys to GitHub Pages on push to `main`:
- **Production URL**: `https://<username>.github.io/signals/`
- Workflow: `.github/workflows/deploy.yml`
- Enable in repo settings: Settings → Pages → Source: "GitHub Actions"

## Development

See [CLAUDE.md](./CLAUDE.md) for development principles and gotchas.

### AudioWorklet Workflow

This project uses a robust automated pipeline to manage AudioWorklet processors and WASM modules, ensuring compatibility across development (Vite) and production (GitHub Pages).

- **Source Processors**: JavaScript processor files live in `src/audio/worklets/`.
- **WASM Projects**: Rust/Uiua projects live in `audio-worklets/<project-name>/`.
- **Automated Build**: The `scripts/build-wasm.sh` script is the single source of truth. It:
  1. Compiles all Rust projects in `audio-worklets/`.
  2. Copies generated `pkg/` folders to `public/audio-worklets/`.
  3. Copies all source JS processors to `public/audio-worklets/`.

The `public/audio-worklets/` directory is treated as a **build artifact** (gitignored) and is automatically populated when you run `bun run dev` or `bun run build`.

To add a new worklet:
1. Create your Rust project in `audio-worklets/my-new-worklet/`.
2. Create your JS processor in `src/audio/worklets/my-new-processor.js`.
3. Run `bun run dev` - the script will auto-detect and sync everything.

### Mobile Testing

AudioWorklet requires a **Secure Context** (HTTPS or localhost). 
- **Localhost**: Works fine on your computer.
- **Mobile Device**: Accessing via `http://<ip>:5173` will likely fail on Safari/iOS because it treats local IP addresses as insecure.
  - **Fix**: Use a tunneling service (like ngrok) or configure Vite with HTTPS/certs to test AudioWorklets on a physical mobile device.

## Future Ideas

- WASM AudioWorklet nodes (custom DSP in Rust/C++)
- More effects (filter, compressor, reverb)
- Preset save/load
- MIDI parameter control

## License

MIT
