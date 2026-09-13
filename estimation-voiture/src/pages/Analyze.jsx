import { useState } from 'react';
import { useToast } from '../utils/Toast';
import { apiFetch } from '../utils/api';

export default function Analyze() {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiFetch('/analyze-link', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur serveur (${res.status})`);
      setResult(data);
      toast.success('Analyse terminée !');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const analyseConfig = {
    'surévalué':   { color: '#e74c3c', icon: '📈', label: 'Surévalué',    msg: "Le prix demandé est supérieur à l'estimation du marché." },
    'sous-évalué': { color: '#2ecc71', icon: '📉', label: 'Bonne affaire', msg: "Le prix demandé est inférieur à l'estimation du marché." },
    'juste prix':  { color: '#f0b90b', icon: '✅', label: 'Juste prix',    msg: "Le prix demandé correspond à l'estimation du marché." },
  };

  const cfg = result?.analyse ? analyseConfig[result.analyse] : null;
  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <span className="card-icon">🔍</span>
          <div>
            <h2>Analyse d'annonce Avito</h2>
            <p className="card-subtitle">L'IA scrape la page et compare avec son estimation</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="analyze-form">
          <div className="form-group">
            <label>🔗 URL de l'annonce Avito.ma</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.avito.ma/fr/..."
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <span className="spinner-inline"></span>
                <span>Analyse en cours (30–60 sec)...</span>
              </>
            ) : (
              <>
                <span className="btn-icon">🚀</span>
                <span>Analyser l'annonce</span>
                <span className="btn-shine"></span>
              </>
            )}
          </button>
        </form>

        {/* Loader créatif pendant le scraping */}
        {loading && (
          <div className="loader-creative" style={{ marginTop: '2rem' }}>
            <div className="loader-car">🏎️</div>
            <div className="loader-road">
              <div className="loader-line"></div>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>
              Chargement de la page Avito, extraction des données...
            </p>
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}

        {result && (
          <div className="analyze-result fade-in">

            {cfg && (
              <div className="verdict-box" style={{ borderLeftColor: cfg.color }}>
                <span className="verdict-icon">{cfg.icon}</span>
                <div>
                  <span className="verdict-label" style={{ color: cfg.color }}>{cfg.label}</span>
                  <p className="verdict-msg">{cfg.msg}</p>
                </div>
              </div>
            )}

            <div className="price-compare">
              <div className="price-box">
                <span className="price-box-label">Prix annonce</span>
                <span className="price-box-value">
                  {result.prix_annonce ? fmt(result.prix_annonce) + ' MAD' : 'Non détecté'}
                </span>
              </div>
              <div className="price-box highlight">
                <span className="price-box-label">Prix estimé</span>
                <span className="price-box-value">{fmt(result.prix_estime)} MAD</span>
                {result.prix_min && result.prix_max && (
                  <span className="price-box-range">
                    {fmt(result.prix_min)} — {fmt(result.prix_max)}
                  </span>
                )}
              </div>
              {result.ecart_pct !== null && result.ecart_pct !== undefined && (
                <div className="price-box">
                  <span className="price-box-label">Écart</span>
                  <span className="price-box-value" style={{ color: result.ecart_pct > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {result.ecart_pct > 0 ? '+' : ''}{result.ecart_pct}%
                  </span>
                </div>
              )}
            </div>

            {result.details_scraped && Object.keys(result.details_scraped).length > 0 && (
              <div className="details-section">
                <h3>📋 Caractéristiques extraites</h3>
                <div className="details-grid">
                  {Object.entries(result.details_scraped).map(([k, v]) => (
                    <div key={k} className="detail-item">
                      <span className="detail-key">{k}</span>
                      <span className="detail-val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.equipements_scraped?.length > 0 && (
              <div className="details-section">
                <h3>✨ Équipements détectés</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {result.equipements_scraped.map(eq => (
                    <span key={eq} className="eq-badge">✓ {eq}</span>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
