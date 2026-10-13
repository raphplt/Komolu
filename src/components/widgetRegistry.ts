import type { CSSProperties } from 'react'
import type { Widget, WidgetType } from '../core/model'
import { WIDGET_MIN_SIZE } from '../core/layout'
export const widgetRegistry: Record<
  WidgetType,
  { title: string; description: string; minW: number; minH: number }
> = {
  clock: { title: 'Horloge', description: 'Heure et date', ...WIDGET_MIN_SIZE.clock },
  timer: { title: 'Minuterie', description: 'Sessions et pauses', ...WIDGET_MIN_SIZE.timer },
  tasks: { title: 'Tâches', description: 'Liste et tâche active', ...WIDGET_MIN_SIZE.tasks },
  notes: { title: 'Bloc-notes', description: 'Texte libre', ...WIDGET_MIN_SIZE.notes },
  audio: { title: 'Ambiances', description: 'Lecture et volume', ...WIDGET_MIN_SIZE.audio },
}
export function widgetStyle(widget: Widget): CSSProperties {
  return {
    gridColumn: `${widget.layout.x + 1} / span ${widget.layout.w}`,
    gridRow: `${widget.layout.y + 1} / span ${widget.layout.h}`,
    '--widget-opacity': widget.style.opacity,
  } as CSSProperties
}
