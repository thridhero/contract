const fs = require('fs/promises')
const path = require('path')

const DEFAULT_THRESHOLD = 1000
const DEFAULT_ROOTS = ['src']
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue']

function parseArgs(argv) {
  const args = {
    threshold: DEFAULT_THRESHOLD,
    roots: [...DEFAULT_ROOTS],
    extensions: [...DEFAULT_EXTENSIONS],
    check: false,
    top: undefined
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--check') {
      args.check = true
      continue
    }
    if (token === '--threshold') {
      const value = Number(argv[i + 1])
      if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid --threshold')
      args.threshold = value
      i += 1
      continue
    }
    if (token === '--root') {
      const value = argv[i + 1]
      if (!value) throw new Error('Invalid --root')
      args.roots = [value]
      i += 1
      continue
    }
    if (token === '--roots') {
      const value = argv[i + 1]
      if (!value) throw new Error('Invalid --roots')
      args.roots = value.split(',').map((s) => s.trim()).filter(Boolean)
      i += 1
      continue
    }
    if (token === '--extensions') {
      const value = argv[i + 1]
      if (!value) throw new Error('Invalid --extensions')
      args.extensions = value.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (s.startsWith('.') ? s : `.${s}`))
      i += 1
      continue
    }
    if (token === '--top') {
      const value = Number(argv[i + 1])
      if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid --top')
      args.top = value
      i += 1
      continue
    }
    throw new Error(`Unknown arg: ${token}`)
  }

  return args
}

function countLines(text) {
  if (text.length === 0) return 0
  let newlines = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) newlines += 1
  }
  return newlines + (text.endsWith('\n') ? 0 : 1)
}

async function* walkFiles(rootAbs, ignoreDirNames) {
  const entries = await fs.readdir(rootAbs, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(rootAbs, entry.name)
    if (entry.isDirectory()) {
      if (ignoreDirNames.has(entry.name)) continue
      yield* walkFiles(abs, ignoreDirNames)
      continue
    }
    if (entry.isFile()) {
      yield abs
    }
  }
}

async function scan({ cwd, roots, extensions, threshold }) {
  const ignoreDirNames = new Set(['node_modules', 'dist', 'out', 'build', 'coverage', '.git', '.trae', 'release'])
  const results = []

  for (const root of roots) {
    const rootAbs = path.resolve(cwd, root)
    let stat
    try {
      stat = await fs.stat(rootAbs)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue

    for await (const fileAbs of walkFiles(rootAbs, ignoreDirNames)) {
      const ext = path.extname(fileAbs).toLowerCase()
      if (!extensions.includes(ext)) continue

      const text = await fs.readFile(fileAbs, 'utf8')
      const lines = countLines(text)
      if (lines > threshold) {
        results.push({ fileAbs, lines })
      }
    }
  }

  results.sort((a, b) => b.lines - a.lines)
  return results
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()

  const results = await scan({
    cwd,
    roots: args.roots,
    extensions: args.extensions.map((s) => s.toLowerCase()),
    threshold: args.threshold
  })

  if (results.length === 0) {
    console.log(`0 个超长文件（> ${args.threshold} 行）`)
    process.exit(0)
  }

  const shown = typeof args.top === 'number' ? results.slice(0, args.top) : results
  for (const item of shown) {
    const rel = path.relative(cwd, item.fileAbs).replaceAll('\\', '/')
    console.log(`${String(item.lines).padStart(6, ' ')}  ${rel}`)
  }

  if (typeof args.top === 'number' && results.length > shown.length) {
    console.log(`... 还有 ${results.length - shown.length} 个未展示（使用 --top 查看更多/全部）`)
  }

  process.exit(args.check ? 1 : 0)
}

main().catch((err) => {
  console.error(err?.stack || String(err))
  process.exit(2)
})
