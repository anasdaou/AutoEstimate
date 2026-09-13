import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../utils/Toast';
import { apiFetch } from '../utils/api';

export default function Register() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const toast = useToast();
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/register', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username,
          email:    formData.email,
          password: formData.password
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur inscription');

      // Connexion automatique après inscription
      const loginRes = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ email: formData.email, password: formData.password })
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error('Inscription réussie — connectez-vous');

      login(loginData.token, { username: loginData.username, is_admin: loginData.is_admin });
      toast.success('Compte créé avec succès !');
      navigate('/predict');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">✨</span>
          <h2>Créer un compte</h2>
          <p>Rejoignez AutoEstimate gratuitement</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Nom d'utilisateur</label>
            <input
              type="text"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              placeholder="votre_pseudo"
              required minLength={3}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="votre@email.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              placeholder="Min. 6 caractères"
              required minLength={6}
            />
          </div>
          <div className="form-group">
            <label>Confirmer le mot de passe</label>
            <input
              type="password"
              value={formData.confirm}
              onChange={e => setFormData({ ...formData, confirm: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="auth-footer">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
