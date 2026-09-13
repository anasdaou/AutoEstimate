import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-icon">🚗</span>
          <span className="brand-name">Auto<span className="brand-accent">Estimate</span></span>
        </div>
        <div className="footer-links">
          <Link to="/about">À propos</Link>
          <Link to="/predict">Estimation</Link>
          <Link to="/analyze">Analyse</Link>
        </div>
        <div className="footer-copy">
          © {new Date().getFullYear()} AutoEstimate — Projet de Fin d'Année
        </div>
      </div>
    </footer>
  );
}
