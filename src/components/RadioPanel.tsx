import { ExternalLink, Play, Radio, Square } from 'lucide-react'
import { RADIO_STATIONS } from '../core/radio'
import type { RadioController } from '../hooks/useRadio'
import './radio.css'
export function RadioPanel({
  radio,
  ambientPlaying,
}: {
  radio: RadioController
  ambientPlaying: boolean
}) {
  const station = RADIO_STATIONS.find((item) => item.id === radio.stationId)!
  const active = radio.status === 'playing' || radio.status === 'loading'
  return (
    <div className="radio-panel">
      <div className="radio-stations" role="group" aria-label="Stations radio">
        {RADIO_STATIONS.map((item) => (
          <button
            key={item.id}
            className={`radio-station ${station.id === item.id ? 'selected' : ''}`}
            aria-pressed={station.id === item.id}
            onClick={() => radio.select(item.id)}
          >
            <Radio size={20} />
            <span>
              <strong>{item.name}</strong>
              <small>{item.genre}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="radio-now">
        <strong>{station.name}</strong>
        <span role="status">
          {radio.status === 'playing'
            ? 'En direct'
            : radio.status === 'loading'
              ? 'Connexion…'
              : radio.status === 'error'
                ? 'Indisponible'
                : 'À l’arrêt'}
        </span>
      </div>
      <div className="radio-controls">
        <button className="primary" onClick={active ? radio.stop : radio.play}>
          {active ? <Square size={16} /> : <Play size={16} />}
          {active
            ? 'Arrêter la radio'
            : radio.status === 'error'
              ? 'Réessayer la radio'
              : ambientPlaying
                ? 'Écouter avec les ambiances'
                : 'Écouter la radio'}
        </button>
        <label>
          Volume radio{' '}
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(radio.volume * 100)}
            onChange={(event) => radio.setVolume(Number(event.target.value) / 100)}
          />
          <output>{Math.round(radio.volume * 100)} %</output>
        </label>
      </div>
      {radio.error && (
        <p role="alert" className="error">
          {radio.error}
        </p>
      )}
      {ambientPlaying && active && (
        <p className="radio-note">Radio et ambiances actives · volumes indépendants.</p>
      )}
      <p className="radio-note">
        La lecture contacte la station et son hébergeur. Internet requis ; publicités possibles.
      </p>
      <a className="radio-source" href={station.source} target="_blank" rel="noreferrer">
        Site de la station <ExternalLink size={13} />
      </a>
    </div>
  )
}
