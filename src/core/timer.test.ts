import { describe, expect, it } from 'vitest'
import {
  clockMovedBackwards,
  createTimer,
  formatDuration,
  reconcileTimer,
  timerValue,
  transitionTimer,
  validateProfile,
  TIMER_PROFILES,
} from './timer'
import type { TimerProfile } from './model'
const profile: TimerProfile = {
  id: 'test',
  name: 'Test',
  mode: 'sequence',
  phases: [
    { id: 'work', label: 'Focus', kind: 'work', durationMs: 10_000 },
    { id: 'rest', label: 'Pause', kind: 'break', durationMs: 5_000 },
  ],
  repeats: 2,
  autoAdvance: false,
  sound: false,
}
describe('deadline timer', () => {
  it('never adds a second when the render clock predates start or resume', () => {
    const started = transitionTimer(createTimer(TIMER_PROFILES[1], 0), 'start', 1_250)
    expect(formatDuration(timerValue(started, 1_000))).toBe('50:00')
    expect(formatDuration(timerValue(started, 1_250))).toBe('50:00')
    expect(formatDuration(timerValue(started, 2_250))).toBe('49:59')
    const paused = transitionTimer(started, 'pause', 2_500)
    const resumed = transitionTimer(paused, 'resume', 10_500)
    expect(timerValue(resumed, 10_000)).toBe(paused.remainingMs)
    expect(timerValue(resumed, 11_500)).toBe(paused.remainingMs - 1_000)
  })
  it('survives serialization and calculates remaining time without interval counting', () => {
    const running = transitionTimer(createTimer(profile, 1_000), 'start', 1_000)
    const restored = JSON.parse(JSON.stringify(running))
    expect(timerValue(restored, 7_123)).toBe(3_877)
    expect(reconcileTimer(restored, 7_123)).toEqual(restored)
  })
  it('pauses and resumes preserving remaining duration', () => {
    const running = transitionTimer(createTimer(profile, 0), 'start', 0)
    const paused = transitionTimer(running, 'pause', 3_000)
    expect(timerValue(paused, 100_000)).toBe(7_000)
    const resumed = transitionTimer(paused, 'resume', 100_000)
    expect(resumed.deadline).toBe(107_000)
    expect(timerValue(resumed, 103_000)).toBe(4_000)
  })
  it('waits for explicit start after a completed phase by default', () => {
    const running = transitionTimer(createTimer(profile, 0), 'start', 0)
    const waiting = reconcileTimer(running, 60_000)
    expect(waiting.status).toBe('waiting')
    expect(waiting.phaseIndex).toBe(1)
    expect(waiting.remainingMs).toBe(5_000)
    expect(waiting.completedPhases).toBe(1)
    expect(transitionTimer(waiting, 'start', 61_000).deadline).toBe(66_000)
  })
  it('automatically catches up after sleep and stops at finite repetition limit', () => {
    const running = transitionTimer(createTimer({ ...profile, autoAdvance: true }, 0), 'start', 0)
    const next = reconcileTimer(running, 17_000)
    expect(next.status).toBe('running')
    expect(next.cycle).toBe(1)
    expect(next.phaseIndex).toBe(0)
    expect(timerValue(next, 17_000)).toBe(8_000)
    const completed = reconcileTimer(next, 1_000_000)
    expect(completed.status).toBe('completed')
    expect(completed.completedPhases).toBe(4)
  })
  it('handles years of infinite cycles without unbounded iteration', () => {
    const running = transitionTimer(
      createTimer({ ...profile, autoAdvance: true, repeats: 0 }, 0),
      'start',
      0,
    )
    const future = 31_536_000_000
    const reconciled = reconcileTimer(running, future)
    expect(reconciled.status).toBe('running')
    expect(reconciled.cycle).toBe(Math.floor(future / 15_000))
    expect(timerValue(reconciled, future)).toBe(10_000)
  })
  it('snapshots profile and does not mutate the source', () => {
    const copy = structuredClone(profile)
    const timer = createTimer(copy, 0)
    copy.phases[0].durationMs = 40_000
    expect(timer.profile.phases[0].durationMs).toBe(10_000)
  })
  it('counts only running time in free sessions', () => {
    let timer = transitionTimer(createTimer(TIMER_PROFILES[2], 0), 'start', 0)
    timer = transitionTimer(timer, 'pause', 5_000)
    expect(timerValue(timer, 30_000)).toBe(5_000)
    timer = transitionTimer(timer, 'resume', 40_000)
    expect(timerValue(timer, 44_000)).toBe(9_000)
    timer = transitionTimer(timer, 'skip', 44_000)
    expect(timer.status).toBe('completed')
    expect(timerValue(timer, 50_000)).toBe(9_000)
  })
  it('pauses on a backward jump relative to known observation', () => {
    const timer = transitionTimer(createTimer(profile, 10_000), 'start', 10_000)
    const paused = reconcileTimer(timer, 5_000)
    expect(paused.status).toBe('paused')
    expect(paused.clockWarning).toBe(true)
    expect(paused.remainingMs).toBe(10_000)
  })
  it('does not count skipped phases as completed', () => {
    const timer = transitionTimer(createTimer(profile, 0), 'start', 0)
    const skipped = transitionTimer(timer, 'skip', 5_000)
    expect(skipped.phaseIndex).toBe(1)
    expect(skipped.deadline).toBe(10_000)
    expect(skipped.completedPhases).toBe(0)
  })
  it('rejects invalid or unbounded profiles', () => {
    expect(validateProfile({ ...profile, phases: [] })).toBe(false)
    expect(validateProfile({ ...profile, repeats: -1 })).toBe(false)
    expect(validateProfile({ ...profile, repeats: 101 })).toBe(false)
    expect(
      validateProfile({ ...profile, phases: [{ ...profile.phases[0], durationMs: Infinity }] }),
    ).toBe(false)
    expect(() =>
      createTimer({ ...profile, phases: [{ ...profile.phases[0], durationMs: 0 }] }),
    ).toThrow()
  })
})

it('detects a backward jump after ten minutes even when wall time is still after the session start', () => {
  expect(clockMovedBackwards(600_000, 600_000, 541_000, 601_000)).toBe(true)
  expect(clockMovedBackwards(600_000, 600_000, 900_000, 900_000)).toBe(false)
})
