import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { InstanceConfig } from '../collab/config'
import { socketUrl } from '../collab/config'
import { RoomClient } from '../collab/client'
import {
  parseInvite,
  type PresenceStatus,
  type RoomSettings,
  type RoomTimerAction,
} from '../collab/protocol'
import type { TimerProfile } from '../core/model'

export function useRoom(config: InstanceConfig | null) {
  const [client] = useState(
    () =>
      new RoomClient(
        socketUrl(
          'rooms',
          typeof window !== 'undefined' ? window.location.href : 'http://localhost/',
        ),
      ),
  )

  const [pendingInvite, setPendingInvite] = useState<{ roomId: string; invite: string } | null>(
    () => (typeof window !== 'undefined' ? parseInvite(window.location.hash) : null),
  )

  // Listen for hash changes so opening an invite link in an existing window triggers join
  useEffect(() => {
    const handleHash = () => {
      const invite = parseInvite(window.location.hash)
      if (invite) setPendingInvite(invite)
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  // Synchronize client with instance configuration
  useEffect(() => {
    if (!config) return
    const url = socketUrl(config.collaboration.url, window.location.href)
    client.setUrl(url)
    if (config.collaboration.enabled) {
      client.resumeSaved()
    }
  }, [client, config])

  useEffect(() => {
    return () => client.dispose()
  }, [client])

  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot)

  // Clear hash after joining
  const clearPendingInvite = useCallback(() => {
    setPendingInvite(null)
    if (window.location.hash.includes('join=')) {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  const actions = useMemo(() => {
    return {
      create(
        name: string,
        inviteTtlMs: number,
        profile: TimerProfile,
        status: PresenceStatus = 'auto',
      ) {
        client.create(name, inviteTtlMs, profile, status)
      },
      join(roomId: string, invite: string, name: string, status: PresenceStatus = 'auto') {
        client.join(roomId, invite, name, status)
        clearPendingInvite()
      },
      leave() {
        client.leave()
      },
      sendChat(text: string) {
        return client.send({ type: 'chat', text })
      },
      setPresence(status?: PresenceStatus, name?: string) {
        client.send({ type: 'presence', status, name })
      },
      setTimer(action: RoomTimerAction) {
        client.send({ type: 'timer', action })
      },
      setTimerProfile(profile: TimerProfile) {
        client.send({ type: 'timerProfile', profile })
      },
      updateSettings(settings: Partial<RoomSettings>) {
        client.send({ type: 'settings', settings })
      },
      rotateInvite(ttlMs: number) {
        client.send({ type: 'rotateInvite', ttlMs })
      },
      kick(memberId: string) {
        client.send({ type: 'kick', memberId })
      },
      markRead() {
        client.markRead()
      },
      clearError() {
        client.clearError()
      },
      clearPendingInvite,
    }
  }, [client, clearPendingInvite])

  return {
    client,
    snapshot,
    pendingInvite,
    actions,
  }
}

export type RoomController = ReturnType<typeof useRoom>
