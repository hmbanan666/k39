const MAX = 2
let active = 0
const waiting: Array<() => void> = []

export async function withMediaSlot<T>(task: () => Promise<T>) {
  if (active >= MAX) {
    await new Promise<void>((resolve) => {
      waiting.push(resolve)
    })
  }
  active += 1
  try {
    return await task()
  } finally {
    active -= 1
    const next = waiting.shift()
    if (next) {
      next()
    }
  }
}

export function mediaSlotDepth() {
  return active
}
