import fs from 'fs'
import path from 'path'
import net from 'net'
import { spawn, execSync } from 'child_process'
import { getOroDir, getProjectRoot, getPackageRoot, getServerPidPath } from '../utils/paths.js'
import { info, success, warn, error } from '../utils/output.js'

function isPortOpen(port: number, host = 'localhost'): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket()
    socket.setTimeout(1000)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => {
      resolve(false)
    })
    socket.connect(port, host)
  })
}

function openBrowser(url: string): void {
  try {
    const platform = process.platform
    if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' })
    } else if (platform === 'linux') {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' })
    } else if (platform === 'win32') {
      execSync(`start "${url}"`, { stdio: 'ignore' })
    }
  } catch {
    info(`Open in browser: ${url}`)
  }
}

export async function uiCmd(): Promise<void> {
  const oroDir = getOroDir()
  if (!fs.existsSync(oroDir)) {
    error('oro is not initialized. Run `oro init` first.')
    process.exit(1)
  }

  // Read port from config
  let port = 7070
  const configPath = path.join(oroDir, 'config.json')
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      port = config.ui?.port || 7070
    } catch {
      // use default
    }
  }

  const url = `http://localhost:${port}`

  // Check if server already running
  const running = await isPortOpen(port)
  if (running) {
    success(`UI already running at ${url}`)
    openBrowser(url)
    return
  }

  // Start the server
  const serverScript = path.join(getPackageRoot(), 'dist', 'server', 'index.js')
  if (!fs.existsSync(serverScript)) {
    error('Server not built. Run `npm run build` from the oro install directory first.')
    process.exit(1)
  }

  info('Starting UI server...')

  const child = spawn('node', [serverScript], {
    cwd: getProjectRoot(),
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ORO_PORT: String(port) },
  })
  child.unref()

  if (child.pid) {
    const pidPath = getServerPidPath()
    const pidDir = path.dirname(pidPath)
    if (!fs.existsSync(pidDir)) {
      fs.mkdirSync(pidDir, { recursive: true })
    }
    fs.writeFileSync(pidPath, String(child.pid))
  }

  // Wait briefly for server to start
  await new Promise(resolve => setTimeout(resolve, 1500))

  const nowRunning = await isPortOpen(port)
  if (nowRunning) {
    success(`UI server started at ${url}`)
    openBrowser(url)
  } else {
    warn(`Server may still be starting — check ${url} in a moment`)
  }
}
