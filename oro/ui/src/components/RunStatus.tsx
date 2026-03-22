import React, { useState, useEffect, useRef } from 'react'
import type { RunState } from '../types'
import { getStateLabel } from '../utils'

interface RunStatusProps {
  state: RunState
  isRunning: boolean
}

export default function RunStatus({ state, isRunning }: RunStatusProps) {
  const [showPopover, setShowPopover] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])
  const popoverRef = useRef<HTMLDivElement>(null)

  const { label, color, pulsing } = getStateLabel(state)

  useEffect(() => {
    if (!showPopover) return
    const fetchLog = async () => {
      try {
        const res = await fetch('/api/latest-log')
        if (res.ok) {
          const data = await res.json()
          setLogLines(data.lines || [])
        }
      } catch { /* ignore */ }
    }
    fetchLog()
    const interval = setInterval(fetchLog, 3000)
    return () => clearInterval(interval)
  }, [showPopover])

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPopover])

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowPopover(!showPopover)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          padding: '4px 10px',
          borderRadius: 12,
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span
          className={pulsing ? 'pulse' : ''}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            display: 'inline-block',
          }}
        />
        {label}
      </button>

      {showPopover && (
        <div
          ref={popoverRef}
          className="fade-in"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 420,
            maxHeight: 320,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'auto',
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>
            Latest Log
          </div>
          <div style={{ padding: '8px 12px', fontSize: 11, lineHeight: 1.5 }}>
            {logLines.length === 0 ? (
              <span style={{ color: 'var(--text-dim)' }}>No log output yet</span>
            ) : (
              logLines.map((line, i) => (
                <div key={i} style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{line}</div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
