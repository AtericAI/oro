import fs from 'fs'
import path from 'path'
import { getOroDir } from '../utils/paths.js'
import { info, error, heading } from '../utils/output.js'

const PHASE_LABELS: Record<string, string> = {
  '00-scan.md': 'Scan',
  '01-analysis.md': 'Analysis',
  '02-plan.md': 'Plan',
  '03-orchestration.md': 'Orchestration',
  '05-wiki-update.md': 'Wiki Update',
  '06-pr.md': 'Pull Request',
}

function getPhaseLabel(filename: string): string {
  if (PHASE_LABELS[filename]) return PHASE_LABELS[filename]
  const execMatch = filename.match(/^04-execution-(\d+)\.md$/)
  if (execMatch) return `Executor ${execMatch[1]}`
  const taskMatch = filename.match(/^executor_(\d+)_task\.md$/)
  if (taskMatch) return `Task ${taskMatch[1]} (instructions)`
  return filename.replace('.md', '')
}

function renderMarkdown(content: string): string {
  // Basic ANSI markdown rendering for terminal
  return content
    .replace(/^# (.+)$/gm, '\x1b[1m\x1b[4m$1\x1b[0m')
    .replace(/^## (.+)$/gm, '\x1b[1m$1\x1b[0m')
    .replace(/^### (.+)$/gm, '\x1b[1m\x1b[2m$1\x1b[0m')
    .replace(/\*\*(.+?)\*\*/g, '\x1b[1m$1\x1b[0m')
    .replace(/`(.+?)`/g, '\x1b[36m$1\x1b[0m')
    .replace(/^- /gm, '  • ')
    .replace(/^\d+\. /gm, (match) => `  ${match}`)
}

export async function logsCmd(date?: string): Promise<void> {
  const oroDir = getOroDir()
  const logsDir = path.join(oroDir, 'logs')

  if (!fs.existsSync(logsDir)) {
    error('No logs found. Run `oro run` first.')
    process.exit(1)
  }

  // If no date, list all available dates
  if (!date) {
    heading('Available log dates')

    const dates = fs.readdirSync(logsDir)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse()

    if (dates.length === 0) {
      info('No logs yet.')
      return
    }

    for (const d of dates) {
      const dateDir = path.join(logsDir, d)
      const stateFile = path.join(dateDir, '.state')
      const state = fs.existsSync(stateFile)
        ? fs.readFileSync(stateFile, 'utf-8').trim()
        : ''
      const files = fs.readdirSync(dateDir)
        .filter(f => f.endsWith('.md') && !f.startsWith('.'))
      console.log(`  ${d}  ${state ? `[${state}]` : ''}  (${files.length} files)`)
    }

    console.log('')
    info('View logs for a date: oro logs <YYYY-MM-DD>')
    return
  }

  // Show files for a specific date
  const dateDir = path.join(logsDir, date)
  if (!fs.existsSync(dateDir)) {
    error(`No logs found for ${date}`)
    process.exit(1)
  }

  const files = fs.readdirSync(dateDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .sort()

  if (files.length === 0) {
    info(`No log files for ${date}`)
    return
  }

  heading(`Logs for ${date}`)

  for (const f of files) {
    const label = getPhaseLabel(f)
    const filePath = path.join(dateDir, f)
    const stat = fs.statSync(filePath)
    const size = stat.size > 1024
      ? `${Math.round(stat.size / 1024)}KB`
      : `${stat.size}B`
    console.log(`  ${label.padEnd(24)} ${f.padEnd(28)} ${size}`)
  }

  console.log('')

  // Show the most recent/important file content
  const priority = ['02-plan.md', '01-analysis.md', '00-scan.md']
  for (const pf of priority) {
    if (files.includes(pf)) {
      const content = fs.readFileSync(path.join(dateDir, pf), 'utf-8')
      console.log('')
      console.log(renderMarkdown(content))
      break
    }
  }
}
