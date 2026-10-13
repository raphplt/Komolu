import type { Widget, WidgetType } from './model'

export const WIDGET_MIN_SIZE: Record<WidgetType, { minW: number; minH: number }> = {
  clock: { minW: 2, minH: 3 },
  timer: { minW: 3, minH: 5 },
  tasks: { minW: 3, minH: 4 },
  notes: { minW: 2, minH: 3 },
  audio: { minW: 3, minH: 4 },
}
const MAX_ROW = 500
export function clampLayout(type: WidgetType, proposed: Widget['layout']): Widget['layout'] {
  const min = WIDGET_MIN_SIZE[type]
  const w = Math.max(min.minW, Math.min(12, Math.round(proposed.w)))
  return {
    x: Math.max(0, Math.min(12 - w, Math.round(proposed.x))),
    y: Math.max(0, Math.min(MAX_ROW, Math.round(proposed.y))),
    w,
    h: Math.max(min.minH, Math.min(12, Math.round(proposed.h))),
  }
}
export function overlaps(a: Widget['layout'], b: Widget['layout']): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
/** Apply one explicit edit. Keep its requested position, moving conflicting cards down.
 * Unaffected positions and hidden widgets remain unchanged. Nothing runs during rendering.
 */
export function placeWidget(widgets: Widget[], id: string, proposed: Widget['layout']): Widget[] {
  const target = widgets.find((widget) => widget.id === id)
  if (!target) return widgets
  const next = new Map<string, Widget>()
  const edited = { ...target, visible: true, layout: clampLayout(target.type, proposed) }
  next.set(id, edited)
  const occupied = [edited.layout]
  const others = widgets
    .filter((widget) => widget.visible && widget.id !== id)
    .sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x || a.id.localeCompare(b.id))
  for (const widget of others) {
    let candidate = { ...widget.layout }
    while (occupied.some((layout) => overlaps(candidate, layout))) {
      candidate.y = Math.max(
        ...occupied
          .filter((layout) => overlaps(candidate, layout))
          .map((layout) => layout.y + layout.h),
      )
      if (candidate.y > MAX_ROW) {
        // A crowded bottom row may still have room elsewhere in the bounded canvas.
        let free: Widget['layout'] | undefined
        for (let y = 0; y <= MAX_ROW && !free; y++) {
          for (let x = 0; x <= 12 - candidate.w; x++) {
            const position = { ...candidate, x, y }
            if (!occupied.some((layout) => overlaps(position, layout))) {
              free = position
              break
            }
          }
        }
        if (!free) throw new Error('La grille est pleine. Masque un widget avant de le déplacer.')
        candidate = free
        break
      }
    }
    occupied.push(candidate)
    if (candidate.x !== widget.layout.x || candidate.y !== widget.layout.y)
      next.set(widget.id, { ...widget, layout: candidate })
  }
  return widgets.map((widget) => next.get(widget.id) ?? widget)
}
