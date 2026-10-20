export interface DemoPhoto {
  blob: Blob
  name: string
  takenAt: number
}

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas')
  return { canvas, ctx }
}

function toBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.9,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('演示图片生成失败'))),
      type,
      quality,
    )
  })
}

function rng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, count = 1800) {
  const random = rng(seed)
  for (let i = 0; i < count; i += 1) {
    const x = random() * w
    const y = random() * h
    const light = random() > 0.45
    ctx.fillStyle = light ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.06)'
    ctx.fillRect(x, y, 1.4, 1.4)
  }
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.38) {
  const gradient = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.18,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72,
  )
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawDunes(ctx: CanvasRenderingContext2D, w: number, h: number, variant = 0) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.86)
  sky.addColorStop(0, '#0b1436')
  sky.addColorStop(0.28, '#243267')
  sky.addColorStop(0.48, '#61456f')
  sky.addColorStop(0.66, '#c96a58')
  sky.addColorStop(0.8, '#f0a268')
  sky.addColorStop(1, '#ffd6a0')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const sunX = w * (0.66 + variant * 0.07)
  const sunY = h * 0.55
  const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, w * 0.19)
  glow.addColorStop(0, 'rgba(255,246,214,0.95)')
  glow.addColorStop(0.18, 'rgba(255,203,138,0.55)')
  glow.addColorStop(0.55, 'rgba(255,150,108,0.16)')
  glow.addColorStop(1, 'rgba(255,150,108,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  ctx.beginPath()
  ctx.arc(sunX, sunY, w * 0.045, 0, Math.PI * 2)
  ctx.fillStyle = '#fff3cf'
  ctx.fill()

  const layers = [
    {
      color: '#5b3548',
      y: 0.62,
      points: [0.28, 0.58, 0.55, 0.61, 0.8, 0.57, 1, 0.62],
    },
    {
      color: '#3c2337',
      y: 0.71,
      points: [0.18, 0.66, 0.42, 0.7, 0.7, 0.65, 0.88, 0.69, 1, 0.66],
    },
    {
      color: '#281a2a',
      y: 0.8,
      points: [0.14, 0.76, 0.38, 0.79, 0.6, 0.74, 0.84, 0.78, 1, 0.75],
    },
  ]

  layers.forEach((layer, index) => {
    ctx.beginPath()
    ctx.moveTo(0, h * (layer.y + 0.04))
    for (let i = 0; i < layer.points.length; i += 2) {
      const px = layer.points[i] * w
      const py = layer.points[i + 1] * h + variant * index * 10
      ctx.lineTo(px, py)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fillStyle = layer.color
    ctx.fill()
  })

  const foreground = ctx.createLinearGradient(0, h * 0.78, 0, h)
  foreground.addColorStop(0, '#6b3c35')
  foreground.addColorStop(1, '#211421')
  ctx.beginPath()
  ctx.moveTo(0, h * 0.84)
  ctx.bezierCurveTo(w * 0.22, h * 0.79, w * 0.4, h * 0.87, w * 0.6, h * 0.84)
  ctx.bezierCurveTo(w * 0.78, h * 0.81, w * 0.9, h * 0.86, w, h * 0.83)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = foreground
  ctx.fill()

  grain(ctx, w, h, 11 + variant, 1600)
  vignette(ctx, w, h, 0.4)
}

function drawCoast(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6)
  sky.addColorStop(0, '#6ea8c8')
  sky.addColorStop(0.55, '#b6dbe6')
  sky.addColorStop(1, '#eef1dc')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h * 0.62)

  const sun = ctx.createRadialGradient(w * 0.2, h * 0.24, 4, w * 0.2, h * 0.24, w * 0.16)
  sun.addColorStop(0, 'rgba(255,252,225,0.95)')
  sun.addColorStop(1, 'rgba(255,248,210,0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, w, h * 0.6)

  const sea = ctx.createLinearGradient(0, h * 0.55, 0, h)
  sea.addColorStop(0, '#2e94a6')
  sea.addColorStop(0.55, '#11667c')
  sea.addColorStop(1, '#0a4358')
  ctx.fillStyle = sea
  ctx.fillRect(0, h * 0.55, w, h * 0.45)

  ctx.strokeStyle = 'rgba(240,255,250,0.55)'
  ctx.lineWidth = 2
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath()
    const y = h * (0.61 + i * 0.025)
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(w * 0.3, y - 6, w * 0.62, y + 7, w, y - 2)
    ctx.stroke()
  }

  const foam = ctx.createLinearGradient(0, h * 0.7, 0, h)
  foam.addColorStop(0, 'rgba(255,255,255,0.9)')
  foam.addColorStop(1, '#e9d9b8')
  ctx.beginPath()
  ctx.moveTo(0, h * 0.79)
  ctx.bezierCurveTo(w * 0.2, h * 0.72, w * 0.44, h * 0.83, w * 0.62, h * 0.78)
  ctx.bezierCurveTo(w * 0.8, h * 0.73, w * 0.92, h * 0.8, w, h * 0.76)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = foam
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath()
    ctx.ellipse(
      w * (0.12 + i * 0.14),
      h * (0.83 + (i % 2) * 0.02),
      w * 0.06,
      h * 0.006,
      -0.1,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  grain(ctx, w, h, 21, 1600)
  vignette(ctx, w, h, 0.24)
}

function drawForest(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0b2115')
  bg.addColorStop(0.4, '#1d4a2b')
  bg.addColorStop(0.72, '#2c6338')
  bg.addColorStop(1, '#0a1a10')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const glow = ctx.createRadialGradient(w * 0.52, h * 0.26, 10, w * 0.52, h * 0.26, w * 0.45)
  glow.addColorStop(0, 'rgba(231,255,203,0.5)')
  glow.addColorStop(0.45, 'rgba(160,214,128,0.12)')
  glow.addColorStop(1, 'rgba(20,40,22,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  const random = rng(7)
  for (let i = 0; i < 5; i += 1) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const x = w * (0.2 + random() * 0.55)
    const gradient = ctx.createLinearGradient(x, 0, x + w * 0.18, h)
    gradient.addColorStop(0, 'rgba(255,246,200,0.16)')
    gradient.addColorStop(1, 'rgba(255,246,200,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + w * 0.07, 0)
    ctx.lineTo(x + w * 0.28, h)
    ctx.lineTo(x + w * 0.12, h)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  const trunks = [0.06, 0.19, 0.33, 0.48, 0.63, 0.78, 0.9]
  trunks.forEach((position, index) => {
    const x = position * w + (index % 2 ? 12 : -8)
    const width = (0.018 + (index % 3) * 0.008) * w
    const gradient = ctx.createLinearGradient(x, 0, x + width, 0)
    gradient.addColorStop(0, 'rgba(5,14,8,0.92)')
    gradient.addColorStop(0.55, 'rgba(16,33,19,0.9)')
    gradient.addColorStop(1, 'rgba(3,8,5,0.85)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(x - width * 0.4, h)
    ctx.lineTo(x, h * 0.02)
    ctx.lineTo(x + width, h * 0.04)
    ctx.lineTo(x + width * 1.25, h)
    ctx.closePath()
    ctx.fill()
  })

  for (let i = 0; i < 260; i += 1) {
    const x = random() * w
    const y = h * (0.15 + random() * 0.8)
    const radius = 4 + random() * 16
    const green = 70 + Math.floor(random() * 90)
    ctx.fillStyle = `rgba(${30 + Math.floor(random() * 50)},${green},${40 + Math.floor(random() * 40)},${0.12 + random() * 0.2})`
    ctx.beginPath()
    ctx.ellipse(x, y, radius, radius * 0.55, random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  const fog = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.85)
  fog.addColorStop(0, 'rgba(206,231,196,0)')
  fog.addColorStop(0.5, 'rgba(206,231,196,0.1)')
  fog.addColorStop(1, 'rgba(206,231,196,0)')
  ctx.fillStyle = fog
  ctx.fillRect(0, h * 0.55, w, h * 0.3)

  grain(ctx, w, h, 33, 1800)
  vignette(ctx, w, h, 0.45)
}

function drawRamen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const table = ctx.createLinearGradient(0, 0, w, h)
  table.addColorStop(0, '#32190f')
  table.addColorStop(0.5, '#4a2616')
  table.addColorStop(1, '#25110b')
  ctx.fillStyle = table
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(120,70,40,0.25)'
  ctx.lineWidth = 2
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath()
    ctx.moveTo(0, h * (0.1 + i * 0.11))
    ctx.bezierCurveTo(w * 0.3, h * (0.08 + i * 0.11), w * 0.7, h * (0.12 + i * 0.11), w, h * (0.09 + i * 0.11))
    ctx.stroke()
  }

  const cx = w * 0.52
  const cy = h * 0.56
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(cx + 18, cy + 36, w * 0.33, h * 0.29, 0, 0, Math.PI * 2)
  ctx.fill()

  const bowl = ctx.createRadialGradient(cx - w * 0.08, cy - h * 0.08, 10, cx, cy, w * 0.34)
  bowl.addColorStop(0, '#404146')
  bowl.addColorStop(0.72, '#1d1e22')
  bowl.addColorStop(1, '#0e0f12')
  ctx.fillStyle = bowl
  ctx.beginPath()
  ctx.ellipse(cx, cy, w * 0.34, h * 0.3, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#b97a3b'
  ctx.lineWidth = w * 0.012
  ctx.beginPath()
  ctx.ellipse(cx, cy, w * 0.315, h * 0.275, 0, 0, Math.PI * 2)
  ctx.stroke()

  const broth = ctx.createRadialGradient(cx - w * 0.06, cy - h * 0.07, 8, cx, cy, w * 0.29)
  broth.addColorStop(0, '#e3a457')
  broth.addColorStop(0.55, '#bd6b2f')
  broth.addColorStop(1, '#7c3519')
  ctx.fillStyle = broth
  ctx.beginPath()
  ctx.ellipse(cx, cy, w * 0.29, h * 0.25, 0, 0, Math.PI * 2)
  ctx.fill()

  const random = rng(5)
  ctx.strokeStyle = 'rgba(246,214,143,0.9)'
  ctx.lineWidth = 5
  for (let i = 0; i < 18; i += 1) {
    const startX = cx + (random() - 0.5) * w * 0.36
    const startY = cy + (random() - 0.5) * h * 0.3
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.bezierCurveTo(
      startX + 40,
      startY - 30,
      startX + 80,
      startY + 20,
      startX + 120,
      startY - 10,
    )
    ctx.stroke()
  }

  ctx.fillStyle = '#f7f2e4'
  ctx.beginPath()
  ctx.ellipse(cx - w * 0.1, cy - h * 0.05, w * 0.075, h * 0.06, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f2b23f'
  ctx.beginPath()
  ctx.arc(cx - w * 0.1, cy - h * 0.05, w * 0.028, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#4f7c3a'
  for (let i = 0; i < 14; i += 1) {
    const x = cx + (random() - 0.5) * w * 0.4
    const y = cy + (random() - 0.5) * h * 0.32
    ctx.beginPath()
    ctx.ellipse(x, y, 7, 4, random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = '#22301d'
  ctx.save()
  ctx.translate(cx + w * 0.14, cy - h * 0.06)
  ctx.rotate(0.35)
  roundedRect(ctx, 0, 0, w * 0.13, h * 0.1, 4)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.translate(cx + w * 0.2, cy - h * 0.33)
  ctx.rotate(-0.62)
  ctx.fillStyle = '#3a2418'
  ctx.fillRect(0, 0, w * 0.008, h * 0.24)
  ctx.fillStyle = '#d9b37a'
  ctx.fillRect(w * 0.009, 0, w * 0.008, h * 0.24)
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,245,225,0.13)'
  ctx.lineWidth = 10
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath()
    ctx.moveTo(cx - 40 + i * 40, cy - h * 0.26)
    ctx.bezierCurveTo(cx - 80 + i * 40, cy - h * 0.38, cx + 20 + i * 40, cy - h * 0.42, cx - 10 + i * 40, cy - h * 0.5)
    ctx.stroke()
  }

  grain(ctx, w, h, 44, 1400)
  vignette(ctx, w, h, 0.5)
}

function drawCake(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#8a3a34')
  bg.addColorStop(0.55, '#b45c4c')
  bg.addColorStop(1, '#63282b')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const light = ctx.createRadialGradient(w * 0.32, h * 0.22, 20, w * 0.32, h * 0.22, w * 0.6)
  light.addColorStop(0, 'rgba(255,220,180,0.28)')
  light.addColorStop(1, 'rgba(255,190,150,0)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(w * 0.55, h * 0.82, w * 0.32, h * 0.07, 0, 0, Math.PI * 2)
  ctx.fill()

  const plate = ctx.createRadialGradient(w * 0.45, h * 0.6, 20, w * 0.5, h * 0.7, w * 0.42)
  plate.addColorStop(0, '#fff6e8')
  plate.addColorStop(1, '#dfc6ad')
  ctx.fillStyle = plate
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.74, w * 0.36, h * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#e9a7a2'
  roundedRect(ctx, w * 0.32, h * 0.34, w * 0.34, h * 0.38, 16)
  ctx.fill()
  ctx.fillStyle = '#f7e6d2'
  ctx.fillRect(w * 0.32, h * 0.44, w * 0.34, h * 0.055)
  ctx.fillStyle = '#e9a7a2'
  ctx.fillRect(w * 0.32, h * 0.55, w * 0.34, h * 0.06)

  ctx.fillStyle = '#fbe9d8'
  ctx.beginPath()
  ctx.ellipse(w * 0.49, h * 0.345, w * 0.18, h * 0.045, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#f8d9cc'
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath()
    ctx.ellipse(w * (0.37 + i * 0.06), h * 0.39, 12, 22 + (i % 2) * 8, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const berry = ctx.createRadialGradient(w * 0.48, h * 0.27, 2, w * 0.5, h * 0.3, 60)
  berry.addColorStop(0, '#ff6b6b')
  berry.addColorStop(1, '#a31428')
  ctx.fillStyle = berry
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.3, w * 0.07, h * 0.09, 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3d6b34'
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath()
    ctx.ellipse(w * (0.48 + i * 0.01), h * 0.215, 12, 5, -0.6 + i * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  grain(ctx, w, h, 55, 1300)
  vignette(ctx, w, h, 0.42)
}

function drawNight(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#04060f')
  sky.addColorStop(0.45, '#0a1020')
  sky.addColorStop(1, '#04070c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const moon = ctx.createRadialGradient(w * 0.78, h * 0.16, 4, w * 0.78, h * 0.16, w * 0.25)
  moon.addColorStop(0, 'rgba(190,215,255,0.55)')
  moon.addColorStop(0.25, 'rgba(120,160,230,0.1)')
  moon.addColorStop(1, 'rgba(80,120,200,0)')
  ctx.fillStyle = moon
  ctx.fillRect(0, 0, w, h)

  const random = rng(19)
  const buildings = [
    { x: 0, width: 0.14, top: 0.52 },
    { x: 0.12, width: 0.1, top: 0.6 },
    { x: 0.21, width: 0.13, top: 0.46 },
    { x: 0.33, width: 0.09, top: 0.58 },
    { x: 0.41, width: 0.15, top: 0.5 },
    { x: 0.55, width: 0.11, top: 0.62 },
    { x: 0.65, width: 0.14, top: 0.44 },
    { x: 0.78, width: 0.1, top: 0.56 },
    { x: 0.87, width: 0.15, top: 0.48 },
  ]

  buildings.forEach((building) => {
    const x = building.x * w
    const width = building.width * w
    const top = building.top * h
    ctx.fillStyle = '#070b14'
    ctx.fillRect(x, top, width, h - top)
    ctx.fillStyle = 'rgba(255,190,110,0.75)'
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        if (random() > 0.52) {
          ctx.globalAlpha = 0.25 + random() * 0.5
          ctx.fillRect(x + 10 + column * (width / 4.6), top + 18 + row * 26, 8, 11)
        }
      }
    }
    ctx.globalAlpha = 1
  })

  ctx.save()
  ctx.shadowColor = '#ff4fa3'
  ctx.shadowBlur = 30
  ctx.strokeStyle = '#ff6cb6'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(w * 0.18, h * 0.36)
  ctx.lineTo(w * 0.32, h * 0.36)
  ctx.stroke()
  ctx.shadowColor = '#4fe3ff'
  ctx.strokeStyle = '#9ef2ff'
  ctx.beginPath()
  ctx.moveTo(w * 0.66, h * 0.3)
  ctx.lineTo(w * 0.82, h * 0.3)
  ctx.stroke()
  ctx.restore()

  const street = ctx.createLinearGradient(0, h * 0.72, 0, h)
  street.addColorStop(0, 'rgba(255,110,170,0.16)')
  street.addColorStop(0.6, 'rgba(50,90,140,0.08)')
  street.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = street
  ctx.fillRect(0, h * 0.72, w, h * 0.28)

  for (let i = 0; i < 26; i += 1) {
    const x = random() * w
    const y = h * (0.55 + random() * 0.35)
    const radius = 3 + random() * 14
    ctx.fillStyle = `rgba(${180 + Math.floor(random() * 70)},${140 + Math.floor(random() * 80)},255,${0.04 + random() * 0.12})`
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  grain(ctx, w, h, 77, 1200)
}

function drawPortrait(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bg = ctx.createRadialGradient(w * 0.62, h * 0.32, 20, w * 0.5, h * 0.5, w * 0.75)
  bg.addColorStop(0, '#8a5a3c')
  bg.addColorStop(0.45, '#5a3626')
  bg.addColorStop(1, '#241511')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const random = rng(23)
  for (let i = 0; i < 26; i += 1) {
    const x = random() * w
    const y = random() * h * 0.75
    const radius = 6 + random() * 28
    ctx.fillStyle = `rgba(255,200,140,${0.03 + random() * 0.08})`
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const glow = ctx.createRadialGradient(w * 0.72, h * 0.26, 10, w * 0.72, h * 0.26, w * 0.4)
  glow.addColorStop(0, 'rgba(255,205,150,0.28)')
  glow.addColorStop(1, 'rgba(255,205,150,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  const shoulder = ctx.createLinearGradient(0, h * 0.62, 0, h)
  shoulder.addColorStop(0, '#2c2f26')
  shoulder.addColorStop(1, '#14170f')
  ctx.fillStyle = shoulder
  ctx.beginPath()
  ctx.moveTo(w * 0.04, h)
  ctx.bezierCurveTo(w * 0.12, h * 0.72, w * 0.3, h * 0.64, w * 0.42, h * 0.63)
  ctx.lineTo(w * 0.6, h * 0.63)
  ctx.bezierCurveTo(w * 0.78, h * 0.66, w * 0.9, h * 0.78, w * 0.96, h)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#c98f66'
  ctx.beginPath()
  ctx.ellipse(w * 0.51, h * 0.56, w * 0.085, h * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()

  const face = ctx.createRadialGradient(w * 0.45, h * 0.34, 20, w * 0.5, h * 0.42, w * 0.2)
  face.addColorStop(0, '#e7b387')
  face.addColorStop(0.6, '#cf966c')
  face.addColorStop(1, '#9c6544')
  ctx.fillStyle = face
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.4, w * 0.16, h * 0.185, -0.04, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#22140f'
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.3, w * 0.172, h * 0.13, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(w * 0.66, h * 0.39, w * 0.055, h * 0.12, 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(w * 0.34, h * 0.4, w * 0.05, h * 0.11, -0.1, 0, Math.PI * 2)
  ctx.fill()

  const shade = ctx.createLinearGradient(w * 0.4, 0, w * 0.68, 0)
  shade.addColorStop(0, 'rgba(60,30,20,0)')
  shade.addColorStop(1, 'rgba(45,20,14,0.42)')
  ctx.fillStyle = shade
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.4, w * 0.16, h * 0.185, -0.04, 0, Math.PI * 2)
  ctx.fill()

  const rim = ctx.createLinearGradient(w * 0.32, h * 0.26, w * 0.6, h * 0.6)
  rim.addColorStop(0, 'rgba(255,221,170,0.5)')
  rim.addColorStop(1, 'rgba(255,221,170,0)')
  ctx.strokeStyle = rim
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.4, w * 0.16, h * 0.185, -0.04, Math.PI * 0.9, Math.PI * 1.65)
  ctx.stroke()

  ctx.fillStyle = 'rgba(30,16,12,0.45)'
  ctx.beginPath()
  ctx.ellipse(w * 0.43, h * 0.42, w * 0.018, h * 0.012, 0, 0, Math.PI * 2)
  ctx.ellipse(w * 0.58, h * 0.42, w * 0.018, h * 0.012, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(120,60,45,0.5)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(w * 0.505, h * 0.47, w * 0.035, 0.2, Math.PI - 0.2)
  ctx.stroke()

  grain(ctx, w, h, 88, 1500)
  vignette(ctx, w, h, 0.55)
}

function drawScreenshot(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f3f5f2'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#101410'
  ctx.font = `600 ${Math.round(w * 0.038)}px system-ui, -apple-system, sans-serif`
  ctx.fillText('9:41', w * 0.07, h * 0.045)
  ctx.fillStyle = '#101410'
  roundedRect(ctx, w * 0.82, h * 0.026, w * 0.09, h * 0.011, 8)
  ctx.fill()
  ctx.fillStyle = '#101410'
  roundedRect(ctx, w * 0.78, h * 0.026, w * 0.03, h * 0.011, 4)
  ctx.fill()

  ctx.fillStyle = '#6d756b'
  ctx.font = `500 ${Math.round(w * 0.036)}px system-ui, -apple-system, sans-serif`
  ctx.fillText('周四 · 10月16日', w * 0.07, h * 0.105)

  ctx.fillStyle = '#121712'
  ctx.font = `700 ${Math.round(w * 0.078)}px system-ui, -apple-system, sans-serif`
  ctx.fillText('早上好，Mia', w * 0.07, h * 0.16)

  const hero = ctx.createLinearGradient(w * 0.07, h * 0.2, w * 0.93, h * 0.38)
  hero.addColorStop(0, '#c8f169')
  hero.addColorStop(1, '#7fc46a')
  ctx.fillStyle = hero
  roundedRect(ctx, w * 0.07, h * 0.2, w * 0.86, h * 0.175, w * 0.05)
  ctx.fill()

  ctx.fillStyle = 'rgba(16,24,12,0.72)'
  ctx.font = `600 ${Math.round(w * 0.032)}px system-ui, -apple-system, sans-serif`
  ctx.fillText('今日专注', w * 0.12, h * 0.245)
  ctx.fillStyle = '#101a0c'
  ctx.font = `700 ${Math.round(w * 0.1)}px system-ui, -apple-system, sans-serif`
  ctx.fillText('3h 42m', w * 0.12, h * 0.315)
  ctx.fillStyle = 'rgba(16,24,12,0.62)'
  ctx.font = `500 ${Math.round(w * 0.03)}px system-ui, -apple-system, sans-serif`
  ctx.fillText('连续第 12 天', w * 0.12, h * 0.35)

  ctx.fillStyle = '#121712'
  ctx.font = `700 ${Math.round(w * 0.042)}px system-ui, -apple-system, sans-serif`
  ctx.fillText('快捷入口', w * 0.07, h * 0.43)

  const tiles = ['#dfe8d8', '#f0e2cf', '#dbe6ef', '#eadff0']
  tiles.forEach((color, index) => {
    ctx.fillStyle = color
    roundedRect(ctx, w * (0.07 + index * 0.22), h * 0.455, w * 0.19, h * 0.105, w * 0.035)
    ctx.fill()
    ctx.fillStyle = 'rgba(22,30,20,0.55)'
    roundedRect(ctx, w * (0.11 + index * 0.22), h * 0.49, w * 0.11, h * 0.012, 6)
    ctx.fill()
    roundedRect(ctx, w * (0.11 + index * 0.22), h * 0.512, w * 0.075, h * 0.01, 5)
    ctx.fill()
  })

  ctx.fillStyle = '#121712'
  ctx.font = `700 ${Math.round(w * 0.042)}px system-ui, -apple-system, sans-serif`
  ctx.fillText('今天安排', w * 0.07, h * 0.61)

  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = '#ffffff'
    roundedRect(ctx, w * 0.07, h * (0.635 + i * 0.085), w * 0.86, h * 0.07, w * 0.03)
    ctx.fill()
    ctx.fillStyle = ['#c8f169', '#f3c98f', '#b9c9f0'][i]
    roundedRect(ctx, w * 0.1, h * (0.652 + i * 0.085), w * 0.036, h * 0.036, w * 0.018)
    ctx.fill()
    ctx.fillStyle = '#1a2018'
    roundedRect(ctx, w * 0.16, h * (0.652 + i * 0.085), w * (0.3 + i * 0.05), h * 0.013, 6)
    ctx.fill()
    ctx.fillStyle = '#a3aaa0'
    roundedRect(ctx, w * 0.16, h * (0.675 + i * 0.085), w * 0.18, h * 0.009, 5)
    ctx.fill()
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, h * 0.93, w, h * 0.07)
  ctx.fillStyle = '#0f140f'
  roundedRect(ctx, w * 0.2, h * 0.955, w * 0.06, h * 0.012, 6)
  ctx.fill()
  ctx.fillStyle = '#a8aea5'
  for (let i = 0; i < 4; i += 1) {
    roundedRect(ctx, w * (0.12 + i * 0.21), h * 0.967, w * 0.03, h * 0.008, 4)
    ctx.fill()
  }
}

function drawReceipt(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#b9b2a4')
  bg.addColorStop(1, '#8d8779')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(w * 0.5, h * 0.5)
  ctx.rotate(-0.025)
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fillRect(-w * 0.36 + 10, -h * 0.42 + 14, w * 0.72, h * 0.84)
  ctx.fillStyle = '#fbfaf4'
  ctx.fillRect(-w * 0.36, -h * 0.42, w * 0.72, h * 0.84)

  ctx.fillStyle = '#22251f'
  ctx.textAlign = 'center'
  ctx.font = `700 ${Math.round(w * 0.05)}px "Courier New", monospace`
  ctx.fillText('LUMA MART', 0, -h * 0.33)
  ctx.font = `400 ${Math.round(w * 0.022)}px "Courier New", monospace`
  ctx.fillText('DAILY GOODS · SHANGHAI', 0, -h * 0.3)
  ctx.strokeStyle = '#2b2e27'
  ctx.setLineDash([6, 6])
  ctx.beginPath()
  ctx.moveTo(-w * 0.3, -h * 0.27)
  ctx.lineTo(w * 0.3, -h * 0.27)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.textAlign = 'left'
  const random = rng(3)
  const items = [
    ['08:42', '手冲咖啡', '28.00'],
    ['08:43', '燕麦拿铁', '32.00'],
    ['08:45', '可颂', '18.00'],
    ['08:47', '气泡水', '12.00'],
    ['08:51', '当日面包', '16.00'],
  ]
  items.forEach((item, index) => {
    const y = -h * 0.22 + index * h * 0.055
    ctx.fillStyle = '#3c4038'
    ctx.font = `400 ${Math.round(w * 0.022)}px "Courier New", monospace`
    ctx.fillText(item[0], -w * 0.3, y)
    ctx.fillText(item[1], -w * 0.2, y)
    ctx.textAlign = 'right'
    ctx.fillText(item[2], w * 0.3, y)
    ctx.textAlign = 'left'
  })

  ctx.strokeStyle = '#9a9c92'
  ctx.setLineDash([3, 5])
  ctx.beginPath()
  ctx.moveTo(-w * 0.3, h * 0.1)
  ctx.lineTo(w * 0.3, h * 0.1)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#22251f'
  ctx.font = `700 ${Math.round(w * 0.028)}px "Courier New", monospace`
  ctx.fillText('TOTAL', -w * 0.3, h * 0.17)
  ctx.textAlign = 'right'
  ctx.font = `700 ${Math.round(w * 0.042)}px "Courier New", monospace`
  ctx.fillText('¥ 106.00', w * 0.3, h * 0.17)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#8b8d83'
  ctx.font = `400 ${Math.round(w * 0.02)}px "Courier New", monospace`
  ctx.fillText('PAID · WECHAT PAY', -w * 0.3, h * 0.22)
  ctx.fillText('订单号 20261016-084217', -w * 0.3, h * 0.25)

  for (let i = 0; i < 5; i += 1) {
    const y = h * 0.3 + i * h * 0.012
    ctx.fillStyle = i % 2 ? '#6c6e66' : '#3b3e37'
    ctx.fillRect(-w * 0.3, y, w * 0.25, 2.5)
    ctx.fillRect(w * 0.01, y, w * 0.29, 2.5)
    if (random() > 0.5) {
      ctx.fillRect(-w * 0.3, y + 8, w * (0.1 + random() * 0.2), 2)
    }
  }

  ctx.fillStyle = '#2a2d27'
  for (let i = 0; i < 64; i += 1) {
    const barWidth = (2 + (i % 3)) * 3
    ctx.fillRect(-w * 0.28 + i * w * 0.0088, h * 0.37, barWidth, h * 0.045)
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#5c5f56'
  ctx.font = `400 ${Math.round(w * 0.019)}px "Courier New", monospace`
  ctx.fillText('THANK YOU · COME AGAIN', 0, h * 0.35)
  ctx.textAlign = 'left'
  ctx.restore()
}

function drawOldMemory(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#6c7f9c')
  sky.addColorStop(0.5, '#d79d7c')
  sky.addColorStop(1, '#8c5f4e')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#f6d9a8'
  ctx.beginPath()
  ctx.arc(w * 0.7, h * 0.36, w * 0.09, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#5b3e3c'
  ctx.fillRect(0, h * 0.72, w, h * 0.28)
  ctx.fillStyle = '#3a272b'
  ctx.beginPath()
  ctx.ellipse(w * 0.42, h * 0.64, w * 0.035, h * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(w * 0.42, h * 0.52, w * 0.035, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(w * 0.57, h * 0.67, w * 0.03, h * 0.08, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(w * 0.57, h * 0.57, w * 0.03, 0, Math.PI * 2)
  ctx.fill()

  const wash = ctx.createLinearGradient(0, 0, w, h)
  wash.addColorStop(0, 'rgba(255,240,210,0.12)')
  wash.addColorStop(1, 'rgba(90,50,40,0.18)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, w, h)
  vignette(ctx, w, h, 0.5)
}

function drawMisty(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#93a4b4')
  sky.addColorStop(0.55, '#b8c4c9')
  sky.addColorStop(1, '#9ba8a5')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const layers = [
    { color: 'rgba(90,110,120,0.32)', y: 0.58, amp: 0.1, offset: 0.0 },
    { color: 'rgba(70,90,100,0.4)', y: 0.68, amp: 0.08, offset: 0.16 },
    { color: 'rgba(52,70,78,0.46)', y: 0.79, amp: 0.06, offset: 0.32 },
  ]
  layers.forEach((layer) => {
    ctx.beginPath()
    ctx.moveTo(0, h)
    ctx.lineTo(0, h * layer.y)
    for (let x = 0; x <= 1; x += 0.1) {
      const y =
        h * layer.y +
        Math.sin((x + layer.offset) * Math.PI * 2.2) * h * layer.amp +
        Math.sin((x + layer.offset) * Math.PI * 5.1) * h * 0.02
      ctx.lineTo(w * x, y)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fillStyle = layer.color
    ctx.fill()
  })

  ctx.fillStyle = 'rgba(230,238,236,0.18)'
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath()
    ctx.ellipse(w * (0.1 + i * 0.28), h * (0.4 + (i % 2) * 0.12), w * 0.3, h * 0.05, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function soften(canvas: HTMLCanvasElement, blur: number): HTMLCanvasElement {
  const { canvas: target, ctx } = makeCanvas(canvas.width, canvas.height)
  ctx.filter = `blur(${blur}px)`
  ctx.drawImage(canvas, 0, 0)
  ctx.filter = 'none'
  return target
}

const DAY = 24 * 60 * 60 * 1000

const SCENES: Array<{
  name: string
  width: number
  height: number
  daysAgo: number
  type?: string
  blur?: number
  draw: DrawFn
}> = [
  { name: '落日沙丘.jpg', width: 1600, height: 1200, daysAgo: 3, draw: (ctx, w, h) => drawDunes(ctx, w, h) },
  { name: '落日沙丘·另一张.jpg', width: 1600, height: 1200, daysAgo: 3, draw: (ctx, w, h) => drawDunes(ctx, w, h, 1) },
  { name: '海岸线.jpg', width: 1600, height: 1200, daysAgo: 8, draw: drawCoast },
  { name: '森林光束.jpg', width: 1200, height: 1600, daysAgo: 12, draw: drawForest },
  { name: '深夜拉面.jpg', width: 1400, height: 1200, daysAgo: 16, draw: drawRamen },
  { name: '草莓蛋糕.jpg', width: 1400, height: 1100, daysAgo: 22, draw: drawCake },
  { name: '城市夜色.jpg', width: 1400, height: 1100, daysAgo: 27, draw: drawNight },
  { name: '逆光肖像.jpg', width: 1080, height: 1440, daysAgo: 34, draw: drawPortrait },
  { name: '手机截图.png', width: 1080, height: 2340, daysAgo: 41, type: 'image/png', draw: drawScreenshot },
  { name: '购物小票.jpg', width: 1200, height: 1600, daysAgo: 47, draw: drawReceipt },
  { name: '雾中山谷.jpg', width: 1400, height: 1050, daysAgo: 58, blur: 6.5, draw: drawMisty },
  { name: '旧时光.jpg', width: 420, height: 315, daysAgo: 420, draw: drawOldMemory },
]

export async function generateDemoPhotos(): Promise<DemoPhoto[]> {
  const photos: DemoPhoto[] = []
  const now = Date.now()

  for (const scene of SCENES) {
    const { canvas, ctx } = makeCanvas(scene.width, scene.height)
    scene.draw(ctx, scene.width, scene.height)
    const output = scene.blur ? soften(canvas, scene.blur) : canvas
    const blob = await toBlob(output, scene.type ?? 'image/jpeg', 0.9)
    photos.push({
      blob,
      name: scene.name,
      takenAt: now - scene.daysAgo * DAY,
    })
  }

  const portrait = photos.find((photo) => photo.name === '逆光肖像.jpg')
  if (portrait) {
    const copy = new Blob([await portrait.blob.arrayBuffer()], { type: portrait.blob.type })
    photos.push({
      blob: copy,
      name: '逆光肖像·副本.jpg',
      takenAt: now - 33 * DAY,
    })
  }

  return photos
}
