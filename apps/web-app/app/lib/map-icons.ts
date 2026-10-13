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

function fill(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#fffbf3'
}

function fort(ctx: CanvasRenderingContext2D) {
  fill(ctx)
  ctx.fillRect(-11, -2, 22, 12)
  for (const x of [-11, -3, 5]) {
    ctx.fillRect(x, -8, 5, 6)
  }
}

function castle(ctx: CanvasRenderingContext2D) {
  fill(ctx)
  ctx.fillRect(-10, 0, 20, 10)
  ctx.beginPath()
  ctx.moveTo(-5, 0)
  ctx.lineTo(0, -9)
  ctx.lineTo(5, 0)
  ctx.fill()
  ctx.fillRect(-1.4, -2, 2.8, 12)
}

function beach(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#fffbf3'
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(-5, 2, 5, Math.PI, 0)
  ctx.arc(5, 2, 5, Math.PI, 0)
  ctx.stroke()
}

function museum(ctx: CanvasRenderingContext2D) {
  fill(ctx)
  ctx.beginPath()
  ctx.moveTo(-11, -2)
  ctx.lineTo(0, -9)
  ctx.lineTo(11, -2)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(-9, -2, 3, 11)
  ctx.fillRect(-1.5, -2, 3, 11)
  ctx.fillRect(6, -2, 3, 11)
  ctx.fillRect(-10, 9, 20, 2)
}

function church(ctx: CanvasRenderingContext2D) {
  fill(ctx)
  ctx.beginPath()
  ctx.arc(0, 4, 8, Math.PI, 0)
  ctx.lineTo(8, 11)
  ctx.lineTo(-8, 11)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(-1.3, -9, 2.6, 8)
  ctx.fillRect(-4.2, -7, 8.4, 2.4)
}

function sun(ctx: CanvasRenderingContext2D) {
  fill(ctx)
  ctx.beginPath()
  ctx.arc(0, 0, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fffbf3'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(angle) * 7.5, Math.sin(angle) * 7.5)
    ctx.lineTo(Math.cos(angle) * 11, Math.sin(angle) * 11)
    ctx.stroke()
  }
}

function cup(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#fffbf3'
  ctx.fillStyle = '#fffbf3'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-7, -4)
  ctx.lineTo(-5, 6)
  ctx.quadraticCurveTo(0, 10, 5, 6)
  ctx.lineTo(7, -4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(8, 0, 3.2, -1.2, 1.2)
  ctx.stroke()
}

function plate(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#fffbf3'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(0, 1, 10, 6, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, 1, 4, 2.2, 0, 0, Math.PI * 2)
  ctx.stroke()
}

function loaf(ctx: CanvasRenderingContext2D) {
  fill(ctx)
  ctx.beginPath()
  ctx.moveTo(-9, 6)
  ctx.quadraticCurveTo(-9, -6, 0, -6)
  ctx.quadraticCurveTo(9, -6, 9, 6)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#8f5a00'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(-4, 6)
  ctx.quadraticCurveTo(-4, -1, 0, -1)
  ctx.quadraticCurveTo(4, -1, 4, 6)
  ctx.stroke()
}

function glass(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#fffbf3'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-6, -7)
  ctx.lineTo(-3, 4)
  ctx.lineTo(3, 4)
  ctx.lineTo(6, -7)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, 4)
  ctx.lineTo(0, 8)
  ctx.moveTo(-4, 9)
  ctx.lineTo(4, 9)
  ctx.stroke()
}

function basket(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#fffbf3'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-9, -1)
  ctx.lineTo(-6, 8)
  ctx.lineTo(6, 8)
  ctx.lineTo(9, -1)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -1, 6, Math.PI, 0)
  ctx.stroke()
}

function bag(ctx: CanvasRenderingContext2D) {
  fill(ctx)
  ctx.fillRect(-7, -2, 14, 12)
  ctx.strokeStyle = '#fffbf3'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, -2, 4, Math.PI, 0)
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
  restaurant: plate,
  bakery: loaf,
  bar: glass,
  market: basket,
  fastfood: bag,
  other: cup,
  eda: plate,
}

function pinCanvas(color: string, glyph: Draw) {
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = 48 * scale
  canvas.height = 56 * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas is unavailable')
  }
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.arc(24, 22, 16, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#fffbf3'
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(16, 32)
  ctx.lineTo(24, 52)
  ctx.lineTo(32, 32)
  ctx.fillStyle = color
  ctx.fill()
  ctx.save()
  ctx.translate(24, 22)
  glyph(ctx)
  ctx.restore()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function stopCanvas() {
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = 28 * scale
  canvas.height = 28 * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas is unavailable')
  }
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.arc(14, 14, 12, 0, Math.PI * 2)
  ctx.fillStyle = '#a3402a'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#fffbf3'
  ctx.stroke()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function mapImages() {
  const images: Record<string, ImageData> = { stop: stopCanvas() }
  for (const [id, glyph] of Object.entries(GLYPHS)) {
    images[id] = pinCanvas(COLORS[id] || '#a3402a', glyph)
  }
  return images
}
