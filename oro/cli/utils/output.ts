const NO_COLOR = !!process.env.ORO_NO_COLOR

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

function c(color: keyof typeof colors, text: string): string {
  if (NO_COLOR) return text
  return `${colors[color]}${text}${colors.reset}`
}

export function info(msg: string): void {
  console.log(c('blue', '●') + ' ' + msg)
}

export function success(msg: string): void {
  console.log(c('green', '✓') + ' ' + msg)
}

export function warn(msg: string): void {
  console.log(c('yellow', '⚠') + ' ' + msg)
}

export function error(msg: string): void {
  console.error(c('red', '✗') + ' ' + msg)
}

export function heading(msg: string): void {
  console.log('')
  console.log(c('bold', msg))
  console.log(c('dim', '─'.repeat(Math.min(msg.length + 4, 60))))
}

export function table(rows: string[][], columnWidths?: number[]): void {
  if (rows.length === 0) return

  const widths = columnWidths || rows[0].map((_, i) =>
    Math.max(...rows.map(r => (r[i] || '').length))
  )

  for (const row of rows) {
    const line = row.map((cell, i) =>
      (cell || '').padEnd(widths[i] || 0)
    ).join('  ')
    console.log('  ' + line)
  }
}

export function logo(): void {
  console.log(c('bold', ''))
  console.log(c('bold', '  ┌─────────────────────────────────┐'))
  console.log(c('bold', '  │  ○  oro — code quality agent    │'))
  console.log(c('bold', '  └─────────────────────────────────┘'))
  console.log('')
}
