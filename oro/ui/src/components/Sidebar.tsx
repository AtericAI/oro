import React from 'react'
import type { LogDate, RunState } from '../types'

interface SidebarProps {
  dates: LogDate[]
  selectedDate: string | null
  isLoading: boolean
  runState: RunState
  onSelectDate: (date: string) => void
  onDeleteDate?: (date: string) => void
}

export default function Sidebar({
  dates,
  selectedDate,
  isLoading,
  onSelectDate,
  onDeleteDate,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <img src="/logo.svg" alt="oro" className="logo" />
        <svg className="pane-icon" viewBox="0 0 24 24" fill="none" stroke="#9a9a9a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
          <line x1="10" y1="4.5" x2="10" y2="19.5" />
        </svg>
      </div>

      <div className="log-list">
        {isLoading && (
          <div style={{ padding: '8px 0', color: 'var(--muted-2)', fontSize: 'var(--text-sm)' }}>
            Loading\u2026
          </div>
        )}

        {!isLoading && dates.length === 0 && (
          <div style={{ padding: '8px 0', color: 'var(--muted-2)', fontSize: 'var(--text-sm)' }}>
            No runs yet
          </div>
        )}

        {dates.map(d => (
          <div
            key={d.date}
            className="chat-item"
            onClick={() => onSelectDate(d.date)}
            style={selectedDate === d.date ? { background: 'rgba(255,255,255,0.05)', color: 'var(--text-hi)' } : undefined}
          >
            <span className="chat-title">{d.date}</span>
            <div className="chat-actions">
              <svg className="chat-dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
              </svg>
              <div className="chat-dropdown-menu">
                <div className="menu-item">Share</div>
                <div className="menu-item">Rename</div>
                <div
                  className="menu-item danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteDate?.(d.date)
                  }}
                >
                  Delete
                </div>
              </div>
            </div>
          </div>
        ))}

        {dates.length > 0 && (
          <div className="chat-item all">
            <span className="chat-title">All Logs</span>
          </div>
        )}
      </div>
    </aside>
  )
}
