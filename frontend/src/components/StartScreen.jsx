import { useState } from 'react'
import { Video, Pencil, LogOut } from 'lucide-react'
import Logo from './Logo'

const API_URL = import.meta.env.VITE_SOCKET_URL || 'https://livetalk-hlii.onrender.com'

function StartScreen({ onStart, disabled, onlineCount, deviceId, onLogout }) {
  const [showModal, setShowModal] = useState(false)
  const [nickname, setNickname] = useState(() => {
    try {
      return localStorage.getItem('livetalk-nickname') || ''
    } catch {
      return ''
    }
  })
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const handleSave = async (e) => {
    e.preventDefault()
    const trimmed = nickname.trim().slice(0, 30)
    if (!trimmed) return

    setLoading(true)
    setFeedback(null)
    try {
      const res = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, displayName: trimmed }),
      })
      const data = await res.json()
      if (res.ok) {
        try {
          localStorage.setItem('livetalk-nickname', trimmed)
        } catch {}
        setFeedback('Profil mis à jour')
        setTimeout(() => {
          setShowModal(false)
          setFeedback(null)
        }, 1200)
      } else {
        setFeedback(data.error || 'Erreur lors de la mise à jour.')
      }
    } catch {
      setFeedback('Erreur réseau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="start-screen screen-gradient">
      <div className="start-content">
        <div className="start-header-actions">
          <button
            type="button"
            className="profile-edit-button"
            onClick={() => setShowModal(true)}
            aria-label="Modifier mon profil"
          >
            <Pencil size={16} />
            Profil
          </button>
          <button
            type="button"
            className="logout-button"
            onClick={onLogout}
            aria-label="Se déconnecter"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>

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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Modifier mon profil</h2>
            <form className="modal-form" onSubmit={handleSave}>
              <label htmlFor="profileNickname" className="modal-label">
                Pseudo
              </label>
              <input
                id="profileNickname"
                type="text"
                className="modal-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={30}
                required
                disabled={loading}
              />
              {feedback && <p className={`modal-feedback ${feedback.includes('Erreur') ? 'error' : 'success'}`}>{feedback}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-button modal-button-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="modal-button modal-button-primary"
                  disabled={loading || !nickname.trim()}
                >
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default StartScreen
