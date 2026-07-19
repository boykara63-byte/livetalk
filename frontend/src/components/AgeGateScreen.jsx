import { useMemo, useState } from 'react'
import Logo from './Logo'
import { COUNTRIES } from '../data/countries'

const WEST_AFRICAN_CODES = ['TG', 'CI', 'SN', 'BJ', 'BF', 'ML', 'NE', 'GN']

const WEST_AFRICAN_COUNTRIES = COUNTRIES.filter((c) =>
  WEST_AFRICAN_CODES.includes(c.code)
)

const OTHER_COUNTRIES = COUNTRIES.filter(
  (c) => !WEST_AFRICAN_CODES.includes(c.code)
)

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
  const [country, setCountry] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!birthYear || !country) return

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
        body: JSON.stringify({ deviceId, birthDate, country }),
      })
      const data = await res.json()
      if (res.ok) {
        try {
          localStorage.setItem('livetalk-country', country)
        } catch {}
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
    <div className="age-gate-screen screen-gradient">
      <div className="age-gate-content">
        <Logo size="large" variant="light" />

        <h1 className="age-gate-title">Confirme ton âge</h1>

        <form className="age-gate-form" onSubmit={handleSubmit}>
          <label htmlFor="birthYear" className="age-gate-label">
            Année de naissance
          </label>
          <select
            id="birthYear"
            className="age-gate-select"
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

          <label htmlFor="country" className="age-gate-label">
            Pays de provenance
          </label>
          <select
            id="country"
            className="age-gate-select"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            disabled={loading}
          >
            <option value="" disabled>
              Sélectionne ton pays
            </option>
            <optgroup label="Afrique de l'Ouest">
              {WEST_AFRICAN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Autres pays">
              {OTHER_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </optgroup>
          </select>

          {error && <p className="age-gate-error">{error}</p>}

          <button
            className="button button-accent button-full"
            type="submit"
            disabled={loading || !birthYear || !country}
          >
            {loading ? 'Vérification...' : 'Continuer'}
          </button>
        </form>

        <p className="age-gate-footnote">18 ans et plus requis</p>
      </div>
    </div>
  )
}

export default AgeGateScreen
