import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = process.env.PREVIEW_PORT || '4173'

const children = []

function start(command, args, name) {
  const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit' })
  child.on('exit', (code, signal) => {
    console.log(`[luma] ${name} 退出 code=${code} signal=${signal ?? ''}`)
    shutdown()
  })
  children.push(child)
  return child
}

let closing = false
function shutdown() {
  if (closing) return
  closing = true
  children.forEach((child) => {
    if (!child.killed) child.kill('SIGTERM')
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start(process.execPath, [resolve(ROOT, 'server/index.mjs')], 'api')
start(resolve(ROOT, 'node_modules/.bin/vite'), ['preview', '--host', '0.0.0.0', '--port', PORT], 'preview')
