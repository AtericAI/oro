export type RunState =
  | 'IDLE' | 'SCANNING' | 'SCANNING_DONE'
  | 'ANALYZING' | 'ANALYZING_DONE'
  | 'ORCHESTRATING' | 'ORCHESTRATING_DONE'
  | 'EXECUTING' | 'EXECUTING_DONE'
  | 'UPDATING_WIKI' | 'UPDATING_WIKI_DONE'
  | 'PUSHING_PR' | 'FAILED' | 'UNKNOWN'

export interface LogDate {
  date: string
  files: string[]
  state: RunState
}

export interface WikiIndex {
  generated_at: string | null
  total_files: number
  languages: Record<string, number>
  file_types: Record<string, number>
  quality_issue_categories: Record<string, number>
  files: WikiFile[]
}

export interface WikiFile {
  path: string
  wiki: string
  type: string
  language: string
  lines: number
  quality_issues: string[]
  summary: string
}
