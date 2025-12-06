import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import devtools from 'solid-devtools/vite'
import { execSync } from 'child_process'

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
console.debug('Vite allowing host:', localHost)

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
  ],
})
