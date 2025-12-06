import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import devtools from 'solid-devtools/vite'
import { execSync } from 'child_process'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

// Get macOS local hostname for .local mDNS access
const getLocalHostname = () => {
  try {
    return execSync('scutil --get LocalHostName', { encoding: 'utf-8' })
      .trim()
      .toLowerCase()
  } catch {
    return 'localhost'
  }
}

const localHost = `${getLocalHostname()}.local`
console.log('Vite allowing host:', localHost)

// Plugin to copy WASM files to dist
function copyWasmPlugin() {
  return {
    name: 'copy-wasm',
    writeBundle() {
      const wasmSources = [
        {
          src: 'audio-worklets/wasm-gain/pkg/wasm_gain_bg.wasm',
          dest: 'dist/audio-worklets/wasm-gain/pkg/wasm_gain_bg.wasm',
        },
        {
          src: 'audio-worklets/wasm-gain/pkg/wasm_gain.js',
          dest: 'dist/audio-worklets/wasm-gain/pkg/wasm_gain.js',
        },
        {
          src: 'audio-worklets/uiua-gain/pkg/uiua_gain_bg.wasm',
          dest: 'dist/audio-worklets/uiua-gain/pkg/uiua_gain_bg.wasm',
        },
        {
          src: 'audio-worklets/uiua-gain/pkg/uiua_gain.js',
          dest: 'dist/audio-worklets/uiua-gain/pkg/uiua_gain.js',
        },
        {
          src: 'audio-worklets/uiua-worklet/pkg/uiua_worklet_bg.wasm',
          dest: 'dist/audio-worklets/uiua-worklet/pkg/uiua_worklet_bg.wasm',
        },
        {
          src: 'audio-worklets/uiua-worklet/pkg/uiua_worklet.js',
          dest: 'dist/audio-worklets/uiua-worklet/pkg/uiua_worklet.js',
        },
      ]

      for (const { src, dest } of wasmSources) {
        const srcPath = resolve(src)
        const destPath = resolve(dest)

        if (existsSync(srcPath)) {
          mkdirSync(resolve(destPath, '..'), { recursive: true })
          copyFileSync(srcPath, destPath)
          console.log(`✓ Copied ${src} to ${dest}`)
        } else {
          console.warn(`⚠ WASM file not found: ${src}`)
        }
      }
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: true, // Listen on all addresses including LAN
    allowedHosts: [localHost, '.local'], // Allow .local pattern
  },
  plugins: [
    devtools({
      /* features options - all disabled by default */
      autoname: true, // e.g. enable autoname
    }),
    solid(),
    tailwindcss(),
    copyWasmPlugin(),
  ],
})
