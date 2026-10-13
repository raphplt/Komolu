import { describe, expect, it } from 'vitest'
import { clampLayout, overlaps, placeWidget } from './layout'
import type { Widget } from './model'

const card = (id: string, x: number, y: number, w = 3, h = 3): Widget => ({
  id,
  type: 'clock',
  version: 1,
  visible: true,
  layout: { x, y, w, h },
  style: { opacity: 1 },
  settings: {},
})
function expectNoOverlap(widgets: Widget[]) {
  const visible = widgets.filter((widget) => widget.visible)
  for (let i = 0; i < visible.length; i++)
    for (let j = i + 1; j < visible.length; j++)
      expect(overlaps(visible[i].layout, visible[j].layout)).toBe(false)
}

describe('explicit Studio layout changes', () => {
  it('keeps the requested keyboard position and moves an intersecting timer below it', () => {
    const widgets = [
      card('clock', 0, 0),
      { ...card('timer', 3, 0, 5, 6), type: 'timer' as const },
      card('notes', 0, 3),
      card('tasks', 8, 0, 4, 6),
    ]
    const original = structuredClone(widgets)
    const result = placeWidget(widgets, 'clock', { x: 1, y: 0, w: 3, h: 3 })
    expect(result[0].layout).toEqual({ x: 1, y: 0, w: 3, h: 3 })
    expect(result[1].layout.y).toBe(3)
    expect(result[2]).toBe(widgets[2])
    expect(result[3]).toBe(widgets[3])
    expect(widgets).toEqual(original)
    expectNoOverlap(result)
  })
  it('resolves cascading collisions after resizing without losing widgets', () => {
    const widgets = [card('a', 0, 0), card('b', 0, 3), card('c', 0, 6)]
    const result = placeWidget(widgets, 'a', { x: 0, y: 0, w: 3, h: 7 })
    expect(result.map((widget) => widget.layout.y)).toEqual([0, 7, 10])
    expectNoOverlap(result)
    expect(placeWidget(widgets, 'a', result[0].layout)).toEqual(result)
  })
  it('reveals an old undersized audio widget with its minimum size and clear space', () => {
    const audio = { ...card('audio', 0, 0, 2, 2), type: 'audio' as const, visible: false }
    const hidden = { ...card('hidden', 0, 0), visible: false }
    const result = placeWidget([card('clock', 0, 0), audio, hidden], 'audio', audio.layout)
    expect(result[1].visible).toBe(true)
    expect(result[1].layout).toEqual({ x: 0, y: 0, w: 3, h: 4 })
    expect(result[2]).toBe(hidden)
    expectNoOverlap(result)
  })
  it('keeps edits inside the exported schema bounds and finds room near the bottom', () => {
    expect(clampLayout('timer', { x: 99, y: -5, w: 1, h: 1 })).toEqual({ x: 9, y: 0, w: 3, h: 5 })
    const widgets = [card('a', 0, 500, 12, 12), card('b', 0, 488, 12, 12)]
    const result = placeWidget(widgets, 'b', { x: 0, y: 500, w: 12, h: 12 })
    expect(result.every((widget) => widget.layout.y <= 500)).toBe(true)
    expectNoOverlap(result)
  })
})
