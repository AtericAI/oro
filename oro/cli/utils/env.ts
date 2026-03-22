import fs from 'fs'
import { getEnvPath } from './paths.js'

export function loadEnv(): void {
  const envPath = getEnvPath()
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

export function resolveConfigValue(val: string): string {
  if (typeof val === 'string' && val.startsWith('$')) {
    const envKey = val.slice(1)
    return process.env[envKey] || val
  }
  return val
}
