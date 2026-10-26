import type { IconifyJSON } from '@iconify/types'
import { getIconData } from '@iconify/utils'
import { tablerName } from '~~/shared/icons'
import { MAP_CATEGORY_COLORS as COLORS, MAP_COLORS, MAP_PAPER as PAPER } from './map-colors'

const SIZE = 48
const SCALE = 2

async function tablerCollection() {
  const names = [...new Set(Object.keys(COLORS).map((id) => tablerName(id)))]
  const response = await fetch(`/api/_nuxt_icon/tabler?icons=${names.join(',')}`)
  if (!response.ok) {
    throw new Error('Tabler icons did not load')
  }
  return (await response.json()) as IconifyJSON
}

function tablerSvg(icons: IconifyJSON, name: string, px: number) {
  const data = getIconData(icons, name)
  if (!data) {
    throw new Error(`Missing Tabler icon: ${name}`)
  }
  const body = data.body.replaceAll('currentColor', PAPER)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${data.width} ${data.height}">${body}</svg>`
}

function loadSvg(markup: string) {
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  return image.decode().then(() => image)
}

async function pinCanvas(icons: IconifyJSON, color: string, name: string, sponsored: boolean) {
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
    ctx.strokeStyle = MAP_COLORS.amber
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + 10, cy - 11, 4.6, 0, Math.PI * 2)
    ctx.fillStyle = MAP_COLORS.amber
    ctx.fill()
    ctx.lineWidth = 1.4
    ctx.strokeStyle = PAPER
    ctx.stroke()
  }
  const glyph = await loadSvg(tablerSvg(icons, name, 22 * SCALE))
  const box = 16
  ctx.drawImage(glyph, cx - box / 2, cy - box / 2, box, box)
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
  ctx.fillStyle = MAP_COLORS.brick
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.arc(16, 16, 12, 0, Math.PI * 2)
  ctx.lineWidth = 2
  ctx.strokeStyle = PAPER
  ctx.stroke()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export async function loadMapImages() {
  const icons = await tablerCollection()
  const images: Record<string, ImageData> = { stop: stopCanvas() }
  await Promise.all(
    Object.keys(COLORS).map(async (id) => {
      const color = COLORS[id] || MAP_COLORS.brick
      const name = tablerName(id)
      images[id] = await pinCanvas(icons, color, name, false)
      images[`s-${id}`] = await pinCanvas(icons, color, name, true)
    }),
  )
  return images
}
