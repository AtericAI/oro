import { useState, useEffect, useRef, useCallback } from 'react'
import type { RunState } from '../types'

interface SSEState {
  state: RunState
  isRunning: boolean
  lastEvent: object | null
}

export function useSSE(): SSEState {
  const [state, setState] = useState<RunState>('IDLE')
  const [lastEvent, setLastEvent] = useState<object | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
    }

    const es = new EventSource('/api/events')
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLastEvent(data)
        if (data.type === 'state' && data.state) {
          setState(data.state as RunState)
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      // Reconnect after 3s
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      reconnectRef.current = setTimeout(connect, 3000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (esRef.current) esRef.current.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  const isRunning = !['IDLE', 'FAILED', 'UNKNOWN'].includes(state) && !state.endsWith('_DONE')

  return { state, isRunning, lastEvent }
}
