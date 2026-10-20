import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const source = process.argv[2] ?? '.cosmocode/docs/产品说明.md'
const target = process.argv[3] ?? source.replace(/\.md$/, '.html')

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const slug = (text) =>
  text
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')

function renderInline(text) {
  let out = escapeHtml(text)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, src) => {
    const caption = alt ? `<figcaption>${alt}</figcaption>` : ''
    return `<figure class="shot"><img src="${src}" alt="${alt}" loading="lazy" />${caption}</figure>`
  })
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return out
}

const isTableRow = (line) => /^\|.*\|$/.test(line.trim())
const isTableRule = (line) => /^\|[\s:|-]+\|$/.test(line.trim())
const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

function buildToc(sections) {
  const items = sections
    .filter((entry) => entry.level <= 2)
    .map(
      (entry) =>
        `<li class="toc-${entry.level}"><a href="#${entry.id}">${entry.plain}</a></li>`,
    )
  if (!items.length) return ''
  return `<nav class="toc" aria-label="目录"><h2>目录</h2><ol>${items.join('')}</ol></nav>`
}

function render(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const body = []
  const sections = []
  let index = 0
  let headingIndex = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    if (/^-{3,}$/.test(line.trim())) {
      body.push('<hr />')
      index += 1
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const text = heading[2].trim()
      const id = `s${++headingIndex}-${slug(text)}`
      sections.push({
        level,
        id,
        plain: escapeHtml(text.replace(/\*\*/g, '')),
      })
      body.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`)
      index += 1
      continue
    }

    if (line.trim().startsWith('>')) {
      const quote = []
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      body.push(`<blockquote>${renderInline(quote.join(' '))}</blockquote>`)
      continue
    }

    if (isTableRow(line) && index + 1 < lines.length && isTableRule(lines[index + 1])) {
      const head = splitRow(line)
      index += 2
      const rows = []
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitRow(lines[index]))
        index += 1
      }
      const thead = `<thead><tr>${head.map((cell) => `<th>${renderInline(cell)}</th>`).join('')}</tr></thead>`
      const tbody = `<tbody>${rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`,
        )
        .join('')}</tbody>`
      body.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`)
      continue
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderInline(lines[index].trim().replace(/^[-*]\s+/, ''))}</li>`)
        index += 1
      }
      body.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const items = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderInline(lines[index].trim().replace(/^\d+\.\s+/, ''))}</li>`)
        index += 1
      }
      body.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    const paragraph = [line.trim()]
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,4})\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith('>') &&
      !/^-{3,}$/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !isTableRow(lines[index])
    ) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    const joined = paragraph.join(' ')
    body.push(
      /^<figure/.test(renderInline(joined))
        ? renderInline(joined)
        : `<p>${renderInline(joined)}</p>`,
    )
  }

  return { html: body.join('\n'), toc: buildToc(sections), title: sections[0]?.plain ?? '文档' }
}

const styles = `
:root {
  --bg: #0a0b0a;
  --surface: #121512;
  --surface-2: #191d18;
  --line: rgba(244, 247, 238, 0.09);
  --line-strong: rgba(244, 247, 238, 0.16);
  --text: #f2f4ee;
  --muted: #9aa198;
  --accent: #c8f169;
  --font-sans: "Avenir Next", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  --font-mono: "SF Mono", "JetBrains Mono", "Menlo", "Consolas", monospace;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background:
    radial-gradient(900px 520px at 50% -10%, rgba(200, 241, 105, 0.08), transparent 62%),
    var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15.5px;
  line-height: 1.72;
  -webkit-font-smoothing: antialiased;
}

.wrap {
  max-width: 900px;
  margin: 0 auto;
  padding: 56px 22px 96px;
}

header.doc-head {
  padding-bottom: 26px;
  margin-bottom: 26px;
  border-bottom: 1px solid var(--line);
}

.doc-mark {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent);
}

.doc-mark i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 12px rgba(200, 241, 105, 0.7);
}

h1 {
  margin: 14px 0 10px;
  font-size: clamp(30px, 5vw, 44px);
  line-height: 1.12;
  font-weight: 660;
  letter-spacing: -0.035em;
}

h2 {
  margin: 54px 0 16px;
  padding-top: 18px;
  font-size: 24px;
  font-weight: 640;
  letter-spacing: -0.02em;
}

h3 {
  margin: 38px 0 12px;
  font-size: 18px;
  font-weight: 620;
}

h4 { margin: 26px 0 10px; font-size: 15.5px; }

p { margin: 12px 0; color: #d9ddd4; }

a { color: var(--accent); text-decoration: none; border-bottom: 1px solid rgba(200, 241, 105, 0.32); }
a:hover { border-bottom-color: var(--accent); }

ul, ol { padding-left: 22px; color: #d9ddd4; }
li { margin: 6px 0; }

strong { color: #fff; font-weight: 640; }

code {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 0.88em;
  color: var(--accent);
}

blockquote {
  margin: 18px 0;
  padding: 14px 18px;
  border-left: 2px solid var(--accent);
  border-radius: 0 12px 12px 0;
  background: rgba(200, 241, 105, 0.05);
  color: #e6eadf;
}

blockquote p { margin: 0; }

hr { margin: 44px 0; border: 0; border-top: 1px solid var(--line); }

nav.toc {
  margin: 30px 0 8px;
  padding: 20px 22px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(180deg, var(--surface), rgba(18, 21, 18, 0.4));
}
nav.toc h2 {
  margin: 0 0 10px;
  padding: 0;
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
}

nav.toc ol { margin: 0; padding-left: 20px; columns: 2; column-gap: 26px; }
nav.toc .toc-2 { list-style: none; margin-left: -20px; }
nav.toc li { break-inside: avoid; }
nav.toc a { color: #d9ddd4; border-bottom: 0; }
nav.toc a:hover { color: var(--accent); }

.table-wrap {
  margin: 18px 0;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 14px;
}

table { width: 100%; border-collapse: collapse; font-size: 14px; }
thead th {
  padding: 11px 14px;
  text-align: left;
  white-space: nowrap;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
tbody td { padding: 11px 14px; border-top: 1px solid var(--line); vertical-align: top; }
tbody tr:hover td { background: rgba(255, 255, 255, 0.02); }

figure.shot {
  margin: 22px 0 30px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: linear-gradient(180deg, var(--surface), rgba(18, 21, 18, 0.35));
}

figure.shot img {
  display: block;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  border-radius: 12px;
  background: #000;
}

figure.shot figcaption {
  margin-top: 12px;
  text-align: center;
  font-size: 12.5px;
  color: var(--muted);
}

footer.doc-foot {
  margin-top: 60px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
  font-size: 12.5px;
  color: var(--muted-2, #6f766e);
}

@media (min-width: 1040px) {
  .wrap { max-width: 1040px; }
  .doc-grid { display: grid; grid-template-columns: 1fr 240px; gap: 44px; align-items: start; }
  nav.toc { position: sticky; top: 32px; order: 2; }
  nav.toc ol { columns: 1; }
  .doc-body { min-width: 0; order: 1; }
  nav.toc .toc-2 { margin-left: 0; }
}

@media (max-width: 620px) {
  .wrap { padding: 34px 16px 72px; }
  nav.toc ol { columns: 1; }
  figure.shot { padding: 9px; border-radius: 16px; }
}
`

const markdown = readFileSync(resolve(source), 'utf8')
const { html, toc, title } = render(markdown)
const stamp = new Date().toISOString().slice(0, 10)

const document = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
<div class="wrap">
  <header class="doc-head">
    <span class="doc-mark"><i></i>Luma 拾光 文档</span>
    <h1>${escapeHtml(title)}</h1>
    <p style="color:var(--muted);font-size:13px;margin:0">由 ${escapeHtml(source)} 生成 · ${stamp}</p>
  </header>
  <div class="doc-grid">
    ${toc}
    <div class="doc-body">
${html}
    </div>
  </div>
  <footer class="doc-foot">本页面由 <code>npm run docs:html</code> 从 Markdown 生成，请勿直接编辑。</footer>
</div>
</body>
</html>
`

mkdirSync(dirname(resolve(target)), { recursive: true })
writeFileSync(resolve(target), document, 'utf8')
console.log(`已生成 ${target}（源 ${source}，${document.length} 字符）`)
