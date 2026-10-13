import type { CSSProperties } from 'react'
import type { Widget, WidgetType } from '../core/model'
export const widgetRegistry: Record<
  WidgetType,
  { title: string; description: string; minW: number; minH: number }
> = {
  clock: { title: 'Horloge', description: 'Ici et maintenant', minW: 2, minH: 2 },
  timer: { title: 'Minuterie', description: 'Ton rythme, sans pression', minW: 3, minH: 5 },
  tasks: { title: 'Tâches', description: 'Un petit pas à la fois', minW: 3, minH: 4 },
  notes: { title: 'Bloc-notes', description: 'Garde un fil pour plus tard', minW: 2, minH: 3 },
  audio: { title: 'Ambiances', description: 'Le son de ton petit coin', minW: 3, minH: 4 },
}
export function widgetStyle(widget: Widget): CSSProperties {
  return {
    gridColumn: `${widget.layout.x + 1} / span ${widget.layout.w}`,
    gridRow: `${widget.layout.y + 1} / span ${widget.layout.h}`,
    '--widget-opacity': widget.style.opacity,
  } as CSSProperties
}
