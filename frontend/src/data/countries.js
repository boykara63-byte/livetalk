export const COUNTRIES = [
  { code: 'TG', name: 'Togo' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'SN', name: 'Sénégal' },
  { code: 'BJ', name: 'Bénin' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'ML', name: 'Mali' },
  { code: 'NE', name: 'Niger' },
  { code: 'GN', name: 'Guinée' },
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
  { code: 'CA', name: 'Canada' },
  { code: 'CH', name: 'Suisse' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'US', name: 'États-Unis' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'OTHER', name: 'Autre pays' },
]

export function getCountryByCode(code) {
  if (!code) return null
  const found = COUNTRIES.find((c) => c.code === code)
  if (found) return found
  if (code === 'OTHER') return { code: 'OTHER', name: 'Autre pays' }
  return null
}

export function formatCountry(code) {
  const country = getCountryByCode(code)
  if (!country) return 'Inconnu'
  return country.name
}
