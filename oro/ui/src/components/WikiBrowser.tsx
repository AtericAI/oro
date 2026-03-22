import React, { useState, useEffect } from 'react'
import type { WikiIndex, WikiFile } from '../types'

interface WikiBrowserProps {
  onClose: () => void
  onFileSelect: (filename: string) => void
  selectedFile: string | null
}

export default function WikiBrowser({ onClose, onFileSelect, selectedFile }: WikiBrowserProps) {
  const [wiki, setWiki] = useState<WikiIndex | null>(null)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchWiki = async () => {
      try {
        const res = await fetch('/api/wiki')
        if (res.ok) {
          const data = await res.json()
          setWiki(data)
        }
      } catch { /* ignore */ }
      setIsLoading(false)
    }
    fetchWiki()
  }, [])

  const filteredFiles = wiki?.files?.filter(f =>
    f.path.toLowerCase().includes(search.toLowerCase()) ||
    f.summary.toLowerCase().includes(search.toLowerCase())
  ) || []

  const issueCategories = wiki?.quality_issue_categories || {}
  const sortedIssues = Object.entries(issueCategories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const langSummary = wiki?.languages
    ? Object.entries(wiki.languages).map(([l, c]) => `${c} ${l}`).join(', ')
    : ''

  return (
    <div style={{
      width: 'var(--wiki-width)',
      minWidth: 320,
      borderLeft: '1px solid var(--border)',
      background: 'var(--panel)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Wiki</span>
          {wiki && wiki.total_files > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>
              {wiki.total_files} files{langSummary ? ` \u00b7 ${langSummary}` : ''}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 16,
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          &#10005;
        </button>
      </div>

      {/* Quality issues table */}
      {sortedIssues.length > 0 && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            fontWeight: 600,
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Quality Issues
          </div>
          {sortedIssues.map(([issue, count]) => (
            <div
              key={issue}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 0',
                fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                {issue}
              </span>
              <span style={{ color: 'var(--text-dim)', fontWeight: 600, flexShrink: 0 }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '5px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading && (
          <div style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: 12 }}>
            Loading...
          </div>
        )}

        {!isLoading && filteredFiles.length === 0 && (
          <div style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: 12 }}>
            {wiki?.total_files === 0 ? 'No wiki entries yet. Run oro scan.' : 'No matches.'}
          </div>
        )}

        {filteredFiles.map((file) => {
          const wikiFilename = file.wiki.split('/').pop() || ''
          const isActive = selectedFile === wikiFilename
          return (
            <button
              key={file.path}
              onClick={() => onFileSelect(wikiFilename)}
              style={{
                width: '100%',
                display: 'block',
                padding: '6px 16px',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                border: 'none',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text)',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                textAlign: 'left',
              }}
            >
              <div style={{ marginBottom: 1 }}>{file.path}</div>
              <div style={{
                fontSize: 10,
                color: 'var(--text-dim)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {file.type} &middot; {file.lines}L &middot; {file.summary}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
