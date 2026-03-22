import React from 'react'
import RunStatus from './RunStatus'
import type { RunState } from '../types'

interface TopbarProps {
  runState: RunState
  isRunning: boolean
  onRunNow: () => void
  wikiOpen: boolean
  onToggleWiki: () => void
}

export default function Topbar({ runState, isRunning, onRunNow, wikiOpen, onToggleWiki }: TopbarProps) {
  return (
    <div style={{
      height: 'var(--topbar-height)',
      minHeight: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--panel)',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 18,
          color: 'var(--accent)',
          fontWeight: 300,
        }}>&#9675;</span>
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.5px',
        }}>oro</span>
      </div>

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <RunStatus state={runState} isRunning={isRunning} />

        <button
          onClick={onToggleWiki}
          style={{
            background: wikiOpen ? 'var(--accent-dim)' : 'transparent',
            border: '1px solid var(--border)',
            color: wikiOpen ? 'var(--accent)' : 'var(--text-muted)',
            padding: '4px 10px',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'all 0.15s',
          }}
        >
          Wiki
        </button>

        <button
          onClick={onRunNow}
          disabled={isRunning}
          style={{
            background: isRunning ? 'var(--border)' : 'var(--accent)',
            color: isRunning ? 'var(--text-dim)' : '#0f0f0f',
            border: 'none',
            padding: '5px 14px',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            fontWeight: 600,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'all 0.15s',
          }}
        >
          {isRunning ? 'Running\u2026' : 'Run Now'}
        </button>
      </div>
    </div>
  )
}
