export interface ToastItem {
  id: number
  message: string
}

export const TOAST_MS = 2500

let nextId = 1

export function useToast() {
  const items = useState<ToastItem[]>('k39-toasts', () => [])

  function dismiss(id: number) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  function push(message: string) {
    const text = message.trim()
    if (!text) {
      return
    }
    const id = nextId
    nextId += 1
    items.value = [...items.value, { id, message: text }]
    if (import.meta.client) {
      window.setTimeout(() => dismiss(id), TOAST_MS)
    }
  }

  return { items, push, dismiss }
}
