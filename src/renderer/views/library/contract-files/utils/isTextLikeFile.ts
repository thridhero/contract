export function isTextLikeFile(displayName: string): boolean {
  const name = String(displayName || '').trim()
  if (!name) return false

  const lower = name.toLowerCase()

  const textFilenames = new Set(['dockerfile', 'makefile', 'license', 'readme', 'changelog'])
  if (textFilenames.has(lower)) return true

  if (lower.startsWith('.env')) return true

  const textDotfiles = new Set([
    '.gitignore',
    '.gitattributes',
    '.gitmodules',
    '.editorconfig',
    '.npmrc',
    '.dockerignore',
  ])
  if (textDotfiles.has(lower)) return true

  const idx = lower.lastIndexOf('.')
  const ext = idx > 0 ? lower.slice(idx + 1) : ''
  if (!ext) return false

  const textExts = new Set([
    'txt',
    'md',
    'json',
    'csv',
    'log',
    'xml',
    'yaml',
    'yml',
    'ini',
    'conf',
    'env',
    'toml',
    'properties',
    'gradle',
    'sql',
    'graphql',
    'gql',
    'proto',
    'js',
    'jsx',
    'ts',
    'tsx',
    'vue',
    'html',
    'htm',
    'css',
    'scss',
    'less',
    'sh',
    'bash',
    'zsh',
    'ps1',
    'bat',
    'cmd',
    'py',
    'java',
    'kt',
    'kts',
    'go',
    'rs',
    'c',
    'cpp',
    'h',
    'hpp',
    'cs',
    'php',
    'rb',
  ])

  return textExts.has(ext)
}

