import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);

  // Détection du scroll
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 30);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollPct(total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fermer le menu mobile au changement de route
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;
  const handleNav = () => setMenuOpen(false);

  const navLinks = [
    { to: '/',          label: 'Accueil',     icon: '🏠', show: true },
    { to: '/predict',   label: 'Estimation',  icon: '🔧', show: !!token },
    { to: '/analyze',   label: 'Analyse',     icon: '🔍', show: !!token },
    { to: '/dashboard', label: 'Historique',  icon: '📋', show: !!token },
    { to: '/admin',     label: 'Admin',       icon: '⚙️', show: !!token && user?.is_admin },
    { to: '/about',     label: 'À propos',    icon: 'ℹ️', show: true },
  ];

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-inner">

        <Link to="/" className="brand-link" onClick={handleNav}>
          <span className="brand-logo">
            <svg viewBox="0 0 60 30" className="brand-svg">
              <path
                d="M5 20 Q 5 12, 15 12 L 22 8 L 38 8 L 45 12 Q 55 12, 55 20 L 55 24 L 5 24 Z"
                fill="var(--gold)"
                className="brand-car-body"
              />
              <circle cx="17" cy="24" r="4" fill="var(--bg2)" stroke="var(--gold)" strokeWidth="1.5" />
              <circle cx="43" cy="24" r="4" fill="var(--bg2)" stroke="var(--gold)" strokeWidth="1.5" />
              <rect x="24" y="10" width="12" height="6" fill="var(--bg2)" opacity="0.6" />
            </svg>
          </span>
          <span className="brand-text">
            <span className="brand-main">Auto<span className="brand-accent">Estimate</span></span>
            <span className="brand-tag">IA · Maroc</span>
          </span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'show' : ''}`}>
          {navLinks.filter(l => l.show).map((l, i) => (
            <Link
              key={l.to}
              to={l.to}
              className={`nav-link ${isActive(l.to) ? 'active' : ''}`}
              onClick={handleNav}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <span className="nav-link-icon">{l.icon}</span>
              <span className="nav-link-label">{l.label}</span>
              <span className="nav-link-underline" />
            </Link>
          ))}

          <div className="navbar-auth-mobile">
            {token ? (
              <button className="btn-logout" onClick={handleLogout}>
                <span>👋</span> Déconnexion
              </button>
            ) : (
              <>
                <Link to="/login" className="btn-login" onClick={handleNav}>Connexion</Link>
                <Link to="/register" className="btn-register" onClick={handleNav}>Inscription</Link>
              </>
            )}
          </div>
        </div>

        <div className="navbar-actions">
          <button
            className={`theme-toggle ${theme === 'light' ? 'light' : ''}`}
            onClick={toggleTheme}
            aria-label="Changer le thème"
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            <span className="theme-icon theme-sun">☀️</span>
            <span className="theme-icon theme-moon">🌙</span>
          </button>

          <div className="navbar-auth">
            {token ? (
              <div className="user-menu">
                <span className="user-avatar">
                  {user?.username?.charAt(0).toUpperCase() || '?'}
                </span>
                <div className="user-info">
                  <span className="user-name">{user?.username}</span>
                  {user?.is_admin && <span className="user-badge">Admin</span>}
                </div>
                <button className="btn-logout" onClick={handleLogout}>
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className="auth-links">
                <Link to="/login" className="btn-login">Connexion</Link>
                <Link to="/register" className="btn-register">
                  <span>Inscription</span>
                  <span className="btn-arrow">→</span>
                </Link>
              </div>
            )}
          </div>

          <button
            className={`hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
        </div>

      </div>

      {/* Barre de progression du scroll */}
      <div className="scroll-progress">
        <div className="scroll-progress-bar" style={{ width: `${scrollPct}%` }} />
      </div>
    </nav>
  );
}
