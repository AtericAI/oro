import React, { useState, useEffect, useCallback } from 'react'
import { useSSE } from './hooks/useSSE'
import { useLogs } from './hooks/useLogs'
import { useLogContent } from './hooks/useLogContent'
import Sidebar from './components/Sidebar'
import CenterPanel from './components/CenterPanel'
import LogViewer from './components/LogViewer'

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const { state: runState, isRunning } = useSSE()
  const { dates, isLoading: logsLoading, refetch } = useLogs()
  const { content, html, isLoading: contentLoading } = useLogContent(selectedDate, selectedFile)

  // Auto-select latest date on load
  useEffect(() => {
    if (dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[0].date)
    }
  }, [dates, selectedDate])

  // Refetch logs when run transitions from running to idle
  const prevRunning = React.useRef(isRunning)
  useEffect(() => {
    if (prevRunning.current && !isRunning) {
      refetch()
    }
    prevRunning.current = isRunning
  }, [isRunning, refetch])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedFile(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date)
    setSelectedFile(null)
  }, [])

  const handleSelectFile = useCallback((file: string) => {
    setSelectedFile(file)
  }, [])

  const handleRunNow = useCallback(async () => {
    try {
      await fetch('/api/run', { method: 'POST' })
      setTimeout(refetch, 2000)
    } catch {
      // ignore
    }
  }, [refetch])

  const handleCloseViewer = useCallback(() => {
    setSelectedFile(null)
  }, [])

  // Find the selected LogDate object
  const selectedLogDate = dates.find(d => d.date === selectedDate) || null

  return (
    <div className="app">
      <Sidebar
        dates={dates}
        selectedDate={selectedDate}
        isLoading={logsLoading}
        runState={runState}
        onSelectDate={handleSelectDate}
      />
      <CenterPanel
        selectedDate={selectedLogDate}
        runState={runState}
        isRunning={isRunning}
        onSelectFile={handleSelectFile}
        onRunNow={handleRunNow}
      />
      <LogViewer
        content={content}
        html={html}
        phase={selectedFile || ''}
        date={selectedDate || ''}
        isLoading={contentLoading}
        onClose={handleCloseViewer}
      />
    </div>
  )
}
