import { useState, useEffect } from 'react'

interface UseLogContentResult {
  content: string
  html: string
  isLoading: boolean
  error: string | null
}

export function useLogContent(date: string | null, file: string | null): UseLogContentResult {
  const [content, setContent] = useState('')
  const [html, setHtml] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!date || !file) {
      setContent('')
      setHtml('')
      return
    }

    let cancelled = false

    const fetchContent = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/logs/${date}/${file}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setContent(data.content || '')
          setHtml(data.html || '')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch content')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchContent()
    return () => { cancelled = true }
  }, [date, file])

  return { content, html, isLoading, error }
}
