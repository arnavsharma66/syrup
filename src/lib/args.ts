import {isThemeMode, type ThemeMode} from '../theme.js'

export type CliArgs = {
  help: boolean
  version: boolean
  initialUrl?: string
  themeMode?: ThemeMode
  best?: boolean
  mp3?: boolean
  outDir?: string
  update?: boolean
  error?: string
}

export function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {help: false, version: false}
  const positional: string[] = []

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (arg === '-h' || arg === '--help') {
      result.help = true
    } else if (arg === '-v' || arg === '--version') {
      result.version = true
    } else if (arg === '--best') {
      result.best = true
    } else if (arg === '--mp3') {
      result.mp3 = true
    } else if (arg === '-U' || arg === '--update') {
      result.update = true
    } else if (arg === '-o' || arg === '--output') {
      const value = args[++index]
      if (!value) return {...result, error: `${arg} needs a directory path`}
      result.outDir = value
    } else if (arg.startsWith('-o=')) {
      result.outDir = arg.slice('-o='.length)
    } else if (arg.startsWith('--output=')) {
      result.outDir = arg.slice('--output='.length)
    } else if (arg === '--theme') {
      const value = args[++index]
      if (!value) return {...result, error: '--theme needs a value: auto, light, or dark'}
      if (!isThemeMode(value)) return {...result, error: `unknown theme "${value}" — use auto, light, or dark`}
      result.themeMode = value
    } else if (arg.startsWith('--theme=')) {
      const value = arg.slice('--theme='.length)
      if (!isThemeMode(value)) return {...result, error: `unknown theme "${value}" — use auto, light, or dark`}
      result.themeMode = value
    } else if (arg.startsWith('-')) {
      return {...result, error: `unknown option "${arg}"`}
    } else {
      positional.push(arg)
    }
  }

  if (result.best && result.mp3) return {...result, error: '--best and --mp3 cannot be used together'}
  if ((result.best || result.mp3) && positional.length === 0) {
    return {...result, error: `${result.best ? '--best' : '--mp3'} requires a url`}
  }
  if (positional.length > 1) return {...result, error: 'expected a single url'}
  if (positional[0] !== undefined) {
    result.initialUrl = positional[0]
  }
  return result
}
