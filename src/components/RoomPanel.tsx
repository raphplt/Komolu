import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Crown,
  Lock,
  LogOut,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  SkipForward,
  Timer,
  Unlock,
  UserX,
  Users,
} from 'lucide-react'
import type { RoomController } from '../hooks/useRoom'
import {
  INVITE_TTL_CHOICES,
  inviteLink,
  parseInvite,
  type PresenceStatus,
  type TimerControl,
} from '../collab/protocol'
import { TIMER_PROFILES, formatDuration, timerValue } from '../core/timer'
import type { TimerState } from '../core/model'
import { Select } from './Select'
import './room.css'

export function RoomPanel({
  roomController,
}: {
  roomController: RoomController
  onClose?: () => void
}) {
  const { snapshot, pendingInvite, actions } = roomController
  const { phase, room, you, error, ended } = snapshot

  const [tab, setTab] = useState<'members' | 'chat' | 'timer' | 'settings'>('members')
  const [copied, setCopied] = useState(false)

  // Persist pseudo in localStorage for convenience
  const [pseudo, setPseudo] = useState(() => {
    try {
      return localStorage.getItem('komolu.nickname') || ''
    } catch {
      return ''
    }
  })

  // Mode for unjoined: 'join' or 'create'
  const [mode, setMode] = useState<'join' | 'create'>(() => (pendingInvite ? 'join' : 'create'))
  const [inviteInput, setInviteInput] = useState(() =>
    pendingInvite
      ? inviteLink(window.location.href, pendingInvite.roomId, pendingInvite.invite)
      : '',
  )
  const [ttlMs, setTtlMs] = useState(24 * 60 * 60_000)
  const [status, setStatus] = useState<PresenceStatus>('auto')
  const [profileId, setProfileId] = useState(TIMER_PROFILES[0].id)
  const [chatDraft, setChatDraft] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isHost = room?.members.find((m) => m.id === you)?.host ?? false

  // Save pseudo on change
  const handlePseudoChange = (val: string) => {
    setPseudo(val)
    try {
      localStorage.setItem('komolu.nickname', val)
    } catch {
      // Ignore
    }
  }

  // Scroll chat to bottom when new messages arrive or when switching to chat tab
  useEffect(() => {
    if (tab === 'chat') {
      actions.markRead()
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [tab, snapshot.messages.length, actions])

  const handleCopyLink = () => {
    if (!room?.invite) return
    const link = inviteLink(window.location.href, room.id, room.invite.code)
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const name = pseudo.trim() || 'Alex'
    const profile = TIMER_PROFILES.find((p) => p.id === profileId) ?? TIMER_PROFILES[0]
    actions.create(name, ttlMs, profile, status)
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    const name = pseudo.trim() || 'Invité'
    let roomId = ''
    let invite = ''

    if (pendingInvite) {
      roomId = pendingInvite.roomId
      invite = pendingInvite.invite
    } else {
      const parsed = parseInvite(inviteInput)
      if (parsed) {
        roomId = parsed.roomId
        invite = parsed.invite
      } else {
        return
      }
    }

    actions.join(roomId, invite, name, status)
  }

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    const text = chatDraft.trim()
    if (!text) return
    if (actions.sendChat(text)) {
      setChatDraft('')
    }
  }

  if (phase === 'connecting' || phase === 'reconnecting') {
    return (
      <div className="room-panel">
        <div className="room-header">
          <div className="room-header-info">
            <span className="room-status-dot connecting" />
            <span>{phase === 'connecting' ? 'Connexion à la salle…' : 'Reconnexion…'}</span>
          </div>
          <button className="icon-button" onClick={() => actions.leave()} title="Annuler">
            <LogOut size={16} />
          </button>
        </div>
        <p className="muted tiny" style={{ textAlign: 'center' }}>
          La session est synchronisée avec l’horloge du service.
        </p>
      </div>
    )
  }

  if (phase === 'joined' && room) {
    const unread = snapshot.unread
    return (
      <div className="room-panel">
        {error && (
          <div role="alert" className="error global-error">
            <span>{error}</span>
            <button onClick={actions.clearError}>Fermer</button>
          </div>
        )}

        <div className="room-header">
          <div className="room-header-info">
            <span className="room-status-dot" />
            <span>Salle de coworking ({room.members.length})</span>
          </div>
          <div className="room-header-actions">
            {room.invite && (
              <button
                className="text-button"
                data-invite-url={inviteLink(window.location.href, room.id, room.invite.code)}
                onClick={handleCopyLink}
                title="Copier le lien d'invitation"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? 'Lien copié !' : 'Inviter'}</span>
              </button>
            )}
            <button
              className="icon-button"
              onClick={() => {
                if (window.confirm('Quitter la salle de coworking ?')) actions.leave()
              }}
              title="Quitter la salle"
              aria-label="Quitter la salle"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <nav className="room-nav" aria-label="Navigation de la salle">
          <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>
            <Users size={14} /> Participants ({room.members.length})
          </button>
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
            <MessageSquare size={14} /> Discussion
            {unread > 0 && <span className="unread-dot" aria-label={`${unread} non lus`} />}
          </button>
          <button className={tab === 'timer' ? 'active' : ''} onClick={() => setTab('timer')}>
            <Timer size={14} /> Minuterie
          </button>
          {isHost && (
            <button
              className={tab === 'settings' ? 'active' : ''}
              onClick={() => setTab('settings')}
            >
              <Settings size={14} /> Réglages
            </button>
          )}
        </nav>

        {tab === 'members' && (
          <div className="room-members-list">
            {room.members.map((member) => (
              <div key={member.id} className="room-member-row">
                <div className="room-member-info">
                  <div className="room-avatar">{member.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div className="room-member-name">
                      <span>{member.name}</span>
                      {member.host && (
                        <span className="room-badge room-badge-host" title="Hôte de la salle">
                          <Crown size={10} /> Hôte
                        </span>
                      )}
                      {member.id === you && <span className="room-badge room-badge-you">Moi</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className={`room-pill room-pill-${member.shown}`}
                    title={`Statut: ${member.shown}`}
                  >
                    {member.shown === 'focus'
                      ? 'Concentré·e'
                      : member.shown === 'break'
                        ? 'En pause'
                        : 'Disponible'}
                  </span>

                  {isHost && member.id !== you && (
                    <button
                      className="icon-button"
                      title={`Retirer ${member.name}`}
                      onClick={() => {
                        if (window.confirm(`Retirer ${member.name} de la salle ?`))
                          actions.kick(member.id)
                      }}
                    >
                      <UserX size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'chat' && (
          <div className="room-chat">
            <div className="room-chat-messages">
              {snapshot.messages.length === 0 ? (
                <div className="room-chat-empty">
                  Aucun message pour l’instant. Encouragez vos co-workers !
                </div>
              ) : (
                snapshot.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`room-chat-msg ${msg.memberId === you ? 'self' : ''}`}
                  >
                    <div className="room-chat-meta">
                      <strong>{msg.name}</strong>
                      <span>
                        {new Date(msg.at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="room-chat-bubble">{msg.text}</div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="room-chat-form" onSubmit={handleSendChat}>
              <input
                type="text"
                value={chatDraft}
                maxLength={500}
                placeholder="Envoyer un message bienveillant…"
                onChange={(e) => setChatDraft(e.target.value)}
              />
              <button type="submit" className="primary" disabled={!chatDraft.trim()}>
                Envoyer
              </button>
            </form>
            <p className="room-chat-notice">
              Notifications et sonneries sont coupées en mode Focus pour préserver l’attention.
            </p>
          </div>
        )}

        {tab === 'timer' && (
          <RoomTimerSection
            timer={room.timer}
            offset={snapshot.offset}
            isHost={isHost}
            timerControl={room.settings.timerControl}
            onAction={actions.setTimer}
            onProfile={actions.setTimerProfile}
          />
        )}

        {tab === 'settings' && isHost && (
          <div style={{ display: 'grid', gap: '14px' }}>
            <label className="check-field">
              <input
                type="checkbox"
                checked={room.settings.timerControl === 'everyone'}
                onChange={(e) =>
                  actions.updateSettings({
                    timerControl: (e.target.checked ? 'everyone' : 'host') as TimerControl,
                  })
                }
              />
              <span>Permettre à tous les membres de contrôler la minuterie commune</span>
            </label>

            <label className="check-field">
              <input
                type="checkbox"
                checked={room.settings.locked}
                onChange={(e) => actions.updateSettings({ locked: e.target.checked })}
              />
              <span>
                {room.settings.locked ? (
                  <>
                    <Lock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Salle
                    verrouillée (refuse les nouvelles connexions)
                  </>
                ) : (
                  <>
                    <Unlock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Salle
                    ouverte
                  </>
                )}
              </span>
            </label>

            {room.invite && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>Renouveler l’invitation</h3>
                    <p className="tiny muted" style={{ margin: 0 }}>
                      Invalide le lien actuel et en génère un nouveau.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => actions.rotateInvite(24 * 60 * 60_000)}
                  >
                    <RefreshCw size={14} /> Renouveler (24h)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="room-footer-actions">
          <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Mon statut :</span>
            <Select
              aria-label="Mon statut de présence"
              value={status}
              onChange={(val) => {
                const s = val as PresenceStatus
                setStatus(s)
                actions.setPresence(s)
              }}
            >
              <option value="auto">Auto (suit le timer)</option>
              <option value="focus">Concentré·e</option>
              <option value="break">En pause</option>
              <option value="available">Disponible</option>
            </Select>
          </label>

          <button
            className="text-button"
            onClick={() => {
              if (window.confirm('Quitter la salle de coworking ?')) actions.leave()
            }}
          >
            <LogOut size={14} /> Quitter
          </button>
        </div>
      </div>
    )
  }

  // Phase is 'idle'
  return (
    <div className="room-panel">
      {ended && ended !== 'left' && (
        <div role="status" className="data-confirm">
          {ended === 'kicked'
            ? 'Tu as été retiré·e de la salle par l’hôte.'
            : ended === 'replaced'
              ? 'La salle est ouverte dans un autre onglet.'
              : 'La salle a été fermée.'}
        </div>
      )}

      {error && (
        <div role="alert" className="error global-error">
          <span>{error}</span>
          <button onClick={actions.clearError}>Fermer</button>
        </div>
      )}

      <p className="muted" style={{ margin: 0 }}>
        Travaille en présence d’autres personnes sans te faire distraire. Minuterie partagée,
        présence discrète et silence préservé.
      </p>

      <div className="segmented">
        <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>
          Rejoindre une salle
        </button>
        <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>
          Créer une salle
        </button>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: '14px' }}>
          <label className="field">
            Mon pseudonyme
            <input
              type="text"
              required
              maxLength={32}
              value={pseudo}
              placeholder="ex: Alex"
              onChange={(e) => handlePseudoChange(e.target.value)}
            />
          </label>

          <label className="field">
            Minuterie de la salle
            <Select
              aria-label="Minuterie de la salle"
              value={profileId}
              onChange={(val) => setProfileId(String(val))}
            >
              {TIMER_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="field">
            Durée du lien d’invitation
            <Select
              aria-label="Durée du lien d’invitation"
              value={String(ttlMs)}
              onChange={(val) => setTtlMs(Number(val))}
            >
              {INVITE_TTL_CHOICES.map((c) => (
                <option key={c.ms} value={String(c.ms)}>
                  {c.label}
                </option>
              ))}
            </Select>
          </label>

          <button type="submit" className="primary" style={{ marginTop: 8 }}>
            Créer et inviter
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} style={{ display: 'grid', gap: '14px' }}>
          <label className="field">
            Mon pseudonyme
            <input
              type="text"
              required
              maxLength={32}
              value={pseudo}
              placeholder="ex: Sam"
              onChange={(e) => handlePseudoChange(e.target.value)}
            />
          </label>

          <label className="field">
            Lien ou code d’invitation
            <input
              type="text"
              required
              value={inviteInput}
              placeholder="Colle le lien reçu…"
              onChange={(e) => setInviteInput(e.target.value)}
            />
          </label>

          <button type="submit" className="primary" style={{ marginTop: 8 }}>
            Rejoindre la salle
          </button>
        </form>
      )}
    </div>
  )
}

function RoomTimerSection({
  timer,
  offset,
  isHost,
  timerControl,
  onAction,
  onProfile,
}: {
  timer: TimerState
  offset: number
  isHost: boolean
  timerControl: TimerControl
  onAction: RoomController['actions']['setTimer']
  onProfile: RoomController['actions']['setTimerProfile']
}) {
  const [now, setNow] = useState(() => Date.now() + offset)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 100)
    return () => clearInterval(id)
  }, [offset])

  const phase = timer.profile.phases[timer.phaseIndex]
  const value = timerValue(timer, now)
  const running = timer.status === 'running'
  const canControl = isHost || timerControl === 'everyone'

  return (
    <div className="room-timer-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="tiny muted">{timer.profile.name}</span>
        <span className="room-badge room-badge-you">
          {timer.status === 'running'
            ? 'En cours'
            : timer.status === 'paused'
              ? 'En pause'
              : timer.status === 'waiting'
                ? 'Phase suivante prête'
                : 'Arrêté'}
        </span>
      </div>

      <p className="timer-phase" style={{ margin: 0 }}>
        {phase?.label ?? 'Session'}
      </p>

      <div className="room-timer-digits">{formatDuration(value)}</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button
          className="icon-button"
          disabled={!canControl || timer.status === 'idle'}
          onClick={() => onAction('stop')}
          title="Réinitialiser"
        >
          <RotateCcw size={16} />
        </button>

        <button
          className="primary"
          disabled={!canControl}
          onClick={() => onAction(running ? 'pause' : 'start')}
        >
          {running ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          {running ? 'Pause' : 'Démarrer'}
        </button>

        <button
          className="icon-button"
          disabled={!canControl || timer.status === 'idle'}
          onClick={() => onAction('skip')}
          title="Phase suivante"
        >
          <SkipForward size={16} />
        </button>
      </div>

      {!canControl && (
        <p className="tiny muted" style={{ margin: '4px 0 0' }}>
          Seul l’hôte peut démarrer ou suspendre la minuterie commune.
        </p>
      )}

      {isHost && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <label
            style={{
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span>Changer le profil :</span>
            <Select
              aria-label="Changer le profil de minuterie"
              value={timer.profile.id}
              onChange={(val) => {
                const found = TIMER_PROFILES.find((p) => p.id === val)
                if (found) onProfile(found)
              }}
            >
              {TIMER_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      )}
    </div>
  )
}
