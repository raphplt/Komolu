import type { TimerProfile, TimerState } from './model'

export const MIN_PHASE_MS = 1_000
export const MAX_PHASE_MS = 24 * 60 * 60 * 1_000
export const TIMER_PROFILES: TimerProfile[] = [
  {
    id: 'pomodoro',
    name: 'Pomodoro · 25 / 5',
    mode: 'sequence',
    phases: [
      { id: 'work', label: 'Concentration', kind: 'work', durationMs: 25 * 60_000 },
      { id: 'break', label: 'Pause', kind: 'break', durationMs: 5 * 60_000 },
    ],
    repeats: 4,
    autoAdvance: false,
    sound: false,
  },
  {
    id: 'deep',
    name: 'Temps long · 50 / 10',
    mode: 'sequence',
    phases: [
      { id: 'work', label: 'Concentration', kind: 'work', durationMs: 50 * 60_000 },
      { id: 'break', label: 'Pause', kind: 'break', durationMs: 10 * 60_000 },
    ],
    repeats: 2,
    autoAdvance: false,
    sound: false,
  },
  {
    id: 'free',
    name: 'Session libre',
    mode: 'free',
    phases: [{ id: 'free', label: 'Session libre', kind: 'work', durationMs: 0 }],
    repeats: 1,
    autoAdvance: false,
    sound: false,
  },
]
export function validateProfile(profile: TimerProfile): boolean {
  return (
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    typeof profile.autoAdvance === 'boolean' &&
    typeof profile.sound === 'boolean' &&
    (profile.mode === 'free' || profile.mode === 'sequence') &&
    Number.isInteger(profile.repeats) &&
    profile.repeats >= 0 &&
    profile.repeats <= 100 &&
    profile.phases.length > 0 &&
    profile.phases.length <= 20 &&
    profile.phases.every(
      (p) =>
        typeof p.id === 'string' &&
        typeof p.label === 'string' &&
        (p.kind === 'work' || p.kind === 'break') &&
        Number.isFinite(p.durationMs) &&
        (profile.mode === 'free'
          ? p.durationMs === 0
          : p.durationMs >= MIN_PHASE_MS && p.durationMs <= MAX_PHASE_MS),
    )
  )
}
export function createTimer(
  profile: TimerProfile = TIMER_PROFILES[0],
  now = Date.now(),
): TimerState {
  if (!validateProfile(profile)) throw new Error('Profil de minuterie invalide.')
  return {
    status: 'idle',
    profile: structuredClone(profile),
    phaseIndex: 0,
    cycle: 0,
    remainingMs: profile.phases[0].durationMs,
    elapsedMs: 0,
    deadline: null,
    startedAt: null,
    lastObservedAt: now,
    revision: 0,
    completedPhases: 0,
    clockWarning: false,
    taskId: null,
  }
}
export function timerValue(timer: TimerState, now: number): number {
  if (timer.profile.mode === 'free')
    return (
      timer.elapsedMs +
      (timer.status === 'running' && timer.startedAt !== null
        ? Math.max(0, now - timer.startedAt)
        : 0)
    )
  return timer.status === 'running' && timer.deadline !== null
    ? Math.max(0, timer.deadline - now)
    : timer.remainingMs
}
function advance(timer: TimerState, now: number, running: boolean): TimerState {
  const phaseIndex = (timer.phaseIndex + 1) % timer.profile.phases.length
  const cycle = timer.cycle + (phaseIndex === 0 ? 1 : 0)
  if (timer.profile.repeats !== 0 && cycle >= timer.profile.repeats)
    return {
      ...timer,
      status: 'completed',
      remainingMs: 0,
      deadline: null,
      startedAt: null,
      lastObservedAt: now,
    }
  const duration = timer.profile.phases[phaseIndex].durationMs
  return {
    ...timer,
    phaseIndex,
    cycle,
    remainingMs: duration,
    elapsedMs: 0,
    status: running ? 'running' : 'waiting',
    deadline: running ? now + duration : null,
    startedAt: running ? now : null,
    lastObservedAt: now,
  }
}
/** Pure reconciliation; deadlines preserve elapsed time across sleep and reload. */
export function reconcileTimer(input: TimerState, now: number): TimerState {
  if (input.status !== 'running') return input
  // Backward jumps >2s pause rather than silently extending a running phase.
  if (now < input.lastObservedAt - 2_000)
    return {
      ...input,
      status: 'paused',
      remainingMs: timerValue(input, input.lastObservedAt),
      elapsedMs:
        input.profile.mode === 'free' ? timerValue(input, input.lastObservedAt) : input.elapsedMs,
      deadline: null,
      startedAt: null,
      clockWarning: true,
      lastObservedAt: now,
      revision: input.revision + 1,
    }
  if (input.profile.mode === 'free' || input.deadline === null || now < input.deadline) return input
  let timer = { ...input }
  // Infinite auto-sequences can skip whole cycles arithmetically after long sleep.
  if (timer.profile.autoAdvance && timer.profile.repeats === 0) {
    const cycleMs = timer.profile.phases.reduce((sum, phase) => sum + phase.durationMs, 0)
    const skippedCycles = Math.floor((now - timer.deadline!) / cycleMs)
    if (skippedCycles > 0)
      timer = {
        ...timer,
        deadline: timer.deadline! + skippedCycles * cycleMs,
        cycle: timer.cycle + skippedCycles,
        completedPhases: timer.completedPhases + skippedCycles * timer.profile.phases.length,
      }
  }
  while (timer.status === 'running' && timer.deadline !== null && now >= timer.deadline) {
    const boundary = timer.deadline
    timer = advance(
      { ...timer, completedPhases: timer.completedPhases + 1 },
      boundary,
      timer.profile.autoAdvance,
    )
    if (!timer.profile.autoAdvance) break
  }
  return { ...timer, lastObservedAt: now, revision: input.revision + 1 }
}
export type TimerAction = 'start' | 'pause' | 'resume' | 'stop' | 'skip' | 'tick'
export function transitionTimer(
  input: TimerState,
  action: TimerAction,
  now: number,
  taskId?: string | null,
): TimerState {
  let timer = reconcileTimer(input, now)
  if (action === 'tick') return timer
  if (action === 'stop') return { ...createTimer(timer.profile, now), revision: timer.revision + 1 }
  if (action === 'start' || action === 'resume') {
    if (timer.status === 'running') return timer
    if (timer.status === 'completed') timer = createTimer(timer.profile, now)
    timer = {
      ...timer,
      status: 'running',
      deadline: timer.profile.mode === 'free' ? null : now + timer.remainingMs,
      startedAt: now,
      clockWarning: false,
      taskId: taskId === undefined ? timer.taskId : taskId,
    }
  } else if (action === 'pause' && timer.status === 'running') {
    timer = {
      ...timer,
      status: 'paused',
      remainingMs: timerValue(timer, now),
      elapsedMs: timer.profile.mode === 'free' ? timerValue(timer, now) : timer.elapsedMs,
      deadline: null,
      startedAt: null,
    }
  } else if (action === 'skip') {
    if (timer.profile.mode === 'free')
      return {
        ...timer,
        status: 'completed',
        elapsedMs: timerValue(timer, now),
        deadline: null,
        startedAt: null,
        lastObservedAt: now,
        revision: timer.revision + 1,
      }
    timer = advance(timer, now, timer.status === 'running')
  } else return timer
  return { ...timer, lastObservedAt: now, revision: input.revision + 1 }
}
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1_000))
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

/** Wall clock moving backwards relative to monotonic elapsed time. */
export function clockMovedBackwards(
  lastWall: number,
  lastMono: number,
  wall: number,
  mono: number,
): boolean {
  return wall - lastWall < mono - lastMono - 2_000
}
