import React from 'react'
import {createRequire} from 'node:module'
import {render} from 'ink'
import {App, type Outcome} from './app.js'
import {captureFrames} from './lib/click-map.js'
import {parseArgs} from './lib/args.js'
import {readClipboard} from './lib/clipboard.js'
import {isProbablyUrl} from './lib/platforms.js'
import {ensureYtDlp, updateYtDlp} from './lib/ytdlp.js'
import {getDefaultOutDir, loadConfig, saveConfig} from './lib/config.js'

// read at runtime from the shipped package.json so npm version bumps
// can't drift from a hardcoded constant
const VERSION: string = createRequire(import.meta.url)('../package.json').version

const HELP = `
  syrup — syrup any video. paste. syrup. done.

  Usage
    $ syrup [url]

  Examples
    $ syrup https://youtu.be/dQw4w9WgXcQ
    $ syrup https://x.com/user/status/123456
    $ syrup                 (prompts for a url)

  Options
    --best          download best quality, skip the picker
    --mp3           download audio-only mp3, skip the picker
    -o, --output    set the output directory (default: ~/Downloads)
    -U, --update    update the bundled yt-dlp binary
    --theme <mode>  use auto, light, or dark for this run
    -h, --help      show this help
    -v, --version   show version

  Downloads are saved to ~/Downloads (or the -o directory).
  Powered by yt-dlp — YouTube, X, Instagram, Threads, TikTok & 2000+ sites.
`

const args = parseArgs(process.argv.slice(2))

if (args.error) {
  console.error(`syrup: ${args.error}\nTry "syrup --help" for usage.`)
  process.exit(1)
}

if (args.help) {
  console.log(HELP)
  process.exit(0)
}

if (args.version) {
  console.log(VERSION)
  process.exit(0)
}

if (args.update) {
  try {
    const ytdlp = await ensureYtDlp(msg => console.log(msg))
    await updateYtDlp(ytdlp, msg => console.log(msg))
    process.exit(0)
  } catch (error) {
    console.error(`syrup: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

if (args.outDir && !args.initialUrl) {
  try {
    const config = loadConfig()
    config.outDir = args.outDir
    saveConfig(config)
    console.log(`✓ Default output folder permanently set to: ${args.outDir}`)
    process.exit(0)
  } catch (error) {
    console.error(`syrup: failed to save default folder: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

const initialUrl = args.initialUrl
const initialThemeMode = args.themeMode ?? 'auto'
const scriptMode = args.best ? 'best' as const : args.mp3 ? 'mp3' as const : undefined
const outDir = args.outDir ?? getDefaultOutDir()

const isTTY = Boolean(process.stdout.isTTY)

// no url given — offer the clipboard url (⇥ to paste) when it already holds one
let clipboardUrl: string | undefined
if (!initialUrl && isTTY) {
  const clipped = readClipboard().trim()
  // reject multi-line clipboard content — new URL() silently strips newlines
  if (clipped && !/\s/.test(clipped) && isProbablyUrl(clipped)) clipboardUrl = clipped
}
const enterAltScreen = () => process.stdout.write('\x1b[?1049h\x1b[H')
// also switch mouse tracking off — a crash can skip React effect cleanup
const leaveAltScreen = () => process.stdout.write('\x1b[?1006l\x1b[?1000l\x1b[?1049l')

if (isTTY) {
  enterAltScreen()
  process.on('exit', leaveAltScreen)
  // restore the terminal BEFORE a crash prints, or the stack trace is
  // wiped along with the alternate screen and the app looks like it
  // silently quit
  for (const event of ['uncaughtException', 'unhandledRejection'] as const) {
    process.on(event, (error: unknown) => {
      leaveAltScreen()
      console.error(error)
      process.exit(1)
    })
  }
}

let outcome: Outcome = {}
const {waitUntilExit} = render(
  <App
    initialUrl={initialUrl}
    clipboardUrl={clipboardUrl}
    initialThemeMode={initialThemeMode}
    scriptMode={scriptMode}
    outDir={outDir}
    onOutcome={result => (outcome = result)}
  />,
  // keep a copy of every frame so clicks can be hit-tested against it
  {stdout: captureFrames(process.stdout)},
)

await waitUntilExit()

if (isTTY) leaveAltScreen()
if (outcome.filepaths && outcome.filepaths.length > 0) {
  for (const fp of outcome.filepaths) {
    console.log(`✓ syruped → ${fp}`)
  }
} else if (outcome.filepath) {
  console.log(`✓ syruped → ${outcome.filepath}`)
}

