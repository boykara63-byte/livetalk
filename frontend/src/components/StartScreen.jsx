import { Video } from 'lucide-react'
import Logo from './Logo'

function StartScreen({ onStart, disabled, onlineCount }) {
  return (
    <div className="start-screen screen-gradient">
      <div className="start-content">
        <Logo size="large" variant="light" />

        <p className="start-tagline">
          Rencontre le monde,<br />une conversation à la fois.
        </p>

        <div className="online-badge online-badge--light">
          <span className="online-dot" aria-hidden="true" />
          <span>{onlineCount} en ligne</span>
        </div>

        <button
          className="button button-accent button-full button-start"
          onClick={onStart}
          disabled={disabled}
        >
          <Video size={22} />
          {disabled ? 'Activation caméra/micro...' : 'Commencer'}
        </button>

        <p className="start-footnote">18 ans et plus</p>
      </div>
    </div>
  )
}

export default StartScreen
