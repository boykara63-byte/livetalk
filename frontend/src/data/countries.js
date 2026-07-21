export const COUNTRIES = [
  { code: 'TG', name: 'Togo', flag: '🇹🇬' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪' },
  { code: 'GN', name: 'Guinée', flag: '🇬🇳' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: 'OTHER', name: 'Autre pays', flag: '🌍' },
]

export function getCountryByCode(code) {
  if (!code) return null
  const found = COUNTRIES.find((c) => c.code === code)
  if (found) return found
  if (code === 'OTHER') return { code: 'OTHER', name: 'Autre pays', flag: '🌍' }
  return null
}

export function formatCountry(code) {
  const country = getCountryByCode(code)
  if (!country) return 'Inconnu'
  return `${country.flag} ${country.name}`
}
