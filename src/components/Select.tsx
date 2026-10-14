import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { Check, ChevronDown } from 'lucide-react'

type Option = { value: string; label: ReactNode; disabled?: boolean }
function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean }>(child))
      return []
    if (child.type === 'option')
      return [
        {
          value: String(child.props.value ?? ''),
          label: child.props.children,
          disabled: child.props.disabled,
        },
      ]
    return readOptions(child.props.children)
  })
}

function menuPosition(rect: DOMRect, count: number) {
  const below = window.innerHeight - rect.bottom - 12
  const above = rect.top - 12
  const height = Math.min(280, count * 42 + 12)
  const upward = below < height && above > below
  const maxHeight = Math.max(40, Math.min(height, upward ? above : below))
  return {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
    top: upward ? rect.top - maxHeight - 6 : rect.bottom + 6,
    width: rect.width,
    maxHeight,
  }
}

export function Select({
  value,
  onChange,
  children,
  'aria-label': label,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  'aria-label'?: string
  disabled?: boolean
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const options = readOptions(children)
  const selected = options.findIndex((option) => option.value === value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 280 })
  useEffect(() => {
    if (!open) return
    const reposition = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return
      if (trigger.current)
        setPosition(menuPosition(trigger.current.getBoundingClientRect(), options.length))
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, options.length])
  const show = () => {
    const rect = trigger.current!.getBoundingClientRect()
    setPosition(menuPosition(rect, options.length))
    setActive(Math.max(0, selected))
    menu.current?.showPopover()
  }
  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    menu.current?.hidePopover()
    trigger.current?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      if (!open) {
        show()
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        choose(active)
        return
      }
      const direction = event.key === 'ArrowUp' ? -1 : 1
      let next =
        event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : active + direction
      next = Math.max(0, Math.min(options.length - 1, next))
      while (options[next]?.disabled && next >= 0 && next < options.length) next += direction
      if (options[next] && !options[next].disabled) {
        setActive(next)
        menu.current?.children[next]?.scrollIntoView({ block: 'nearest' })
      }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      menu.current?.hidePopover()
    } else if (event.key === 'Tab') menu.current?.hidePopover()
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      const next = options.findIndex(
        (option) =>
          !option.disabled &&
          String(option.label).toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()),
      )
      if (next >= 0) {
        event.preventDefault()
        if (open) setActive(next)
        else choose(next)
      }
    }
  }
  return (
    <span className="custom-select">
      <button
        ref={trigger}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        data-value={value}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onClick={() => (open ? menu.current?.hidePopover() : show())}
      >
        <span>{options[selected]?.label ?? 'Choisir…'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        role="listbox"
        aria-label={label}
        className="select-menu"
        style={position}
        onToggle={(event) => setOpen(event.newState === 'open')}
      >
        {options.map((option, index) => (
          <div
            id={`${id}-${index}`}
            key={option.value}
            role="option"
            data-value={option.value}
            aria-selected={option.value === value}
            aria-disabled={option.disabled || undefined}
            className={`select-option ${index === active ? 'active' : ''}`}
            onPointerMove={() => !option.disabled && setActive(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              choose(index)
            }}
          >
            <span>{option.label}</span>
            {option.value === value && <Check size={16} aria-hidden="true" />}
          </div>
        ))}
      </div>
    </span>
  )
}
