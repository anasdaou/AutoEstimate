import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page auth-page">
      <div className="not-found-content">
        <span className="not-found-code">404</span>
        <h2>Page introuvable</h2>
        <p>La page que vous cherchez n'existe pas ou a été déplacée.</p>
        <Link to="/" className="btn-primary" style={{ width: 'auto', display: 'inline-block' }}>
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
