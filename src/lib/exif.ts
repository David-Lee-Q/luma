/** 从 JPEG 的 APP1 段读取拍摄时间，失败时返回 null。 */
export async function readExifDate(blob: Blob): Promise<number | null> {
  if (!/jpe?g/i.test(blob.type)) return null
  const buffer = await blob.slice(0, 128 * 1024).arrayBuffer()
  const view = new DataView(buffer)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null

  let offset = 2
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1
      continue
    }
    const marker = view.getUint8(offset + 1)
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (marker === 0xda || marker === 0xd9) break
    const length = view.getUint16(offset + 2)
    if (length < 2) break
    if (marker === 0xe1 && offset + 10 < view.byteLength) {
      if (
        view.getUint32(offset + 4) === 0x45786966 &&
        view.getUint16(offset + 8) === 0x0000
      ) {
        const tiff = offset + 10
        try {
          return parseTiff(view, tiff)
        } catch {
          return null
        }
      }
    }
    offset += 2 + length
  }
  return null
}

function parseTiff(view: DataView, start: number): number | null {
  if (start + 8 > view.byteLength) return null
  const byteOrder = view.getUint16(start)
  const little = byteOrder === 0x4949
  if (!little && byteOrder !== 0x4d4d) return null
  const u16 = (offset: number) => view.getUint16(offset, little)
  const u32 = (offset: number) => view.getUint32(offset, little)
  if (u16(start + 2) !== 42) return null
  const ifd0 = start + u32(start + 4)
  if (ifd0 + 2 > view.byteLength) return null

  let dateTime: string | null = null
  let exifIfd: number | null = null

  const count = u16(ifd0)
  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12
    if (entry + 12 > view.byteLength) break
    const tag = u16(entry)
    if (tag === 0x8769) {
      exifIfd = start + u32(entry + 8)
    } else if (tag === 0x0132) {
      const value = readAscii(view, start, entry, little)
      if (value) dateTime = value
    }
  }

  if (exifIfd !== null && exifIfd + 2 <= view.byteLength) {
    const exifCount = u16(exifIfd)
    for (let i = 0; i < exifCount; i += 1) {
      const entry = exifIfd + 2 + i * 12
      if (entry + 12 > view.byteLength) break
      const tag = u16(entry)
      if (tag === 0x9003 || tag === 0x9004) {
        const value = readAscii(view, start, entry, little)
        if (value) dateTime = value
        break
      }
    }
  }

  return dateTime ? parseExifDateString(dateTime) : null
}

function readAscii(
  view: DataView,
  tiffStart: number,
  entry: number,
  little: boolean,
): string | null {
  const count = view.getUint32(entry + 4, little)
  if (count === 0 || count > 64) return null
  const valueOffset = count <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, little)
  if (valueOffset + count > view.byteLength) return null
  let text = ''
  for (let i = 0; i < count; i += 1) {
    const code = view.getUint8(valueOffset + i)
    if (code === 0) break
    text += String.fromCharCode(code)
  }
  return text || null
}

function parseExifDateString(value: string): number | null {
  const match = value
    .trim()
    .match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  const time = date.getTime()
  return Number.isNaN(time) ? null : time
}
