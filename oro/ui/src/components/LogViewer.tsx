import React, { useRef, useEffect } from 'react'
import { getPhaseLabel } from '../utils'

interface LogViewerProps {
  content: string
  html: string
  phase: string
  date: string
  isLoading: boolean
  onClose: () => void
}

export default function LogViewer({ content, html, phase, date, isLoading, onClose }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [phase, date])

  const phaseLabel = phase ? getPhaseLabel(phase) : ''

  const handleDownload = () => {
    if (!content) return
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = phase || 'document.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="right">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <button className="topbar-btn" title="Back" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a9a9a9" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span>{phaseLabel || 'Document'}</span>
        </div>
        <div className="topbar-right">
          <button className="topbar-btn" title="Download" onClick={handleDownload}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a9a9a9" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 10l5 5 5-5M5 20h14" />
            </svg>
          </button>
          <button className="topbar-btn" title="Close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a9a9a9" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Document content */}
      {isLoading ? (
        <div className="doc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="pulse" style={{ color: 'var(--muted-2)' }}>Loading\u2026</span>
        </div>
      ) : html ? (
        <div
          ref={scrollRef}
          className="doc log-content fade-in"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="doc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-2)' }}>
          Select an item to view
        </div>
      )}
    </section>
  )
}
