import path from 'path'
import fs from 'fs'

export function getProjectRoot(): string {
  return process.cwd()
}

export function getOroDir(): string {
  return path.join(getProjectRoot(), 'oro')
}

export function getPackageRoot(): string {
  // From dist/cli/ -> root
  return path.resolve(__dirname, '..', '..')
}

export function getTodayDate(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getLogDir(date?: string): string {
  const d = date || getTodayDate()
  return path.join(getOroDir(), 'logs', d)
}

export function getConfigPath(): string {
  return path.join(getOroDir(), 'config.json')
}

export function getEnvPath(): string {
  return path.join(getProjectRoot(), '.env.oro')
}

export function getLockPath(): string {
  return path.join(getOroDir(), 'logs', '.lock')
}

export function getStatePath(): string {
  return path.join(getOroDir(), 'logs', '.current_state')
}

export function getServerPidPath(): string {
  return path.join(getOroDir(), 'logs', '.server.pid')
}

export function oroExists(): boolean {
  return fs.existsSync(getOroDir())
}
