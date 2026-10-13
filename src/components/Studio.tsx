import { useRef, useState, type ReactNode, type PointerEvent } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Grip,
  MoveDiagonal2,
  Plus,
  X,
} from 'lucide-react'
import type { Widget, WidgetType, Workspace } from '../core/model'
import { actions } from '../core/store'
import { defaultWidgets, uid } from '../core/presets'
import { BackgroundSettings } from './Background'
import { act } from '../core/ui'
import { widgetRegistry, widgetStyle } from './widgetRegistry'
import { placeWidget } from '../core/layout'
function reveal(workspace: Workspace, id: string) {
  const item = workspace.widgets.find((widget) => widget.id === id)
  if (item && !item.visible) workspace.widgets = placeWidget(workspace.widgets, id, item.layout)
}
export function WidgetFrame({
  widget,
  studio,
  selected,
  onSelect,
  children,
}: {
  widget: Widget
  studio: boolean
  selected: boolean
  onSelect: (id: string) => void
  children: ReactNode
}) {
  const [preview, setPreview] = useState<Widget['layout'] | null>(null)
  const gesture = useRef<{
    x: number
    y: number
    layout: Widget['layout']
    resize: boolean
    width: number
    row: number
  } | null>(null)
  const start = (event: PointerEvent, resize: boolean) => {
    if (event.button !== 0) return
    const canvas = event.currentTarget.closest('.widget-grid') as HTMLElement
    const style = getComputedStyle(canvas)
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      layout: { ...widget.layout },
      resize,
      width: (canvas.clientWidth + parseFloat(style.columnGap)) / 12,
      row: parseFloat(style.gridAutoRows) + parseFloat(style.rowGap),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(widget.id)
    event.preventDefault()
  }
  const move = (event: PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const dx = Math.round((event.clientX - g.x) / g.width)
    const dy = Math.round((event.clientY - g.y) / g.row)
    const min = widgetRegistry[widget.type]
    setPreview(
      g.resize
        ? {
            ...g.layout,
            w: Math.min(12 - g.layout.x, Math.max(min.minW, g.layout.w + dx)),
            h: Math.max(min.minH, Math.min(12, g.layout.h + dy)),
          }
        : {
            ...g.layout,
            x: Math.max(0, Math.min(12 - g.layout.w, g.layout.x + dx)),
            y: Math.max(0, Math.min(500, g.layout.y + dy)),
          },
    )
  }
  const end = () => {
    gesture.current = null
    if (preview)
      act(
        actions
          .workspace((w) => {
            const item = w.widgets.find((i) => i.id === widget.id)
            if (item) w.widgets = placeWidget(w.widgets, item.id, preview)
          })
          .finally(() => setPreview(null)),
      )
    else setPreview(null)
  }
  return (
    <article
      className={`widget card widget-${widget.type} ${studio ? 'editable' : ''} ${selected && studio ? 'selected' : ''}`}
      style={widgetStyle({ ...widget, layout: preview ?? widget.layout })}
      aria-label={widgetRegistry[widget.type].title}
      onClick={() => {
        if (studio) onSelect(widget.id)
      }}
    >
      {studio && (
        <div className="widget-edit-bar">
          <button
            className="drag-handle"
            aria-label={`Déplacer ${widgetRegistry[widget.type].title}`}
            onPointerDown={(e) => start(e, false)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={() => {
              gesture.current = null
              setPreview(null)
            }}
            onClick={() => onSelect(widget.id)}
          >
            <Grip size={14} />
            {widgetRegistry[widget.type].title}
          </button>
          <button
            className="icon-button"
            aria-label={`Masquer ${widgetRegistry[widget.type].title}`}
            onClick={() =>
              act(
                actions.workspace((w) => {
                  const item = w.widgets.find((i) => i.id === widget.id)
                  if (item) item.visible = false
                }),
              )
            }
          >
            <X size={14} />
          </button>
        </div>
      )}
      {children}
      {studio && (
        <button
          className="resize-handle"
          aria-label={`Redimensionner ${widgetRegistry[widget.type].title}`}
          onPointerDown={(e) => start(e, true)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={() => {
            gesture.current = null
            setPreview(null)
          }}
        >
          <MoveDiagonal2 size={17} />
        </button>
      )}
    </article>
  )
}
export function Studio({
  workspace,
  selected,
  onSelect,
  onClose,
}: {
  workspace: Workspace
  selected: string | null
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'widgets' | 'scene'>('widgets')
  const [zoneError, setZoneError] = useState('')
  const widget = workspace.widgets.find((w) => w.id === selected)
  const update = (fn: (widget: Widget) => void) =>
    act(
      actions.workspace((w) => {
        const item = w.widgets.find((i) => i.id === selected)
        if (item) {
          fn(item)
          if (item.type === 'clock' && item.settings.clockStyle === 'analog' && item.layout.h < 3)
            w.widgets = placeWidget(w.widgets, item.id, { ...item.layout, h: 3 })
        }
      }),
    )
  const layout = (key: keyof Widget['layout'], delta: number) => {
    if (!widget) return
    act(
      actions.workspace((space) => {
        const current = space.widgets.find((item) => item.id === widget.id)
        if (!current) return
        space.widgets = placeWidget(space.widgets, current.id, {
          ...current.layout,
          [key]: current.layout[key] + delta,
        })
      }),
    )
  }
  return (
    <aside className="studio-panel" aria-label="Studio de personnalisation">
      <div className="dialog-heading">
        <div>
          <h2>Studio</h2>
        </div>
        <button className="icon-button" aria-label="Fermer le Studio" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="segmented">
        <button aria-pressed={tab === 'widgets'} onClick={() => setTab('widgets')}>
          Widgets
        </button>
        <button aria-pressed={tab === 'scene'} onClick={() => setTab('scene')}>
          Décor
        </button>
      </div>
      {tab === 'scene' ? (
        <BackgroundSettings workspace={workspace} />
      ) : (
        <>
          <p className="muted tiny">
            Déplace les cartes par leur poignée, ou choisis-les pour les ajuster au clavier.
          </p>
          <div className="widget-library">
            {(Object.keys(widgetRegistry) as WidgetType[]).map((type) => {
              const existing = workspace.widgets.find((w) => w.type === type)
              const visible = existing?.visible
              return (
                <button
                  key={type}
                  className={visible ? 'available' : ''}
                  onClick={() => {
                    if (existing) {
                      act(
                        actions.workspace((w) => {
                          reveal(w, existing.id)
                        }),
                      )
                      onSelect(existing.id)
                    } else {
                      const fresh = {
                        ...defaultWidgets().find((w) => w.type === type)!,
                        id: uid(),
                        visible: true,
                      }
                      act(
                        actions.workspace((w) => {
                          w.widgets.push(fresh)
                          w.widgets = placeWidget(w.widgets, fresh.id, fresh.layout)
                        }),
                      )
                      onSelect(fresh.id)
                    }
                  }}
                >
                  <span>
                    <strong>{widgetRegistry[type].title}</strong>
                    <small>{widgetRegistry[type].description}</small>
                  </span>
                  {visible ? <span className="tiny">Visible</span> : <Plus size={16} />}
                </button>
              )
            })}
          </div>
          {workspace.widgets.filter((w) => w.type === 'clock').length > 1 && (
            <div className="clock-instances">
              <h3>Toutes les horloges</h3>
              {workspace.widgets
                .filter((w) => w.type === 'clock')
                .map((w, i) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      act(
                        actions.workspace((space) => {
                          reveal(space, w.id)
                        }),
                      )
                      onSelect(w.id)
                    }}
                  >
                    Horloge {i + 1} · {w.visible ? 'Visible' : 'Masquée'}
                  </button>
                ))}
            </div>
          )}
          {widget && (
            <section className="widget-properties">
              <h3>{widgetRegistry[widget.type].title}</h3>
              <div className="row wrap">
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={widget.visible}
                    onChange={(e) => {
                      const value = e.currentTarget.checked
                      act(
                        actions.workspace((space) => {
                          if (value) reveal(space, widget.id)
                          else {
                            const current = space.widgets.find((item) => item.id === widget.id)
                            if (current) current.visible = false
                          }
                        }),
                      )
                    }}
                  />{' '}
                  Afficher
                </label>
                {widget.type === 'clock' && (
                  <button
                    onClick={() => {
                      const copy = structuredClone(widget)
                      copy.id = uid()
                      copy.layout.y = Math.max(
                        0,
                        ...workspace.widgets
                          .filter((w) => w.visible)
                          .map((w) => w.layout.y + w.layout.h),
                      )
                      act(
                        actions.workspace((w) => {
                          w.widgets.push(copy)
                          w.widgets = placeWidget(w.widgets, copy.id, copy.layout)
                        }),
                      )
                      onSelect(copy.id)
                    }}
                  >
                    <Copy size={14} /> Dupliquer
                  </button>
                )}
              </div>
              <label className="field">
                Opacité de la carte <span>{Math.round(widget.style.opacity * 100)} %</span>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={widget.style.opacity}
                  onChange={(e) => {
                    const value = Number(e.currentTarget.value)
                    update((w) => {
                      w.style.opacity = value
                    })
                  }}
                />
              </label>
              <div className="layout-controls">
                <span>Position</span>
                <button
                  className="icon-button"
                  aria-label="Déplacer à gauche"
                  onClick={() => layout('x', -1)}
                >
                  <ArrowLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Déplacer à droite"
                  onClick={() => layout('x', 1)}
                >
                  <ArrowRight size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Déplacer vers le haut"
                  onClick={() => layout('y', -1)}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Déplacer vers le bas"
                  onClick={() => layout('y', 1)}
                >
                  <ArrowDown size={17} />
                </button>
              </div>
              <div className="layout-controls">
                <span>Largeur {widget.layout.w}</span>
                <button aria-label="Réduire la largeur" onClick={() => layout('w', -1)}>
                  −
                </button>
                <button aria-label="Augmenter la largeur" onClick={() => layout('w', 1)}>
                  +
                </button>
              </div>
              <div className="layout-controls">
                <span>Hauteur {widget.layout.h}</span>
                <button aria-label="Réduire la hauteur" onClick={() => layout('h', -1)}>
                  −
                </button>
                <button aria-label="Augmenter la hauteur" onClick={() => layout('h', 1)}>
                  +
                </button>
              </div>
              <p className="tiny muted">
                Sur mobile, les cartes s’empilent dans un ordre de lecture simple.
              </p>
              {widget.type === 'clock' && (
                <>
                  <label className="field">
                    Affichage
                    <select
                      value={widget.settings.clockStyle ?? 'digital'}
                      onChange={(e) => {
                        const value = e.currentTarget.value as 'digital' | 'analog'
                        update((w) => {
                          w.settings.clockStyle = value
                        })
                      }}
                    >
                      <option value="digital">Numérique</option>
                      <option value="analog">À aiguilles</option>
                    </select>
                  </label>
                  <label className="field">
                    Format
                    <select
                      value={widget.settings.clockFormat ?? '24'}
                      onChange={(e) => {
                        const value = e.currentTarget.value as '12' | '24'
                        update((w) => {
                          w.settings.clockFormat = value
                        })
                      }}
                    >
                      <option value="24">24 heures</option>
                      <option value="12">12 heures</option>
                    </select>
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={!!widget.settings.showSeconds}
                      onChange={(e) => {
                        const value = e.currentTarget.checked
                        update((w) => {
                          w.settings.showSeconds = value
                        })
                      }}
                    />{' '}
                    Secondes
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={widget.settings.showDate !== false}
                      onChange={(e) => {
                        const value = e.currentTarget.checked
                        update((w) => {
                          w.settings.showDate = value
                        })
                      }}
                    />{' '}
                    Date
                  </label>
                  <label className="field">
                    Fuseau horaire
                    <input
                      key={widget.id}
                      defaultValue={widget.settings.timezone ?? ''}
                      placeholder="Système · ex. Europe/Paris"
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        try {
                          new Intl.DateTimeFormat('fr', { timeZone: value || undefined })
                          setZoneError('')
                          update((w) => {
                            w.settings.timezone = value
                          })
                        } catch {
                          setZoneError('Ce fuseau n’est pas reconnu. Exemple : Europe/Paris.')
                        }
                      }}
                    />
                  </label>
                  {zoneError && (
                    <p role="alert" className="tiny">
                      {zoneError}
                    </p>
                  )}
                  <label className="field">
                    Couleur de l’horloge
                    <input
                      type="color"
                      aria-label="Couleur de l’horloge"
                      value={
                        widget.settings.color ??
                        (workspace.palette === 'minimal' ? '#35473d' : '#eee8e1')
                      }
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        update((current) => {
                          current.settings.color = value
                        })
                      }}
                    />
                  </label>
                  {widget.settings.color && (
                    <button
                      className="text-button"
                      onClick={() =>
                        update((current) => {
                          delete current.settings.color
                        })
                      }
                    >
                      Couleur du thème
                    </button>
                  )}
                  <label className="field">
                    Ombre de l’horloge
                    <select
                      value={widget.settings.shadow ?? 'none'}
                      onChange={(event) => {
                        const value = event.currentTarget.value as 'none' | 'soft' | 'strong'
                        update((current) => {
                          current.settings.shadow = value
                        })
                      }}
                    >
                      <option value="none">Aucune</option>
                      <option value="soft">Légère</option>
                      <option value="strong">Marquée</option>
                    </select>
                  </label>
                  <label className="field">
                    Typographie
                    <select
                      value={widget.settings.typography ?? 'sans'}
                      onChange={(e) => {
                        const value = e.currentTarget.value as 'sans' | 'serif'
                        update((w) => {
                          w.settings.typography = value
                        })
                      }}
                    >
                      <option value="sans">Simple</option>
                      <option value="serif">Littéraire</option>
                    </select>
                  </label>
                  <label className="field">
                    Alignement
                    <select
                      value={widget.settings.alignment ?? 'left'}
                      onChange={(e) => {
                        const value = e.currentTarget.value as 'left' | 'center'
                        update((w) => {
                          w.settings.alignment = value
                        })
                      }}
                    >
                      <option value="left">À gauche</option>
                      <option value="center">Centré</option>
                    </select>
                  </label>
                  <label className="field">
                    Taille
                    <select
                      value={widget.settings.clockSize ?? 'large'}
                      onChange={(e) => {
                        const value = e.currentTarget.value as 'small' | 'large'
                        update((w) => {
                          w.settings.clockSize = value
                        })
                      }}
                    >
                      <option value="large">Grande</option>
                      <option value="small">Discrète</option>
                    </select>
                  </label>
                </>
              )}
            </section>
          )}
        </>
      )}
    </aside>
  )
}
