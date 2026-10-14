import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { RadioPlayer } from '../core/radio'
export function useRadio(dataEpoch: string | undefined) {
  const [player] = useState(() => new RadioPlayer())
  const snapshot = useSyncExternalStore(player.subscribe, player.getSnapshot)
  const epoch = useRef(dataEpoch)
  useEffect(() => {
    if (epoch.current !== dataEpoch) {
      player.reset()
      epoch.current = dataEpoch
    }
    return () => player.stop()
  }, [player, dataEpoch])
  return {
    ...snapshot,
    play: player.play,
    stop: player.stop,
    select: player.select,
    setVolume: player.setVolume,
  }
}
export type RadioController = ReturnType<typeof useRadio>
