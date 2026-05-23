export const CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 48

export interface ChatScrollMetrics {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}

export function isChatScrolledToBottom(
  metrics: ChatScrollMetrics,
  threshold = CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX
): boolean {
  const distanceFromBottom = metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight
  return distanceFromBottom <= threshold
}
