import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { getOroDir, getProjectRoot } from '../utils/paths.js'
import { loadEnv } from '../utils/env.js'
import { info, error } from '../utils/output.js'

export async function scanCmd(options: { force?: boolean }): Promise<void> {
  const oroDir = getOroDir()
  if (!fs.existsSync(oroDir)) {
    error('oro is not initialized. Run `oro init` first.')
    process.exit(1)
  }

  loadEnv()
  info('Starting wiki scan...')

  const scriptPath = path.join(oroDir, 'scripts', 'scan.sh')
  if (!fs.existsSync(scriptPath)) {
    error('scan.sh not found. Re-run `oro init`.')
    process.exit(1)
  }

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
    if (code !== 0) {
      error(`Scan failed with exit code ${code}`)
      process.exit(code || 1)
    }
  })

  child.on('error', (err) => {
    error(`Failed to start scan: ${err.message}`)
    process.exit(1)
  })
}
