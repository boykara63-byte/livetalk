import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCountry, COUNTRIES } from '../data/countries'
import './admin.css'

const ADMIN_TOKEN_KEY = 'livetalk-admin-token'
const API_URL = import.meta.env.VITE_SOCKET_URL || 'https://livetalk-hlii.onrender.com'

function adminFetch(path, options = {}) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY)
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`,
      ...options.headers,
    },
  }).then(async (res) => {
    if (res.status === 401) {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
      window.location.href = '/admin'
      throw new Error('Session expirée.')
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || data.details || `Erreur ${res.status}`)
    }
    return res
  })
}

function Card({ title, value }) {
  return (
    <div className="admin-card">
      <p className="admin-card-title">{title}</p>
      <p className="admin-card-value">{value}</p>
    </div>
  )
}

function Badge({ yes, children }) {
  return <span className={`admin-badge ${yes ? 'admin-badge-yes' : 'admin-badge-no'}`}>{children}</span>
}

function BarChart({ data }) {
  if (!data || data.length === 0) return <p className="admin-empty">Aucune donnée</p>
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="admin-chart">
      {data.map((item) => (
        <div key={item.date} className="admin-chart-bar-wrap">
          <div
            className="admin-chart-bar"
            style={{ height: `${(item.count / max) * 100}%` }}
            title={`${item.date}: ${item.count}`}
          />
          <span className="admin-chart-label">{item.date.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}

function AdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(null)

  const [reports, setReports] = useState([])
  const [reportsMeta, setReportsMeta] = useState({ page: 1, totalPages: 1 })
  const [reportsLoading, setReportsLoading] = useState(false)

  const [users, setUsers] = useState([])
  const [usersMeta, setUsersMeta] = useState({ page: 1, totalPages: 1 })
  const [usersLoading, setUsersLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [bannedFilter, setBannedFilter] = useState('')

  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY)
    if (!token) {
      navigate('/admin')
    }
  }, [navigate])

  const loadStats = useCallback(() => {
    setStatsLoading(true)
    setStatsError(null)
    adminFetch('/api/admin/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
        console.log('[AdminDashboard] stats received:', data)
      })
      .catch((err) => {
        console.error('stats error:', err.message)
        setStatsError(err.message || 'Erreur lors du chargement des statistiques.')
      })
      .finally(() => setStatsLoading(false))
  }, [])

  const loadReports = useCallback((page = 1) => {
    setReportsLoading(true)
    adminFetch(`/api/admin/reports?page=${page}&limit=20`)
      .then((res) => res.json())
      .then((data) => {
        setReports(data.reports || [])
        setReportsMeta({
          page: data.page,
          totalPages: data.totalPages,
        })
      })
      .catch((err) => console.error('reports error:', err.message))
      .finally(() => setReportsLoading(false))
  }, [])

  const loadUsers = useCallback((page = 1) => {
    setUsersLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    if (search) params.set('search', search)
    if (countryFilter) params.set('country', countryFilter)
    if (bannedFilter) params.set('is_banned', bannedFilter)
    adminFetch(`/api/admin/users?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users || [])
        setUsersMeta({
          page: data.page,
          totalPages: data.totalPages,
        })
      })
      .catch((err) => console.error('users error:', err.message))
      .finally(() => setUsersLoading(false))
  }, [search, countryFilter, bannedFilter])

  useEffect(() => {
    loadStats()
    loadReports(1)
    loadUsers(1)
  }, [loadStats, loadReports, loadUsers])

  useEffect(() => {
    loadUsers(1)
  }, [search, countryFilter, bannedFilter, loadUsers])

  const handleBan = async (deviceId, reason) => {
    try {
      const res = await adminFetch('/api/admin/ban', {
        method: 'POST',
        body: JSON.stringify({ deviceId, reason }),
      })
      if (res.ok) {
        loadUsers(usersMeta.page)
        loadReports(reportsMeta.page)
        loadStats()
      }
    } catch (err) {
      console.error('ban error:', err.message)
    }
  }

  const handleUnban = async (deviceId) => {
    try {
      const res = await adminFetch('/api/admin/unban', {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      })
      if (res.ok) {
        loadUsers(usersMeta.page)
        loadReports(reportsMeta.page)
        loadStats()
      }
    } catch (err) {
      console.error('unban error:', err.message)
    }
  }

  const logout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    navigate('/admin')
  }

  const renderOverview = () => (
    <div className="admin-tab-content">
      {statsError && (
        <div className="admin-error-banner">
          Erreur stats : {statsError}
        </div>
      )}
      <div className="admin-cards">
        <Card title="Utilisateurs" value={statsLoading ? '...' : stats?.totalUsers ?? 0} />
        <Card title="En ligne" value={statsLoading ? '...' : stats?.onlineNow ?? 0} />
        <Card title="Vérifiés" value={statsLoading ? '...' : stats?.verifiedUsers ?? 0} />
        <Card title="Bannis" value={statsLoading ? '...' : stats?.bannedUsers ?? 0} />
        <Card title="Signalements 24h" value={statsLoading ? '...' : stats?.reportsLast24h ?? 0} />
        <Card title="Total signalements" value={statsLoading ? '...' : stats?.totalReports ?? 0} />
      </div>

      <div className="admin-section">
        <h3>Utilisateurs par pays</h3>
        {statsLoading ? (
          <p className="admin-empty">Chargement...</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pays</th>
                <th>Nombre</th>
              </tr>
            </thead>
            <tbody>
              {stats?.usersByCountry?.map((item) => (
                <tr key={item.country}>
                  <td>{formatCountry(item.country)}</td>
                  <td>{item.count}</td>
                </tr>
              )) || (
                <tr>
                  <td colSpan="2" className="admin-empty">Aucune donnée</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-section">
        <h3>Inscriptions sur les 7 derniers jours</h3>
        {statsLoading ? (
          <p className="admin-empty">Chargement...</p>
        ) : (
          <BarChart data={stats?.signupsLast7Days || []} />
        )}
      </div>
    </div>
  )

  const renderReports = () => (
    <div className="admin-tab-content">
      <h3>Signalements</h3>
      {reportsLoading ? (
        <p className="admin-empty">Chargement...</p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Signalé par</th>
                <th>Signalé</th>
                <th>Raison</th>
                <th>Banni</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{new Date(report.created_at).toLocaleString()}</td>
                  <td>{report.reporter_device_id}</td>
                  <td>{report.reported_device_id}</td>
                  <td>{report.reason || '-'}</td>
                  <td><Badge yes={!report.reported_is_banned}>{report.reported_is_banned ? 'Oui' : 'Non'}</Badge></td>
                  <td>
                    {report.reported_is_banned ? (
                      <button
                        className="admin-button admin-button-small"
                        onClick={() => handleUnban(report.reported_device_id)}
                      >
                        Débannir
                      </button>
                    ) : (
                      <button
                        className="admin-button admin-button-danger admin-button-small"
                        onClick={() => handleBan(report.reported_device_id, 'Banni depuis les signalements')}
                      >
                        Bannir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan="6" className="admin-empty">Aucun signalement</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="admin-pagination">
            <button
              disabled={reportsMeta.page <= 1}
              onClick={() => loadReports(reportsMeta.page - 1)}
              className="admin-button"
            >
              Précédent
            </button>
            <span>Page {reportsMeta.page} / {reportsMeta.totalPages}</span>
            <button
              disabled={reportsMeta.page >= reportsMeta.totalPages}
              onClick={() => loadReports(reportsMeta.page + 1)}
              className="admin-button"
            >
              Suivant
            </button>
          </div>
        </>
      )}
    </div>
  )

  const renderUsers = () => (
    <div className="admin-tab-content">
      <h3>Utilisateurs</h3>
      <div className="admin-filters">
        <input
          type="text"
          className="admin-input"
          placeholder="Rechercher un deviceId"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-select"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
        >
          <option value="">Tous les pays</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="admin-select"
          value={bannedFilter}
          onChange={(e) => setBannedFilter(e.target.value)}
        >
          <option value="">Tous</option>
          <option value="true">Bannis</option>
          <option value="false">Non bannis</option>
        </select>
      </div>
      {usersLoading ? (
        <p className="admin-empty">Chargement...</p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Pseudo</th>
                <th>Pays</th>
                <th>Vérifié</th>
                <th>Banni</th>
                <th>Créé le</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="admin-device-id">{user.device_id}</td>
                  <td>{user.nickname || '-'}</td>
                  <td>{formatCountry(user.country)}</td>
                  <td><Badge yes={user.age_verified}>{user.age_verified ? 'Oui' : 'Non'}</Badge></td>
                  <td><Badge yes={!user.is_banned}>{user.is_banned ? 'Oui' : 'Non'}</Badge></td>
                  <td>{new Date(user.created_at).toLocaleString()}</td>
                  <td>
                    {user.is_banned ? (
                      <button
                        className="admin-button admin-button-small"
                        onClick={() => handleUnban(user.device_id)}
                      >
                        Débannir
                      </button>
                    ) : (
                      <button
                        className="admin-button admin-button-danger admin-button-small"
                        onClick={() => handleBan(user.device_id, 'Banni depuis l\'admin')}
                      >
                        Bannir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="7" className="admin-empty">Aucun utilisateur</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="admin-pagination">
            <button
              disabled={usersMeta.page <= 1}
              onClick={() => loadUsers(usersMeta.page - 1)}
              className="admin-button"
            >
              Précédent
            </button>
            <span>Page {usersMeta.page} / {usersMeta.totalPages}</span>
            <button
              disabled={usersMeta.page >= usersMeta.totalPages}
              onClick={() => loadUsers(usersMeta.page + 1)}
              className="admin-button"
            >
              Suivant
            </button>
          </div>
        </>
      )}
    </div>
  )

  const tabTitles = {
    overview: 'Vue d\'ensemble',
    reports: 'Signalements',
    users: 'Utilisateurs',
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <h2>Admin <span>LiveTalk</span></h2>
        <nav className="admin-nav">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Vue d'ensemble
          </button>
          <button
            className={activeTab === 'reports' ? 'active' : ''}
            onClick={() => {
              setActiveTab('reports')
              loadReports(reportsMeta.page)
            }}
          >
            Signalements
          </button>
          <button
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => {
              setActiveTab('users')
              loadUsers(usersMeta.page)
            }}
          >
            Utilisateurs
          </button>
        </nav>
        <button className="admin-button admin-button-logout" onClick={logout}>
          Déconnexion
        </button>
      </aside>
      <main className="admin-main">
        <div className="admin-header">
          <h1>{tabTitles[activeTab]}</h1>
        </div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'users' && renderUsers()}
      </main>
    </div>
  )
}

export default AdminDashboard
