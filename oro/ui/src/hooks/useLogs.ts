import { useState, useEffect, useCallback } from 'react'
import type { LogDate } from '../types'

interface UseLogsResult {
  dates: LogDate[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useLogs(): UseLogsResult {
  const [dates, setDates] = useState<LogDate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/logs')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setDates(data.dates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return { dates, isLoading, error, refetch: fetchLogs }
}
