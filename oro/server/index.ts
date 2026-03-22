import express from 'express'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { marked } from 'marked'
import type { RunState } from './types.js'

const app = express()
const PORT = parseInt(process.env.ORO_PORT || '7070', 10)

const ORO_DIR = path.join(process.cwd(), 'oro')
const LOGS_DIR = path.join(ORO_DIR, 'logs')
const WIKI_DIR = path.join(ORO_DIR, 'wiki')

// ── Path validation helpers ──────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SAFE_FILE_RE = /^[\w][\w.\-]*\.md$/

function safePath(base: string, ...segments: string[]): string | null {
  const resolved = path.resolve(base, ...segments)
  if (!resolved.startsWith(path.resolve(base))) return null
  return resolved
}

// ── SSE connections ──────────────────────────────────────────────────────────

const sseClients: Set<express.Response> = new Set()

function broadcast(data: object): void {
  const msg = `data: ${JSON.stringify(data)}\n\n`
  for (const client of sseClients) {
    try {
      client.write(msg)
    } catch {
      sseClients.delete(client)
    }
  }
}

// ── API Routes ───────────────────────────────────────────────────────────────

app.use(express.json())

// GET /api/logs — list all dates and their log files
app.get('/api/logs', (_req, res) => {
  if (!fs.existsSync(LOGS_DIR)) {
    return res.json({ dates: [] })
  }

  const dates = fs.readdirSync(LOGS_DIR)
    .filter(d => DATE_RE.test(d))
    .sort()
    .reverse()
    .map(date => {
      const dateDir = path.join(LOGS_DIR, date)
      const files = fs.readdirSync(dateDir)
        .filter(f => f.endsWith('.md') && !f.startsWith('.'))
        .sort()
      const stateFile = path.join(dateDir, '.state')
      const state: RunState = fs.existsSync(stateFile)
        ? fs.readFileSync(stateFile, 'utf-8').trim() as RunState
        : 'UNKNOWN'
      return { date, files, state }
    })

  res.json({ dates })
})

// GET /api/logs/:date/:file — get log file content (raw markdown + HTML)
app.get('/api/logs/:date/:file', (req, res) => {
  const { date, file } = req.params

  if (!DATE_RE.test(date) || !SAFE_FILE_RE.test(file)) {
    return res.status(400).json({ error: 'Invalid parameters' })
  }

  const filePath = safePath(LOGS_DIR, date, file)
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' })
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const html = marked(content) as string
  res.json({ content, html })
})

// GET /api/status — current run state
app.get('/api/status', (_req, res) => {
  const stateFile = path.join(LOGS_DIR, '.current_state')
  const state: RunState = fs.existsSync(stateFile)
    ? fs.readFileSync(stateFile, 'utf-8').trim() as RunState
    : 'IDLE'
  res.json({ state, timestamp: new Date().toISOString() })
})

// GET /api/wiki — wiki file listing
app.get('/api/wiki', (_req, res) => {
  const indexPath = path.join(WIKI_DIR, 'index.json')
  if (!fs.existsSync(indexPath)) {
    return res.json({ files: [], generated_at: null })
  }
  try {
    const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
    res.json(data)
  } catch {
    res.json({ files: [], generated_at: null })
  }
})

// GET /api/wiki/:filename — get wiki file content
app.get('/api/wiki/:filename', (req, res) => {
  const { filename } = req.params

  if (!SAFE_FILE_RE.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  const filePath = safePath(path.join(WIKI_DIR, 'files'), filename)
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' })
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const html = marked(content) as string
  res.json({ content, html })
})

// GET /api/events — SSE for live run tailing
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  // Send initial state
  const stateFile = path.join(LOGS_DIR, '.current_state')
  const currentState = fs.existsSync(stateFile)
    ? fs.readFileSync(stateFile, 'utf-8').trim()
    : 'IDLE'
  res.write(`data: ${JSON.stringify({ type: 'state', state: currentState })}\n\n`)

  sseClients.add(res)

  // Watch for state changes
  let watcher: fs.FSWatcher | null = null
  if (fs.existsSync(LOGS_DIR)) {
    try {
      watcher = fs.watch(LOGS_DIR, (event, filename) => {
        if (filename === 'latest.log' || filename === '.current_state') {
          const state = fs.existsSync(stateFile)
            ? fs.readFileSync(stateFile, 'utf-8').trim()
            : 'IDLE'
          res.write(`data: ${JSON.stringify({ type: 'state', state })}\n\n`)
        }
      })
    } catch {
      // directory may not exist yet
    }
  }

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`)
    } catch {
      clearInterval(heartbeat)
    }
  }, 30000)

  req.on('close', () => {
    sseClients.delete(res)
    clearInterval(heartbeat)
    if (watcher) watcher.close()
  })
})

// POST /api/run — trigger a run from the UI
app.post('/api/run', (_req, res) => {
  const lockPath = path.join(LOGS_DIR, '.lock')
  if (fs.existsSync(lockPath)) {
    const lockContent = fs.readFileSync(lockPath, 'utf-8').trim()
    const lockTime = new Date(lockContent).getTime()
    const age = Date.now() - lockTime
    if (!isNaN(lockTime) && age < 4 * 60 * 60 * 1000) {
      return res.status(409).json({ error: 'A run is already in progress', started: false })
    }
  }

  // Spawn the CLI run command (reuses lock/env logic)
  try {
    const cliPath = path.resolve(__dirname, '..', 'cli', 'index.js')
    const child = spawn('node', [cliPath, 'run'], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    res.json({ started: true, pid: child.pid })
  } catch (err) {
    res.status(500).json({ error: 'Failed to start run', started: false })
  }
})

// GET /api/latest-log — last 50 lines of latest.log
app.get('/api/latest-log', (_req, res) => {
  const logFile = path.join(LOGS_DIR, 'latest.log')
  if (!fs.existsSync(logFile)) {
    return res.json({ lines: [] })
  }
  const content = fs.readFileSync(logFile, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim()).slice(-50)
  res.json({ lines })
})

// ── Static files ─────────────────────────────────────────────────────────────

const staticDir = path.join(__dirname, 'static')
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir))
}

// SPA fallback
app.get('*', (_req, res) => {
  const indexFile = path.join(staticDir, 'index.html')
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile)
  } else {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><title>oro</title></head>
        <body style="background:#0f0f0f;color:#e8e8e8;font-family:monospace;padding:40px;">
          <h1>○ oro</h1>
          <p>UI not built yet. Run <code>npm run build:ui</code> from the oro install directory.</p>
          <p>API is available at <a href="/api/status" style="color:#b8f2a1">/api/status</a></p>
        </body>
      </html>
    `)
  }
})

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`oro UI running at http://localhost:${PORT}`)
})

export default app
