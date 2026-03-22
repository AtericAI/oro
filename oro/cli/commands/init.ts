import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { getProjectRoot, getOroDir, getPackageRoot, getEnvPath } from '../utils/paths.js'
import { info, success, warn, error, logo } from '../utils/output.js'

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function promptYN(question: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? '[Y/n]' : '[y/N]'
  return prompt(`${question} ${suffix}: `).then(ans => {
    if (!ans) return defaultYes
    return ans.toLowerCase().startsWith('y')
  })
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function copyTemplateFile(srcRelative: string, destAbsolute: string): void {
  // Try package root first (when installed globally), then local oro/ dir
  const pkgRoot = getPackageRoot()
  const candidates = [
    path.join(pkgRoot, srcRelative),
    path.join(getProjectRoot(), srcRelative),
  ]

  for (const src of candidates) {
    if (fs.existsSync(src)) {
      const destDir = path.dirname(destAbsolute)
      ensureDir(destDir)
      fs.copyFileSync(src, destAbsolute)
      return
    }
  }

  // If the file is already at destination, skip
  if (fs.existsSync(destAbsolute)) return

  warn(`Template not found: ${srcRelative}`)
}

export async function initCmd(): Promise<void> {
  logo()
  const projectRoot = getProjectRoot()
  const oroDir = getOroDir()

  // Check if already initialized
  if (fs.existsSync(oroDir)) {
    const overwrite = await promptYN('oro/ directory already exists. Reinitialize?', false)
    if (!overwrite) {
      info('Aborted.')
      return
    }
  }

  info(`Initializing oro in ${projectRoot}`)

  // ── Create directory structure ──────────────────────────────────────────
  const dirs = [
    'oro/wiki/files',
    'oro/wiki/modules',
    'oro/logs',
    'oro/prompts',
    'oro/scripts',
    'oro/server',
  ]
  for (const d of dirs) {
    ensureDir(path.join(projectRoot, d))
  }
  success('Created directory structure')

  // ── Copy prompt files ──────────────────────────────────────────────────
  const promptFiles = [
    'scan_file.md',
    'update_wiki_index.md',
    'analyze.md',
    'orchestrate.md',
    'execute.md',
    'push_pr.md',
  ]
  for (const pf of promptFiles) {
    copyTemplateFile(`oro/prompts/${pf}`, path.join(oroDir, 'prompts', pf))
  }
  success(`Copied ${promptFiles.length} prompt files`)

  // ── Copy shell scripts ─────────────────────────────────────────────────
  const scriptFiles = [
    'run.sh',
    'scan.sh',
    'analyze.sh',
    'orchestrate.sh',
    'execute.sh',
    'update_wiki.sh',
    'push_pr.sh',
  ]
  for (const sf of scriptFiles) {
    const dest = path.join(oroDir, 'scripts', sf)
    copyTemplateFile(`oro/scripts/${sf}`, dest)
    if (fs.existsSync(dest)) {
      fs.chmodSync(dest, 0o755)
    }
  }
  success(`Copied ${scriptFiles.length} shell scripts`)

  // ── Copy opencode.json + AGENTS.md ─────────────────────────────────────
  copyTemplateFile('oro/opencode.json', path.join(oroDir, 'opencode.json'))
  copyTemplateFile('oro/AGENTS.md', path.join(oroDir, 'AGENTS.md'))
  success('Copied opencode.json and AGENTS.md')

  // ── Interactive prompts ────────────────────────────────────────────────
  console.log('')
  info('Configure oro (secrets are stored in .env.oro, never committed)')
  console.log('')

  let apiKey = ''
  while (!apiKey) {
    apiKey = await prompt('  Enter your OpenCode Go API key: ')
    if (!apiKey) {
      warn('  API key is required. You can also press Ctrl+C to abort.')
    }
  }
  const ghToken = await prompt('  Enter your GitHub token (press Enter to skip): ')
  const enableSchedule = await promptYN('  Run daily at midnight?')
  const startUI = await promptYN('  Start UI server now?')

  // ── Write .env.oro ─────────────────────────────────────────────────────
  const envLines: string[] = [
    '# oro environment — DO NOT COMMIT',
    `ORO_OPENCODE_KEY=${apiKey}`,
  ]
  if (ghToken) {
    envLines.push(`ORO_GITHUB_TOKEN=${ghToken}`)
  }
  fs.writeFileSync(getEnvPath(), envLines.join('\n') + '\n', 'utf-8')
  success('Wrote .env.oro')

  // ── Write config.json ──────────────────────────────────────────────────
  const templatePath = path.join(oroDir, 'config.template.json')
  let config: Record<string, unknown>

  if (fs.existsSync(templatePath)) {
    config = JSON.parse(fs.readFileSync(templatePath, 'utf-8'))
  } else {
    config = {
      version: '1.0.0',
      opencode: { api_key: '$ORO_OPENCODE_KEY', plan: 'go' },
      github: {
        token: '$ORO_GITHUB_TOKEN',
        base_branch: 'main',
        pr_labels: ['automated', 'code-quality'],
        pr_draft: false,
      },
      scan: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cs', '.rb', '.php'],
        exclude_patterns: ['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '*.min.js'],
        max_file_size_kb: 500,
        incremental: true,
      },
      execution: {
        max_executors: 5,
        max_executor_loops: 5,
        run_tests: true,
        test_command: 'auto',
      },
      schedule: { cron: '0 0 * * *', enabled: enableSchedule, timezone: 'UTC' },
      ui: { port: 7070, host: 'localhost' },
    }
  }

  // Apply user choices
  if (typeof config.schedule === 'object' && config.schedule !== null) {
    (config.schedule as Record<string, unknown>).enabled = enableSchedule
  }

  const configPath = path.join(oroDir, 'config.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
  success('Wrote config.json')

  // ── Write placeholder wiki/README.md ───────────────────────────────────
  const wikiReadme = path.join(oroDir, 'wiki', 'README.md')
  if (!fs.existsSync(wikiReadme)) {
    fs.writeFileSync(wikiReadme, [
      '# Codebase Wiki',
      '',
      'Auto-generated by oro. Run `oro scan` to populate.',
      '',
      '## Navigation',
      '- [`files/`](files/) — Per-file documentation (0 files)',
      '',
    ].join('\n'), 'utf-8')
  }

  // ── Write placeholder wiki/index.json ──────────────────────────────────
  const indexJson = path.join(oroDir, 'wiki', 'index.json')
  if (!fs.existsSync(indexJson)) {
    fs.writeFileSync(indexJson, JSON.stringify({
      generated_at: new Date().toISOString(),
      total_files: 0,
      languages: {},
      file_types: {},
      quality_issue_categories: {},
      files: [],
    }, null, 2) + '\n', 'utf-8')
  }

  // ── Update .gitignore ──────────────────────────────────────────────────
  const gitignorePath = path.join(projectRoot, '.gitignore')
  const oroIgnoreBlock = [
    '',
    '# oro generated files',
    'oro/logs/',
    'oro/wiki/files/',
    'oro/wiki/index.json',
    'oro/server/static/',
    '.env.oro',
  ].join('\n')

  if (fs.existsSync(gitignorePath)) {
    const existing = fs.readFileSync(gitignorePath, 'utf-8')
    if (!existing.includes('oro/logs/')) {
      fs.appendFileSync(gitignorePath, oroIgnoreBlock + '\n')
      success('Updated .gitignore')
    }
  } else {
    fs.writeFileSync(gitignorePath, oroIgnoreBlock.trimStart() + '\n')
    success('Created .gitignore')
  }

  // ── Register cron ──────────────────────────────────────────────────────
  if (enableSchedule) {
    try {
      const { execSync } = await import('child_process')
      const cronLine = `0 0 * * * cd ${projectRoot} && oro run >> ${path.join(oroDir, 'logs', 'cron.log')} 2>&1`
      const existing = execSync('crontab -l 2>/dev/null || true', { encoding: 'utf-8' })
      if (!existing.includes('oro run')) {
        const newCron = existing.trimEnd() + '\n' + cronLine + '\n'
        execSync(`echo "${newCron.replace(/"/g, '\\"')}" | crontab -`, { encoding: 'utf-8' })
        success('Registered cron job (daily at midnight)')
      } else {
        info('Cron job already registered')
      }
    } catch {
      warn('Could not register cron job — set it up manually')
    }
  }

  // ── Start UI server ────────────────────────────────────────────────────
  if (startUI) {
    try {
      const { spawn } = await import('child_process')
      const serverScript = path.join(getPackageRoot(), 'dist', 'server', 'index.js')
      if (fs.existsSync(serverScript)) {
        const child = spawn('node', [serverScript], {
          cwd: projectRoot,
          detached: true,
          stdio: 'ignore',
        })
        child.unref()
        if (child.pid) {
          const pidPath = path.join(oroDir, 'logs', '.server.pid')
          ensureDir(path.dirname(pidPath))
          fs.writeFileSync(pidPath, String(child.pid))
          success(`UI server started on http://localhost:7070 (PID: ${child.pid})`)
        }
      } else {
        warn('Server not built yet — run `npm run build` first, then `oro ui`')
      }
    } catch {
      warn('Could not start UI server')
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('')
  success('oro initialized successfully!')
  console.log('')
  console.log('  Quick start:')
  console.log('    oro run          # Run a full quality cycle')
  console.log('    oro scan         # Scan codebase into wiki')
  console.log('    oro status       # Check run status')
  console.log('    oro ui           # Open dashboard')
  console.log('')
}
