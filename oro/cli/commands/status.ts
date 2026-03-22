import fs from 'fs'
import path from 'path'
import { getOroDir, getStatePath, getTodayDate, getLogDir } from '../utils/paths.js'
import { info, success, warn, error, heading, table } from '../utils/output.js'

export async function statusCmd(): Promise<void> {
  const oroDir = getOroDir()
  if (!fs.existsSync(oroDir)) {
    error('oro is not initialized. Run `oro init` first.')
    process.exit(1)
  }

  heading('oro status')

  // Current state
  const statePath = getStatePath()
  const currentState = fs.existsSync(statePath)
    ? fs.readFileSync(statePath, 'utf-8').trim()
    : 'IDLE'

  const stateColors: Record<string, string> = {
    IDLE: '\x1b[2m',
    FAILED: '\x1b[31m',
  }
  const isRunning = !['IDLE', 'FAILED', 'UNKNOWN'].includes(currentState) &&
    !currentState.endsWith('_DONE')
  const stateColor = stateColors[currentState] || (isRunning ? '\x1b[33m' : '\x1b[32m')
  console.log(`  State: ${stateColor}${currentState}\x1b[0m${isRunning ? ' (running)' : ''}`)

  // Last run info
  const logsDir = path.join(oroDir, 'logs')
  if (!fs.existsSync(logsDir)) {
    info('No runs yet.')
    return
  }

  const dates = fs.readdirSync(logsDir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse()

  if (dates.length === 0) {
    info('No runs yet.')
    return
  }

  const lastDate = dates[0]
  const lastLogDir = path.join(logsDir, lastDate)
  const lastStatePath = path.join(lastLogDir, '.state')
  const lastState = fs.existsSync(lastStatePath)
    ? fs.readFileSync(lastStatePath, 'utf-8').trim()
    : 'UNKNOWN'

  console.log(`  Last run: ${lastDate} (${lastState})`)

  // Count execution results
  const execFiles = fs.readdirSync(lastLogDir)
    .filter(f => f.startsWith('04-execution-') && f.endsWith('.md'))

  if (execFiles.length > 0) {
    let succeeded = 0, partial = 0, failed = 0
    for (const ef of execFiles) {
      const content = fs.readFileSync(path.join(lastLogDir, ef), 'utf-8')
      const statusMatch = content.match(/\*\*Status:\*\*\s*(\w+)/)
      if (statusMatch) {
        switch (statusMatch[1]) {
          case 'SUCCESS': succeeded++; break
          case 'PARTIAL': partial++; break
          case 'FAILED': failed++; break
        }
      }
    }
    console.log(`  Tasks: ${succeeded} succeeded, ${partial} partial, ${failed} failed`)
  }

  // Log files available
  const logFiles = fs.readdirSync(lastLogDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .sort()

  if (logFiles.length > 0) {
    console.log(`  Log files: ${logFiles.join(', ')}`)
  }

  // Schedule info
  const configPath = path.join(oroDir, 'config.json')
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      const schedule = config.schedule || {}
      if (schedule.enabled) {
        console.log(`  Schedule: ${schedule.cron} (${schedule.timezone || 'UTC'})`)
      } else {
        console.log('  Schedule: disabled')
      }
    } catch {
      // skip
    }
  }

  console.log('')
}
