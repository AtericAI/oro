import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { getOroDir, getProjectRoot, getLockPath, getStatePath } from '../utils/paths.js'
import { loadEnv } from '../utils/env.js'
import { info, success, warn, error } from '../utils/output.js'

const STALE_LOCK_MS = 4 * 60 * 60 * 1000 // 4 hours

function checkLock(): boolean {
  const lockPath = getLockPath()
  if (!fs.existsSync(lockPath)) return false

  const lockContent = fs.readFileSync(lockPath, 'utf-8').trim()
  const lockTime = new Date(lockContent).getTime()

  if (isNaN(lockTime)) {
    warn('Invalid lock file — removing')
    fs.unlinkSync(lockPath)
    return false
  }

  const age = Date.now() - lockTime
  if (age > STALE_LOCK_MS) {
    warn(`Stale lock detected (${Math.round(age / 3600000)}h old) — removing`)
    fs.unlinkSync(lockPath)
    return false
  }

  return true
}

function writeLock(): void {
  const lockPath = getLockPath()
  const dir = path.dirname(lockPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(lockPath, new Date().toISOString())
}

function removeLock(): void {
  const lockPath = getLockPath()
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath)
  }
}

function setState(state: string): void {
  const statePath = getStatePath()
  const dir = path.dirname(statePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(statePath, state)
}

export async function runCmd(options: { force?: boolean; pr?: boolean; phase?: string }): Promise<void> {
  const oroDir = getOroDir()
  if (!fs.existsSync(oroDir)) {
    error('oro is not initialized. Run `oro init` first.')
    process.exit(1)
  }

  if (checkLock()) {
    error('Another oro run is in progress. Use `oro status` to check.')
    error('If the run is stuck, wait for the 4-hour timeout or delete oro/logs/.lock')
    process.exit(1)
  }

  loadEnv()
  writeLock()

  const scriptPath = path.join(oroDir, 'scripts', 'run.sh')
  if (!fs.existsSync(scriptPath)) {
    error('run.sh not found. Re-run `oro init`.')
    removeLock()
    process.exit(1)
  }

  info('Starting oro run...')

  const env: Record<string, string> = { ...process.env as Record<string, string> }
  if (options.force) {
    env.FORCE = 'true'
  }

  const child = spawn('bash', [scriptPath], {
    cwd: getProjectRoot(),
    stdio: 'inherit',
    env,
  })

  child.on('close', (code) => {
    removeLock()
    if (code === 0) {
      success('oro run complete.')
    } else {
      setState('FAILED')
      error(`oro run failed with exit code ${code}`)
      process.exit(code || 1)
    }
  })

  child.on('error', (err) => {
    removeLock()
    setState('FAILED')
    error(`Failed to start run: ${err.message}`)
    process.exit(1)
  })

  // Handle SIGINT/SIGTERM gracefully
  const cleanup = () => {
    removeLock()
    child.kill('SIGTERM')
    process.exit(130)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}
