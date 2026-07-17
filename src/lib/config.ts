import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CONFIG_DIR = path.join(os.homedir(), '.config', 'syrup')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export type Config = {
  outDir?: string
}

export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as Config
    }
  } catch {
    // ignore
  }
  return {}
}

export function saveConfig(config: Config): void {
  try {
    fs.mkdirSync(CONFIG_DIR, {recursive: true})
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')
  } catch {
    // ignore
  }
}

export function getDefaultOutDir(): string {
  const config = loadConfig()
  return config.outDir || path.join(os.homedir(), 'Downloads')
}
