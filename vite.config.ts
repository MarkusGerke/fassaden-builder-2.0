import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin, type ViteDevServer } from 'vite'

const PUBLIC_MIME: Record<string, string> = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
}

/**
 * Mit `server.watch: null` cached Vite die Public-Datei-Liste beim Start.
 * Neue Dateien unter `public/` (z. B. Fonts) liefern dann fälschlich `index.html`.
 * Dieses Plugin liest vorhandene Public-Dateien immer frisch von Disk.
 */
function servePublicFromDisk(): Plugin {
  return {
    name: 'serve-public-from-disk',
    apply: 'serve',
    configureServer(server) {
      const publicDir = path.resolve(server.config.root, 'public')
      server.middlewares.use((req, res, next) => {
        try {
          const raw = (req.url ?? '').split('?')[0] ?? ''
          if (!raw || raw === '/' || raw.includes('\0') || raw.includes('..')) {
            next()
            return
          }
          const rel = decodeURIComponent(raw.replace(/^\//, ''))
          if (!rel || rel.startsWith('@') || rel.startsWith('src/') || rel.startsWith('node_modules/')) {
            next()
            return
          }
          const file = path.resolve(publicDir, rel)
          if (!file.startsWith(publicDir + path.sep) && file !== publicDir) {
            next()
            return
          }
          if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
            next()
            return
          }
          const ext = path.extname(file).toLowerCase()
          const type = PUBLIC_MIME[ext] ?? 'application/octet-stream'
          res.statusCode = 200
          res.setHeader('Content-Type', type)
          res.setHeader('Cache-Control', 'no-store')
          fs.createReadStream(file).pipe(res)
        } catch {
          next()
        }
      })
    },
  }
}

/**
 * Bei `server.watch: null` invalidiert Vite das Module-Graph nie bei Dateiänderungen.
 * Folge: Browser lädt stundenlang alten Code → Runtime-Crash / leere Szene, obwohl
 * die Dateien auf Disk schon korrekt sind. Dieses Plugin prüft bei jedem Request
 * die mtime und invalidiert betroffene Module (kein HMR, aber frischer Code nach F5).
 */
function freshSourceOnRequest(): Plugin {
  const mtimes = new Map<string, number>()

  async function invalidateIfStale(server: ViteDevServer, urlPath: string) {
    const clean = urlPath.split('?')[0] ?? ''
    if (!clean.startsWith('/src/') && clean !== '/index.html' && clean !== '/') return

    const rel = clean === '/' ? 'index.html' : clean.replace(/^\//, '')
    const file = path.resolve(server.config.root, rel)
    if (!file.startsWith(server.config.root) || !fs.existsSync(file)) return

    let mtime: number
    try {
      mtime = fs.statSync(file).mtimeMs
    } catch {
      return
    }

    const prev = mtimes.get(file)
    mtimes.set(file, mtime)
    if (prev === undefined || prev === mtime) return

    const mod = await server.moduleGraph.getModuleByUrl(clean)
    if (mod) {
      server.moduleGraph.invalidateModule(mod)
    }
    // Importer-Kette mitziehen (z. B. main.ts importiert registry.ts)
    for (const module of server.moduleGraph.idToModuleMap.values()) {
      if (module.file === file) {
        server.moduleGraph.invalidateModule(module)
      }
    }
  }

  return {
    name: 'fresh-source-on-request',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store')
        try {
          if (req.url) await invalidateIfStale(server, req.url)
        } catch {
          // Dev-Server darf wegen Cache-Invalidierung nicht abstürzen
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [servePublicFromDisk(), freshSourceOnRequest()],
  // IPv4, damit Browser/Cursor `http://127.0.0.1:5173` und `localhost` → 127.0.0.1
  // nicht mit ERR_CONNECTION_REFUSED scheitern (Vite-Default lauscht sonst oft nur auf [::1]).
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Desktop/iCloud „touch“t hunderte Dateien → Massen-page-reload +
    // „vite.config.ts changed, restarting server“ → Browser: HTML ohne JS /
    // ERR_CONNECTION_RESET. Watch aus = kein HMR; Code-Updates kommen nach F5
    // über fresh-source-on-request (mtime), ohne Server-Neustart-Stürme.
    watch: null,
  },
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three',
              test: /[\\/]node_modules[\\/]three[\\/]/,
            },
          ],
        },
      },
    },
  },
})
