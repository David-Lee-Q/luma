import { createServer } from 'node:http'
import { createReadStream, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_DIR = resolve(ROOT, '.cosmocode/docs')
const DOC_HOME = `/docs/${encodeURIComponent('产品说明.html')}`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.md': 'text/markdown; charset=utf-8',
}

function serveDoc(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: '仅支持 GET' })
    return
  }

  if (pathname === '/docs' || pathname === '/docs/') {
    res.writeHead(302, { Location: DOC_HOME })
    res.end()
    return
  }

  let relative
  try {
    relative = decodeURIComponent(pathname.slice('/docs/'.length))
  } catch {
    sendJson(res, 400, { error: '无效的文档路径' })
    return
  }

  const file = resolve(DOCS_DIR, relative)
  if (file !== DOCS_DIR && !file.startsWith(DOCS_DIR + sep)) {
    sendJson(res, 403, { error: '禁止访问该路径' })
    return
  }

  let stat
  try {
    stat = statSync(file)
  } catch {
    sendJson(res, 404, { error: '文档不存在' })
    return
  }
  if (!stat.isFile()) {
    sendJson(res, 404, { error: '文档不存在' })
    return
  }

  res.writeHead(200, {
    'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(file).pipe(res)
}

function loadEnv() {
  const envFile = resolve(ROOT, '.env')
  if (!existsSync(envFile)) return
  const text = readFileSync(envFile, 'utf8')
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eq = trimmed.indexOf('=')
    if (eq === -1) return
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  })
}

loadEnv()

const CONFIG = {
  port: Number(process.env.PORT || 8787),
  base: (process.env.COSMO_API_BASE || 'https://gpt.cosmoplat.com/v1').replace(/\/+$/, ''),
  key: process.env.COSMO_API_KEY || '',
  models: {
    vision: process.env.COSMO_MODEL_VISION || 'cosmo-mind-vl',
    text: process.env.COSMO_MODEL_TEXT || 'cosmo-mind',
    embed: process.env.COSMO_MODEL_EMBED || 'cosmo-mind-emb',
    rerank: process.env.COSMO_MODEL_RERANK || 'cosmo-mind-rerank',
  },
  timeoutMs: Number(process.env.COSMO_TIMEOUT_MS || 90000),
  maxBodyBytes: Number(process.env.COSMO_MAX_BODY_BYTES || 24 * 1024 * 1024),
  maxImageBytes: Number(process.env.COSMO_MAX_IMAGE_BYTES || 6 * 1024 * 1024),
  ratePerMinute: Number(process.env.COSMO_RATE_PER_MINUTE || 300),
}

if (!CONFIG.key) {
  console.error('[luma-api] 缺少 COSMO_API_KEY，请复制 .env.example 为 .env 并填写密钥')
}

const buckets = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const bucket = buckets.get(ip) ?? { count: 0, resetAt: now + 60_000 }
  if (now > bucket.resetAt) {
    bucket.count = 0
    bucket.resetAt = now + 60_000
  }
  bucket.count += 1
  buckets.set(ip, bucket)
  return bucket.count > CONFIG.ratePerMinute
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > CONFIG.maxBodyBytes) {
        reject(Object.assign(new Error('请求体过大'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('请求体不是合法 JSON'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

const DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/

function assertImages(images) {
  if (!Array.isArray(images) || !images.length) {
    throw Object.assign(new Error('images 必须是非空数组'), { status: 400 })
  }
  if (images.length > 8) {
    throw Object.assign(new Error('单次最多处理 8 张图片'), { status: 400 })
  }
  images.forEach((image) => {
    if (typeof image !== 'string' || !DATA_URL.test(image)) {
      throw Object.assign(new Error('图片必须是 jpeg/png/webp 的 data URL'), { status: 400 })
    }
    if (image.length > CONFIG.maxImageBytes) {
      throw Object.assign(new Error('单张图片过大，请压缩后再试'), { status: 413 })
    }
  })
}

function assertPrompt(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw Object.assign(new Error('prompt 不能为空'), { status: 400 })
  }
  if (prompt.length > 4000) {
    throw Object.assign(new Error('prompt 过长'), { status: 400 })
  }
}

async function upstream(path, body) {
  if (!CONFIG.key) {
    throw Object.assign(new Error('服务端未配置模型密钥'), { status: 503 })
  }
  const response = await fetch(`${CONFIG.base}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CONFIG.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(CONFIG.timeoutMs),
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }
  if (!response.ok) {
    const detail =
      (parsed && (parsed.error?.message || parsed.message)) || `上游返回 ${response.status}`
    const message =
      response.status === 429 ? '云端模型调用配额已满，请稍后再试' : String(detail).slice(0, 300)
    throw Object.assign(new Error(message), {
      status: response.status >= 500 ? 502 : response.status,
    })
  }
  if (!parsed) {
    throw Object.assign(new Error('上游返回了无法解析的内容'), { status: 502 })
  }
  return parsed
}

function messageText(payload) {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text ?? ''))
      .join('')
  }
  return ''
}

async function handleVision(body) {
  const { prompt, images, system, maxTokens, temperature, json } = body
  assertPrompt(prompt)
  assertImages(images)
  const content = [
    { type: 'text', text: prompt },
    ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
  ]
  const payload = await upstream('/chat/completions', {
    model: CONFIG.models.vision,
    temperature: typeof temperature === 'number' ? temperature : 0.2,
    max_tokens: Number(maxTokens) || 700,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content },
    ],
  })
  return {
    text: messageText(payload),
    model: payload.model ?? CONFIG.models.vision,
    usage: payload.usage ?? null,
  }
}

async function handleText(body) {
  const { prompt, system, maxTokens, temperature, json } = body
  assertPrompt(prompt)
  const payload = await upstream('/chat/completions', {
    model: CONFIG.models.text,
    temperature: typeof temperature === 'number' ? temperature : 0.3,
    max_tokens: Number(maxTokens) || 700,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
  })
  return {
    text: messageText(payload),
    model: payload.model ?? CONFIG.models.text,
    usage: payload.usage ?? null,
  }
}

async function handleEmbeddings(body) {
  const input = Array.isArray(body.input) ? body.input : [body.input]
  const clean = input.map((item) => String(item ?? '').slice(0, 2000)).filter(Boolean)
  if (!clean.length) {
    throw Object.assign(new Error('input 不能为空'), { status: 400 })
  }
  if (clean.length > 64) {
    throw Object.assign(new Error('单次最多 64 条文本'), { status: 400 })
  }
  const payload = await upstream('/embeddings', {
    model: body.model || CONFIG.models.embed,
    input: clean,
  })
  const vectors = (payload.data ?? [])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => item.embedding)
  return {
    vectors,
    dim: vectors[0]?.length ?? 0,
    model: payload.model ?? CONFIG.models.embed,
  }
}

async function handleRerank(body) {
  const query = String(body.query ?? '').trim()
  if (!query) throw Object.assign(new Error('query 不能为空'), { status: 400 })
  const documents = Array.isArray(body.documents)
    ? body.documents.map((doc) => String(doc ?? '').slice(0, 500))
    : []
  if (!documents.length) throw Object.assign(new Error('documents 不能为空'), { status: 400 })
  if (documents.length > 64) throw Object.assign(new Error('单次最多 64 条文档'), { status: 400 })
  const payload = await upstream('/rerank', {
    model: body.model || CONFIG.models.rerank,
    query,
    documents,
    top_n: Number(body.topN) || documents.length,
  })
  return {
    results: (payload.results ?? []).map((item) => ({
      index: item.index,
      score: item.relevance_score ?? item.score ?? 0,
    })),
    model: payload.model ?? CONFIG.models.rerank,
  }
}

const ROUTES = {
  '/api/vision': handleVision,
  '/api/text': handleText,
  '/api/embeddings': handleEmbeddings,
  '/api/rerank': handleRerank,
}

const server = createServer(async (req, res) => {
  const ip = req.socket.remoteAddress ?? 'unknown'
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      configured: Boolean(CONFIG.key),
      models: CONFIG.models,
      ratePerMinute: CONFIG.ratePerMinute,
    })
    return
  }

  if (url.pathname === '/docs' || url.pathname.startsWith('/docs/')) {
    serveDoc(req, res, url.pathname)
    return
  }

  const handler = ROUTES[url.pathname]
  if (!handler) {
    sendJson(res, 404, { error: '未知接口' })
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: '仅支持 POST' })
    return
  }
  if (!CONFIG.key) {
    sendJson(res, 503, { error: '服务端未配置模型密钥' })
    return
  }
  if (rateLimited(ip)) {
    sendJson(res, 429, { error: '请求过于频繁，请稍后再试' })
    return
  }

  try {
    const body = await readBody(req)
    const result = await handler(body)
    sendJson(res, 200, result)
  } catch (error) {
    const status = Number(error?.status) || 500
    if (status >= 500) console.error('[luma-api]', req.url, error?.message)
    sendJson(res, status, { error: error?.message || '模型调用失败' })
  }
})

server.listen(CONFIG.port, '0.0.0.0', () => {
  console.log(`[luma-api] listening on http://0.0.0.0:${CONFIG.port}`)
  console.log(
    `[luma-api] upstream=${CONFIG.base} configured=${Boolean(CONFIG.key)} vision=${CONFIG.models.vision}`,
  )
})
