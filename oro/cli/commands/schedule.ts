import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { getOroDir, getProjectRoot, getConfigPath } from '../utils/paths.js'
import { info, success, warn, error } from '../utils/output.js'

export async function scheduleCmd(options: { cron?: string; disable?: boolean; enable?: boolean }): Promise<void> {
  const oroDir = getOroDir()
  if (!fs.existsSync(oroDir)) {
    error('oro is not initialized. Run `oro init` first.')
    process.exit(1)
  }

  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) {
    error('config.json not found. Run `oro init` first.')
    process.exit(1)
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

  if (!config.schedule) {
    config.schedule = { cron: '0 0 * * *', enabled: false, timezone: 'UTC' }
  }

  // Update config based on options
  if (options.cron) {
    config.schedule.cron = options.cron
    config.schedule.enabled = true
    info(`Schedule set to: ${options.cron}`)
  }

  if (options.disable) {
    config.schedule.enabled = false
  }

  if (options.enable) {
    config.schedule.enabled = true
  }

  // Write updated config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')

  // Update system crontab
  const projectRoot = getProjectRoot()
  const cronMarker = '# oro-schedule'

  try {
    const existingCron = execSync('crontab -l 2>/dev/null || true', { encoding: 'utf-8' })

    // Remove existing oro lines
    const filteredLines = existingCron.split('\n')
      .filter(line => !line.includes(cronMarker) && !line.includes('oro run'))
      .join('\n')
      .trimEnd()

    if (config.schedule.enabled) {
      const cronLine = `${config.schedule.cron} cd ${projectRoot} && oro run >> ${path.join(oroDir, 'logs', 'cron.log')} 2>&1 ${cronMarker}`
      const newCron = filteredLines + '\n' + cronLine + '\n'
      execSync('crontab -', { input: newCron, encoding: 'utf-8' })
      success(`Cron schedule enabled: ${config.schedule.cron}`)
    } else {
      const newCron = filteredLines + '\n'
      execSync('crontab -', { input: newCron, encoding: 'utf-8' })
      success('Cron schedule disabled')
    }
  } catch {
    warn('Could not update system crontab — update manually')
  }

  // Show current state
  console.log('')
  console.log(`  Schedule: ${config.schedule.enabled ? 'enabled' : 'disabled'}`)
  console.log(`  Cron: ${config.schedule.cron}`)
  console.log(`  Timezone: ${config.schedule.timezone}`)
  console.log('')
}
