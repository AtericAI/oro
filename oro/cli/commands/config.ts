import fs from 'fs'
import { getConfigPath, getOroDir } from '../utils/paths.js'
import { error, heading } from '../utils/output.js'

export async function configCmd(): Promise<void> {
  const oroDir = getOroDir()
  if (!fs.existsSync(oroDir)) {
    error('oro is not initialized. Run `oro init` first.')
    process.exit(1)
  }

  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) {
    error('config.json not found. Run `oro init` first.')
    process.exit(1)
  }

  heading('oro configuration')
  console.log(`  Config file: ${configPath}`)
  console.log('')

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

  // Print config with secrets masked (show $ENV_VAR not resolved value)
  const display = JSON.stringify(config, null, 2)
  console.log(display)
  console.log('')
}
