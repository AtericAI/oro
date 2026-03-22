import React from 'react'
import type { LogDate, RunState } from '../types'
import { getPhaseLabel } from '../utils'

interface CenterPanelProps {
  selectedDate: LogDate | null
  runState: RunState
  isRunning: boolean
  onSelectFile: (file: string) => void
  onRunNow: () => void
}

const ListIcon = () => (
  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 3h8M4 8h8M4 13h8" />
    <circle cx="2.5" cy="3" r="1" /><circle cx="2.5" cy="8" r="1" /><circle cx="2.5" cy="13" r="1" />
  </svg>
)

const AgentIcon = () => (
  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.2" y="1.8" width="11.6" height="12.4" rx="2" />
    <circle cx="8" cy="5.2" r="1.8" />
    <path d="M4.8 12.1c.8-1.9 2-3 3.2-3s2.4 1.1 3.2 3" />
  </svg>
)

const SwarmIcon = () => (
  <svg className="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="5" r="2" />
    <circle cx="11.5" cy="4" r="1.7" />
    <circle cx="10.8" cy="10.8" r="1.9" />
    <path d="M6.7 6.2l2.8-1.1M6 6.8l3.5 2.7M11.2 5.7l-.2 3.2" />
  </svg>
)

const Chevron = () => (
  <svg className="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3l5 5-5 5" />
  </svg>
)

export default function CenterPanel({
  selectedDate,
  runState,
  isRunning,
  onSelectFile,
  onRunNow,
}: CenterPanelProps) {
  const files = selectedDate?.files || []

  // Categorize files into groups matching the mockup layout
  const scanFiles = files.filter(f => f === '00-scan.md')
  const planFiles = files.filter(f => f === '01-analysis.md' || f === '02-plan.md')
  const orchestrationFiles = files.filter(f => f === '03-orchestration.md')
  const executorTasks = files.filter(f => f.match(/^executor_\d+_task\.md$/))
  const executionReports = files.filter(f => f.match(/^04-execution-\d+\.md$/))
  const wikiUpdateFiles = files.filter(f => f === '05-wiki-update.md')
  const prFiles = files.filter(f => f === '06-pr.md')

  const isComplete = runState === 'IDLE' && files.length > 0 && prFiles.length > 0
  const hasContent = files.length > 0

  if (!hasContent && !isRunning) {
    return (
      <main className="center">
        <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
          <span style={{ fontSize: 32, opacity: 0.2, color: 'var(--muted)' }}>&#9675;</span>
          <span style={{ fontSize: 'var(--text-base)', color: 'var(--muted-2)' }}>
            Select a run from the sidebar
          </span>
          <button
            onClick={onRunNow}
            style={{
              marginTop: 8,
              background: 'var(--green)',
              color: '#0f0f0f',
              border: 'none',
              padding: '8px 20px',
              borderRadius: 8,
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Run Now
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="center">
      <div className="stack">

        {/* Scan card */}
        {scanFiles.length > 0 && (
          <div className="action-card">
            {scanFiles.map(f => (
              <div key={f} className="action-row" onClick={() => onSelectFile(f)}>
                <div className="left"><ListIcon /><span>Read Wiki</span></div>
                <Chevron />
              </div>
            ))}
          </div>
        )}

        {/* Analysis + Plan + Orchestration + Executors card */}
        {(planFiles.length > 0 || orchestrationFiles.length > 0 || executorTasks.length > 0) && (
          <div className="action-card">
            {planFiles.map(f => (
              <div key={f} className="action-row" onClick={() => onSelectFile(f)}>
                <div className="left"><ListIcon /><span>{getPhaseLabel(f)}</span></div>
                <Chevron />
              </div>
            ))}
            {orchestrationFiles.map(f => (
              <div key={f} className="action-row" onClick={() => onSelectFile(f)}>
                <div className="left"><ListIcon /><span>{getPhaseLabel(f)}</span></div>
                <Chevron />
              </div>
            ))}
            {executorTasks.map(f => (
              <div key={f} className="action-row" onClick={() => onSelectFile(f)}>
                <div className="left"><AgentIcon /><span>Create Subagent</span></div>
                <Chevron />
              </div>
            ))}
          </div>
        )}

        {/* Executor swarm */}
        {executionReports.length > 0 && (
          <div className="swarm">
            <div className="swarm-title">
              <SwarmIcon />
              <span>Agent Swarm</span>
            </div>
            {executionReports.map(f => {
              const label = getPhaseLabel(f)
              return (
                <div key={f} className="subagent" onClick={() => onSelectFile(f)}>
                  <div className="name">{label}</div>
                  <div className="prompt">&lsaquo; <span>{f}</span></div>
                </div>
              )
            })}
          </div>
        )}

        {/* Summary paragraph when running */}
        {isRunning && (
          <div className="paragraph pulse">
            Running agents\u2026 The system is currently processing.
          </div>
        )}

        {/* Wiki update */}
        {wikiUpdateFiles.length > 0 && (
          <div className="update" onClick={() => onSelectFile(wikiUpdateFiles[0])}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ListIcon />
              <span>Update Wiki</span>
            </div>
            <Chevron />
          </div>
        )}

        {/* PR status */}
        {prFiles.length > 0 && (
          <div className="status" onClick={() => onSelectFile(prFiles[0])} style={{ cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle className="status-circle" cx="12" cy="12" r="10" stroke="var(--green)" />
              <path className="status-check" d="M8 12.3l2.5 2.5L16.5 8.8" stroke="var(--green)" />
            </svg>
            <span>PR pushed</span>
          </div>
        )}

        {/* Complete status when idle with content but no PR */}
        {!isRunning && hasContent && prFiles.length === 0 && (
          <div className="status">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle className="status-circle" cx="12" cy="12" r="10" stroke="var(--green)" />
              <path className="status-check" d="M8 12.3l2.5 2.5L16.5 8.8" stroke="var(--green)" />
            </svg>
            <span>Complete</span>
          </div>
        )}

      </div>
    </main>
  )
}
