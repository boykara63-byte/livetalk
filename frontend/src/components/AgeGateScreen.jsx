import { useMemo, useState } from 'react'
import { Video } from 'lucide-react'

function AgeGateScreen({ socketUrl, deviceId, onVerified }) {
  const currentYear = new Date().getFullYear()
  const startYear = currentYear - 18
  const endYear = 1940

  const years = useMemo(() => {
    const list = []
    for (let year = startYear; year >= endYear; year--) {
      list.push(year)
    }
    return list
  }, [startYear, endYear])

  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!birthYear) return

    const year = Number(birthYear)
    const age = currentYear - year
    if (age < 18) {
      setError("Vous devez avoir 18 ans ou plus pour utiliser ce service.")
      return
    }

    const birthDate = `${year}-01-01`
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
          Indique ton année de naissance.
        </p>

        <form className="age-gate-form" onSubmit={handleSubmit}>
          <label htmlFor="birthYear">Année de naissance</label>
          <select
            id="birthYear"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            required
            disabled={loading}
          >
            <option value="" disabled>
              Sélectionne ton année
            </option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {error && <p className="age-gate-error">{error}</p>}
          <button className="start-button" type="submit" disabled={loading || !birthYear}>
            {loading ? 'Vérification...' : 'Continuer'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AgeGateScreen
