import type { ToastTone } from '../components/ui/Toast'

export type ToastListener = (message: string, tone: ToastTone) => void

const listeners = new Set<ToastListener>()

export function subscribeToToasts(listener: ToastListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function showToast(message: string, tone: ToastTone = 'info'): void {
  for (const listener of listeners) {
    listener(message, tone)
  }
}

