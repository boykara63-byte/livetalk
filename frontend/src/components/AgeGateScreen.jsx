import { useMemo, useState } from 'react'
import Logo from './Logo'
import { formatCountry } from '../data/countries'

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
  const [nickname, setNickname] = useState('')
  const [detectedCountry, setDetectedCountry] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedNickname = nickname.trim().slice(0, 30)
    if (!birthYear) return
    if (!trimmedNickname) {
      setError('Choisis un pseudo pour continuer.')
      return
    }

    const year = Number(birthYear)
    const age = currentYear - year
    if (age < 18) {
      setError('Vous devez avoir 18 ans ou plus pour utiliser ce service.')
      return
    }

    const birthDate = `${year}-01-01`
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${socketUrl}/api/verify-age`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, birthDate, nickname: trimmedNickname }),
      })
      const data = await res.json()
      if (res.ok) {
        const country = data.country || null
        setDetectedCountry(country)
        try {
          localStorage.setItem('livetalk-country', country || '')
          localStorage.setItem('livetalk-nickname', trimmedNickname)
        } catch {}
        setTimeout(() => {
          onVerified()
        }, 1500)
      } else {
        setError(data.error || 'Impossible de valider tes informations. R\u00e9essaie.')
      }
    } catch {
      setError('Connexion au serveur impossible. V\u00e9rifie ta connexion et r\u00e9essaie.')
    } finally {
      setLoading(false)
    }
  }

  const countryLabel = detectedCountry ? formatCountry(detectedCountry) : null

  return (
    <div className="age-gate-screen screen-gradient">
      <div className="age-gate-content">
        <Logo size="large" variant="light" />

        <h1 className="age-gate-title">Confirme ton âge</h1>

        <form className="age-gate-form" onSubmit={handleSubmit}>
          <label htmlFor="nickname" className="age-gate-label">
            Pseudo
          </label>
          <input
            id="nickname"
            type="text"
            className="age-gate-input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Ton pseudo (3-30 caractères)"
            maxLength={30}
            required
            disabled={loading || detectedCountry !== null}
          />

          <label htmlFor="birthYear" className="age-gate-label">
            Année de naissance
          </label>
          <select
            id="birthYear"
            className="age-gate-select"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            required
            disabled={loading || detectedCountry !== null}
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

          {detectedCountry !== null && (
            <p className="age-gate-country">
              Pays détecté : {countryLabel || 'Non déterminé'}
            </p>
          )}

          {error && <p className="age-gate-error">{error}</p>}

          <button
            className="button button-accent button-full"
            type="submit"
            disabled={loading || !birthYear || !nickname.trim() || detectedCountry !== null}
          >
            {loading ? 'Vérification...' : detectedCountry !== null ? 'Redirection...' : 'Continuer'}
          </button>
        </form>

        <p className="age-gate-footnote">18 ans et plus requis</p>
      </div>
    </div>
  )
}

export default AgeGateScreen
