import { useCallback, useEffect, useRef, useState } from 'react'
import { AmbientAudio, completionSoundIsArmed, playCompletionSound } from '../core/audio'
import type { AudioProfile, TimerState } from '../core/model'
import { mutateState } from '../core/storage'
import { reportError } from '../core/store'

export function useAudio(profile: AudioProfile) {
  const [engine] = useState(() => new AmbientAudio())
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const profileRef = useRef(profile)
  const operation = useRef(0)
  const serialized = JSON.stringify(profile)
  useEffect(() => {
    let current = true
    const transport = operation.current
    profileRef.current = JSON.parse(serialized) as AudioProfile
    void engine
      .update(profileRef.current)
      .catch((error) => {
        if (current && transport === operation.current)
          setError(error instanceof Error ? error.message : 'Impossible de mettre à jour les sons.')
      })
      .finally(() => {
        if (current && transport === operation.current) setPlaying(engine.playing)
      })
    return () => {
      current = false
    }
  }, [engine, serialized])
  useEffect(
    () => () => {
      void engine.dispose().catch(reportError)
    },
    [engine],
  )
  const play = useCallback(async () => {
    const revision = ++operation.current
    setLoading(true)
    setError(null)
    try {
      await engine.play(profileRef.current)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Impossible de lire les sons.')
    } finally {
      if (revision === operation.current) {
        setLoading(false)
        setPlaying(engine.playing)
      }
    }
  }, [engine])
  const halt = useCallback(
    async (stop: boolean) => {
      ++operation.current
      setPlaying(false)
      setLoading(false)
      try {
        if (stop) await engine.stop()
        else await engine.pause()
      } catch {
        setError('Impossible de suspendre les sons. Recharge la page si le problème persiste.')
      }
    },
    [engine],
  )
  useEffect(() => {
    const stopForReplacement = () => {
      void halt(true)
    }
    window.addEventListener('komolu-personal-data-replaced', stopForReplacement)
    return () => window.removeEventListener('komolu-personal-data-replaced', stopForReplacement)
  }, [halt])
  return {
    playing,
    loading,
    error,
    play,
    pause: () => halt(false),
    stop: () => halt(true),
    clearError: () => setError(null),
  }
}
export type AudioController = ReturnType<typeof useAudio>
/** Initial persisted completions are a baseline, never a request to replay a chime. */
export function useCompletionSound(timer: TimerState, enabled: boolean, dataEpoch = ''): void {
  const observed = useRef({
    startedAt: timer.startedAt,
    completed: timer.completedPhases,
    dataEpoch,
  })
  useEffect(() => {
    const previous = observed.current
    observed.current = { startedAt: timer.startedAt, completed: timer.completedPhases, dataEpoch }
    if (
      dataEpoch !== previous.dataEpoch ||
      timer.completedPhases <= previous.completed ||
      !enabled ||
      !timer.profile.sound ||
      !completionSoundIsArmed()
    )
      return
    const key = `${timer.startedAt}:${timer.completedPhases}`
    let winner = false
    void mutateState((state) => {
      const currentKey = `${state.timer.startedAt}:${state.timer.completedPhases}`
      if (currentKey !== key || state.timer.lastSoundKey === key) return
      state.timer.lastSoundKey = key
      winner = true
    })
      .then(() => {
        if (winner) return playCompletionSound()
      })
      .catch(reportError)
  }, [timer.startedAt, timer.completedPhases, timer.profile.sound, enabled, dataEpoch])
}
