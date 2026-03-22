#!/usr/bin/env node
import { program } from 'commander'
import path from 'path'
import fs from 'fs'
import { runCmd } from './commands/run.js'
import { scanCmd } from './commands/scan.js'
import { statusCmd } from './commands/status.js'
import { logsCmd } from './commands/logs.js'
import { uiCmd } from './commands/ui.js'
import { scheduleCmd } from './commands/schedule.js'
import { configCmd } from './commands/config.js'
import { initCmd } from './commands/init.js'

const pkgPath = path.resolve(__dirname, '..', '..', 'package.json')
const VERSION = fs.existsSync(pkgPath)
  ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version
  : '0.1.0'

program
  .name('oro')
  .description('Code quality engineer AI agent')
  .version(VERSION)

program.command('run')
  .description('Run a full oro quality cycle')
  .option('--force', 'Force re-scan even if wiki is fresh')
  .option('--no-pr', 'Skip PR push')
  .option('--phase <phase>', 'Start from specific phase')
  .action(runCmd)

program.command('scan')
  .description('Run only the wiki scan phase')
  .option('--force', 'Force re-scan all files')
  .action(scanCmd)

program.command('status')
  .description('Show status of current/last run')
  .action(statusCmd)

program.command('logs')
  .description('View run logs')
  .argument('[date]', 'Date to view logs for (YYYY-MM-DD)')
  .action(logsCmd)

program.command('ui')
  .description('Open the UI')
  .action(uiCmd)

program.command('schedule')
  .description('Manage the run schedule')
  .option('--cron <expression>', 'Set cron expression')
  .option('--disable', 'Disable scheduling')
  .option('--enable', 'Enable scheduling')
  .action(scheduleCmd)

program.command('config')
  .description('View oro configuration')
  .action(configCmd)

program.command('init')
  .description('Initialize oro in current directory')
  .action(initCmd)

program.parseAsync()
