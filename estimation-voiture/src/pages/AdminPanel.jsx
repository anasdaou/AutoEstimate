import { useState, useEffect } from 'react';
import { useToast } from '../utils/Toast';
import { apiFetch } from '../utils/api';

export default function AdminPanel() {
  const toast = useToast();
  const [stats, setStats]     = useState(null);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState('stats');
  // [A15] Search
  const [search, setSearch]   = useState('');

  const fetchStats = async () => {
    const res = await apiFetch('/admin/stats');
    if (!res.ok) throw new Error('Erreur chargement stats');
    return res.json();
  };

  const fetchUsers = async (q = '') => {
    const qs = q ? `?search=${encodeURIComponent(q)}` : '';
    const res = await apiFetch(`/admin/users${qs}`);
    if (!res.ok) throw new Error('Erreur chargement utilisateurs');
    const data = await res.json();
    // [A15] L'API retourne maintenant { total, page, pages, items: [...] }
    return data.items || data;
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchUsers()])
      .then(([s, u]) => { setStats(s); setUsers(u); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Recherche utilisateurs
  const handleSearch = async (e) => {
    e?.preventDefault();
    try {
      const u = await fetchUsers(search);
      setUsers(u);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (userId, username) => {
    if (!window.confirm(`Supprimer l'utilisateur "${username}" et tout son historique ?`)) return;
    try {
      const res = await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur suppression');
      setUsers(prev => prev.filter(u => u.id !== userId));
      setStats(prev => prev ? ({
        ...prev,
        total_users: prev.total_users - 1,
        total_predictions: prev.total_predictions - (users.find(u => u.id === userId)?.nb_predictions || 0)
      }) : prev);
      toast.success(`Utilisateur "${username}" supprimé`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  if (loading) return (
    <div className="page">
      <div className="skeleton-list">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton-card"><div className="skeleton-line wide" /></div>
        ))}
      </div>
    </div>
  );
  if (error) return <div className="page"><p className="error-msg">{error}</p></div>;

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <span className="card-icon">⚙️</span>
          <h2>Dashboard Administrateur</h2>
        </div>

        <div className="admin-tabs">
          <button
            className={`tab-btn ${tab === 'stats' ? 'active' : ''}`}
            onClick={() => setTab('stats')}
          >📊 Statistiques</button>
          <button
            className={`tab-btn ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >👥 Utilisateurs ({users.length})</button>
        </div>

        {tab === 'stats' && stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-icon">👥</span>
              <span className="stat-value">{stats.total_users}</span>
              <span className="stat-label">Utilisateurs</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">🔮</span>
              <span className="stat-value">{stats.total_predictions}</span>
              <span className="stat-label">Estimations totales</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">🟢</span>
              <span className="stat-value">{stats.users_actifs}</span>
              <span className="stat-label">Utilisateurs actifs</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">🛡️</span>
              <span className="stat-value">{stats.admins}</span>
              <span className="stat-label">Administrateurs</span>
            </div>
            {stats.prix_moyen && (
              <div className="stat-card">
                <span className="stat-icon">💰</span>
                <span className="stat-value">{fmt(stats.prix_moyen)}</span>
                <span className="stat-label">Prix moyen estimé (MAD)</span>
              </div>
            )}
            {stats.total_users > 0 && (
              <div className="stat-card">
                <span className="stat-icon">📈</span>
                <span className="stat-value">
                  {(stats.total_predictions / stats.total_users).toFixed(1)}
                </span>
                <span className="stat-label">Estimations / utilisateur</span>
              </div>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="users-section">
            {/* Barre de recherche */}
            <form className="search-bar" onSubmit={handleSearch}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom ou email..."
              />
              <button type="submit" className="btn-search">Rechercher</button>
            </form>

            <div className="users-table-wrap">
              {users.length === 0 ? (
                <p className="empty-state">Aucun utilisateur trouvé.</p>
              ) : (
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nom</th>
                      <th>Email</th>
                      <th>Rôle</th>
                      <th>Estimations</th>
                      <th>Inscrit le</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className={u.is_admin ? 'row-admin' : ''}>
                        <td>#{u.id}</td>
                        <td><strong>{u.username}</strong></td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`role-badge ${u.is_admin ? 'admin' : 'user'}`}>
                            {u.is_admin ? '🛡️ Admin' : '👤 User'}
                          </span>
                        </td>
                        <td>{u.nb_predictions}</td>
                        <td>{formatDate(u.created_at)}</td>
                        <td>
                          {u.is_admin ? (
                            <span className="protected-label">Protégé</span>
                          ) : (
                            <button
                              className="btn-delete"
                              onClick={() => handleDelete(u.id, u.username)}
                            >🗑 Supprimer</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
