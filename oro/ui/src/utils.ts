const PHASE_MAP: Record<string, string> = {
  '00-scan.md': 'Scan',
  '01-analysis.md': 'Analysis',
  '02-plan.md': 'Plan',
  '03-orchestration.md': 'Orchestration',
  '05-wiki-update.md': 'Wiki Update',
  '06-pr.md': 'Pull Request',
}

export function getPhaseLabel(filename: string): string {
  if (PHASE_MAP[filename]) return PHASE_MAP[filename]
  const execMatch = filename.match(/^04-execution-(\d+)\.md$/)
  if (execMatch) return `Executor ${execMatch[1]}`
  const taskMatch = filename.match(/^executor_(\d+)_task\.md$/)
  if (taskMatch) return `Task ${taskMatch[1]}`
  return filename.replace('.md', '')
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getStateLabel(state: string): { label: string; color: string; pulsing: boolean } {
  const running = !['IDLE', 'FAILED', 'UNKNOWN'].includes(state) && !state.endsWith('_DONE')

  const labels: Record<string, string> = {
    IDLE: 'idle',
    SCANNING: 'scanning\u2026',
    SCANNING_DONE: 'idle',
    ANALYZING: 'analyzing\u2026',
    ANALYZING_DONE: 'idle',
    ORCHESTRATING: 'orchestrating\u2026',
    ORCHESTRATING_DONE: 'idle',
    EXECUTING: 'executing\u2026',
    EXECUTING_DONE: 'idle',
    UPDATING_WIKI: 'updating wiki\u2026',
    UPDATING_WIKI_DONE: 'idle',
    PUSHING_PR: 'pushing PR\u2026',
    FAILED: 'failed',
    UNKNOWN: 'idle',
  }

  let color = 'var(--status-idle)'
  if (running) color = 'var(--status-running)'
  else if (state === 'FAILED') color = 'var(--status-failed)'
  else if (state.endsWith('_DONE')) color = 'var(--status-success)'

  return {
    label: labels[state] || state.toLowerCase(),
    color,
    pulsing: running,
  }
}
