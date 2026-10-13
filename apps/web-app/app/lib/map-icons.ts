const COLORS: Record<string, string> = {
  forty: '#a3402a',
  zamki: '#2e5743',
  plyazhi: '#355468',
  muzei: '#7a4c0b',
  tserkvi: '#7a2e1f',
  kurorty: '#8f5a00',
  coffee: '#355468',
  cafe: '#2e5743',
  restaurant: '#7a2e1f',
  bakery: '#8f5a00',
  bar: '#355468',
  market: '#2e5743',
  fastfood: '#a3402a',
  other: '#6a5d52',
  eda: '#7a4c0b',
}

type Draw = (ctx: CanvasRenderingContext2D) => void

const PAPER = '#fffbf3'

function stroke(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = PAPER
  ctx.fillStyle = PAPER
  ctx.lineWidth = 1.7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function fort(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.moveTo(-9, 8)
  ctx.lineTo(-9, -1)
  ctx.lineTo(-6, -1)
  ctx.lineTo(-6, -6)
  ctx.lineTo(-2, -6)
  ctx.lineTo(-2, -1)
  ctx.lineTo(2, -1)
  ctx.lineTo(2, -6)
  ctx.lineTo(6, -6)
  ctx.lineTo(6, -1)
  ctx.lineTo(9, -1)
  ctx.lineTo(9, 8)
  ctx.closePath()
  ctx.fill()
}

function castle(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.moveTo(-8, 8)
  ctx.lineTo(-8, -1)
  ctx.lineTo(-5, -1)
  ctx.lineTo(-5, -7)
  ctx.lineTo(-1, -7)
  ctx.lineTo(-1, -1)
  ctx.lineTo(1, -1)
  ctx.lineTo(1, -7)
  ctx.lineTo(5, -7)
  ctx.lineTo(5, -1)
  ctx.lineTo(8, -1)
  ctx.lineTo(8, 8)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-2, 8)
  ctx.lineTo(-2, 3)
  ctx.lineTo(2, 3)
  ctx.lineTo(2, 8)
  ctx.stroke()
}

function beach(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.arc(0, 0, 7, Math.PI, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 8)
  ctx.moveTo(0, 8)
  ctx.quadraticCurveTo(3.2, 8, 3.2, 5.2)
  ctx.stroke()
}

function museum(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.moveTo(-9, -1)
  ctx.lineTo(0, -8)
  ctx.lineTo(9, -1)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(-7, 0, 2.2, 8)
  ctx.fillRect(-1.1, 0, 2.2, 8)
  ctx.fillRect(4.8, 0, 2.2, 8)
  ctx.fillRect(-8, 8, 16, 1.6)
}

function church(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.fillRect(-1.35, -8, 2.7, 16)
  ctx.fillRect(-6.2, -2.6, 12.4, 2.7)
}

function sun(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.arc(0, 0, 4.2, 0, Math.PI * 2)
  ctx.fill()
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(angle) * 6.4, Math.sin(angle) * 6.4)
    ctx.lineTo(Math.cos(angle) * 9, Math.sin(angle) * 9)
    ctx.stroke()
  }
}

function cup(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.moveTo(-6, -4)
  ctx.lineTo(-4.4, 4)
  ctx.quadraticCurveTo(0, 8, 4.4, 4)
  ctx.lineTo(6, -4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(7.2, 0, 2.6, -1.15, 1.15)
  ctx.stroke()
}

function utensils(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.moveTo(-4.5, -8)
  ctx.lineTo(-4.5, 8)
  ctx.moveTo(-6.4, -8)
  ctx.lineTo(-6.4, -3)
  ctx.moveTo(-2.6, -8)
  ctx.lineTo(-2.6, -3)
  ctx.moveTo(3.2, -8)
  ctx.lineTo(5.6, -1)
  ctx.lineTo(3.2, -1)
  ctx.lineTo(3.2, 8)
  ctx.stroke()
}

function loaf(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.moveTo(-8, 6)
  ctx.quadraticCurveTo(-8, -6, 0, -6)
  ctx.quadraticCurveTo(8, -6, 8, 6)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, -6)
  ctx.lineTo(0, 6)
  ctx.stroke()
}

function glass(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.moveTo(-5, -7)
  ctx.lineTo(-2.2, 3)
  ctx.lineTo(2.2, 3)
  ctx.lineTo(5, -7)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, 3)
  ctx.lineTo(0, 7)
  ctx.moveTo(-3.4, 8)
  ctx.lineTo(3.4, 8)
  ctx.stroke()
}

function basket(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.moveTo(-8, -1)
  ctx.lineTo(-6, 8)
  ctx.lineTo(6, 8)
  ctx.lineTo(8, -1)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -1, 5, Math.PI, 0)
  ctx.stroke()
}

function burger(ctx: CanvasRenderingContext2D) {
  stroke(ctx)
  ctx.beginPath()
  ctx.moveTo(-7, -1)
  ctx.quadraticCurveTo(-7, -7, 0, -7)
  ctx.quadraticCurveTo(7, -7, 7, -1)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-7, 1)
  ctx.lineTo(7, 1)
  ctx.moveTo(-7, 4)
  ctx.quadraticCurveTo(0, 8, 7, 4)
  ctx.stroke()
}

const GLYPHS: Record<string, Draw> = {
  forty: fort,
  zamki: castle,
  plyazhi: beach,
  muzei: museum,
  tserkvi: church,
  kurorty: sun,
  coffee: cup,
  cafe: cup,
  restaurant: utensils,
  bakery: loaf,
  bar: glass,
  market: basket,
  fastfood: burger,
  other: utensils,
  eda: utensils,
}

const SIZE = 48
const SCALE = 2

function pinCanvas(color: string, glyph: Draw, sponsored: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE * SCALE
  canvas.height = SIZE * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas is unavailable')
  }
  ctx.scale(SCALE, SCALE)
  const cx = 24
  const cy = 23
  const radius = 15
  ctx.save()
  ctx.shadowColor = 'rgba(43, 36, 32, 0.28)'
  ctx.shadowBlur = 5
  ctx.shadowOffsetY = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, radius - 0.4, 0, Math.PI * 2)
  ctx.strokeStyle = PAPER
  ctx.lineWidth = 2
  ctx.stroke()
  if (sponsored) {
    ctx.beginPath()
    ctx.arc(cx, cy, radius + 2.4, 0, Math.PI * 2)
    ctx.strokeStyle = '#d68a22'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + 10, cy - 11, 4.6, 0, Math.PI * 2)
    ctx.fillStyle = '#d68a22'
    ctx.fill()
    ctx.lineWidth = 1.4
    ctx.strokeStyle = PAPER
    ctx.stroke()
  }
  ctx.save()
  ctx.translate(cx, cy)
  glyph(ctx)
  ctx.restore()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function stopCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = 32 * SCALE
  canvas.height = 32 * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas is unavailable')
  }
  ctx.scale(SCALE, SCALE)
  ctx.save()
  ctx.shadowColor = 'rgba(43, 36, 32, 0.28)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1
  ctx.beginPath()
  ctx.arc(16, 16, 12, 0, Math.PI * 2)
  ctx.fillStyle = '#a3402a'
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.arc(16, 16, 12, 0, Math.PI * 2)
  ctx.lineWidth = 2
  ctx.strokeStyle = PAPER
  ctx.stroke()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function mapImages() {
  const images: Record<string, ImageData> = { stop: stopCanvas() }
  for (const [id, glyph] of Object.entries(GLYPHS)) {
    const color = COLORS[id] || '#a3402a'
    images[id] = pinCanvas(color, glyph, false)
    images[`s-${id}`] = pinCanvas(color, glyph, true)
  }
  return images
}
