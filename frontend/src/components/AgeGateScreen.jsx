import { useState } from 'react'
import { Video } from 'lucide-react'

function AgeGateScreen({ socketUrl, deviceId, onVerified }) {
  const [birthDate, setBirthDate] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!birthDate) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${socketUrl}/api/verify-age`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, birthDate }),
      })
      const data = await res.json()
      if (res.ok) {
        onVerified()
      } else {
        setError(data.error || 'Erreur lors de la vérification.')
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="age-gate-screen">
      <div className="age-gate-content">
        <div className="logo-large">
          <Video className="logo-icon-large" />
          <span>
            <span className="logo-live">Live</span>
            <span className="logo-talk">Talk</span>
          </span>
        </div>

        <h1>Vérification d'âge</h1>
        <p className="tagline">
          Ce service est réservé aux personnes majeures (18+).
          Veuillez indiquer votre date de naissance.
        </p>

        <form className="age-gate-form" onSubmit={handleSubmit}>
          <label htmlFor="birthDate">Date de naissance</label>
          <input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
            disabled={loading}
          />
          {error && <p className="age-gate-error">{error}</p>}
          <button className="start-button" type="submit" disabled={loading || !birthDate}>
            {loading ? 'Vérification...' : 'Continuer'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AgeGateScreen
