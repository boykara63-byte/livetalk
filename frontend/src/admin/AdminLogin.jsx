import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './admin.css'

const ADMIN_TOKEN_KEY = 'livetalk-admin-token'
const API_URL = import.meta.env.VITE_SOCKET_URL || 'https://livetalk-hlii.onrender.com'

function AdminLogin() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, data.token)
        navigate('/admin/dashboard')
      } else {
        setError(data.error || 'Mot de passe incorrect.')
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-screen">
      <div className="admin-login-card">
        <h1>Admin LiveTalk</h1>
        <p className="admin-login-subtitle">Connexion sécurisée au panneau d'administration</p>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label htmlFor="adminPassword" className="admin-login-label">
            Mot de passe
          </label>
          <input
            id="adminPassword"
            type="password"
            className="admin-login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••"
          />
          {error && <p className="admin-login-error">{error}</p>}
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={loading || !password}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminLogin
