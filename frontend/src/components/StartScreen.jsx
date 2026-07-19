import { Video } from 'lucide-react'

function StartScreen({ onStart, disabled }) {
  return (
    <div className="start-screen">
      <div className="start-content">
        <div className="logo-large">
          <Video className="logo-icon-large" />
          <span>
            <span className="logo-live">Live</span>
            <span className="logo-talk">Talk</span>
          </span>
        </div>

        <p className="tagline">Discute avec des inconnus en vidéo, instantanément.</p>

        <button className="start-button" onClick={onStart} disabled={disabled}>
          {disabled ? 'Activation caméra/micro...' : 'Commencer'}
        </button>

        <p className="age-notice">18 ans et plus</p>
      </div>
    </div>
  )
}

export default StartScreen
