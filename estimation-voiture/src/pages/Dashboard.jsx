import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../utils/Toast';
import { apiFetch } from '../utils/api';

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [selected, setSelected] = useState(new Set()); // IDs sélectionnés
  const LIMIT = 8;

  const fetchHistory = async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/history?page=${p}&limit=${LIMIT}`);
      if (!res.ok) throw new Error('Erreur chargement historique');
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setPages(data.pages || Math.ceil(data.total / LIMIT));
      setPage(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(1); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette estimation ?')) return;
    try {
      const res = await apiFetch(`/history/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur suppression');
      toast.success('Estimation supprimée');
      // Retirer de la sélection si présent
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchHistory(page);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Toggle sélection d'un item
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Tout sélectionner / tout désélectionner sur la page courante
  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  };

  // EXPORT PDF — génère un HTML structuré puis utilise window.print()
  const handleExportPDF = () => {
    const itemsToExport = items.filter(i => selected.has(i.id));
    if (itemsToExport.length === 0) {
      toast.error('Sélectionnez au moins une estimation à exporter');
      return;
    }

    const dateNow = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Parser le input_data si disponible pour récupérer les détails
    const parseInputData = (inputDataStr) => {
      if (!inputDataStr) return {};
      try {
        const data = typeof inputDataStr === 'string'
          ? JSON.parse(inputDataStr) : inputDataStr;
        const details = {};
        if (data['Année-Modèle']) details['Année-Modèle'] = data['Année-Modèle'];
        if (data['Kilométrage']) details['Kilométrage'] = `${data['Kilométrage'].toLocaleString('fr-FR')} km`;
        if (data['Puissance fiscale']) details['Puissance fiscale'] = `${data['Puissance fiscale']} CV`;
        if (data['Nombre de portes']) details['Portes'] = data['Nombre de portes'];
        if (data['Boite de vitesses'] !== undefined) {
          details['Boîte'] = data['Boite de vitesses'] === 1 ? 'Automatique' : 'Manuelle';
        }
        const etats = ['Pour Pièces','Endommagé','Correct','Bon','Très bon','Excellent','Neuf'];
        if (data['État'] !== undefined && etats[data['État']]) details['État'] = etats[data['État']];
        // Détecter le carburant
        for (const k of Object.keys(data)) {
          if (k.startsWith('Type de carburant_') && data[k] === 1) {
            details['Carburant'] = k.replace('Type de carburant_', '');
          }
          if (k.startsWith('Origine_') && data[k] === 1) {
            details['Origine'] = k.replace('Origine_', '');
          }
        }
        // Compter les équipements
        const equipsList = ['Climatisation','Système de navigation/GPS','Caméra de recul',
          'Jantes aluminium','Toit ouvrant','Sièges cuir','Radar de recul','Vitres électriques',
          'Verrouillage centralisé à distance','Régulateur de vitesse','ABS','Airbags',
          'CD/MP3/Bluetooth','ESP','Limiteur de vitesse','Ordinateur de bord'];
        const equips = equipsList.filter(eq => data[eq] === 1);
        if (equips.length) details['_equipements'] = equips;
        return details;
      } catch { return {}; }
    };

    const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
    const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    // Génération du HTML du PDF
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport d'estimation - AutoEstimate</title>
<style>
  @page { size: A4; margin: 1.5cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica', 'Arial', sans-serif;
    color: #1a1a1a;
    line-height: 1.5;
    background: white;
  }
  .pdf-header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 20px;
    margin-bottom: 30px;
    border-bottom: 3px solid #f0b90b;
  }
  .pdf-logo {
    display: flex; align-items: center; gap: 12px;
  }
  .pdf-logo-svg {
    width: 60px; height: 36px;
  }
  .pdf-brand h1 {
    font-size: 24px; font-weight: 800;
    color: #1a1a1a;
    letter-spacing: -0.5px;
  }
  .pdf-brand .accent { color: #c99a08; }
  .pdf-brand .tag {
    font-size: 10px;
    color: #5f6368;
    letter-spacing: 2px;
    font-weight: 600;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .pdf-date {
    text-align: right;
    font-size: 11px;
    color: #5f6368;
  }
  .pdf-date strong { color: #1a1a1a; display: block; font-size: 13px; }

  .pdf-title-section {
    background: linear-gradient(135deg, #fef9e0, #fff);
    border-left: 4px solid #f0b90b;
    padding: 16px 20px;
    margin-bottom: 30px;
    border-radius: 4px;
  }
  .pdf-title-section h2 {
    font-size: 20px;
    font-weight: 800;
    color: #1a1a1a;
    margin-bottom: 4px;
  }
  .pdf-title-section p {
    color: #5f6368;
    font-size: 12px;
  }

  .pdf-intro {
    background: #f9fafb;
    padding: 14px 18px;
    border-radius: 6px;
    font-size: 11.5px;
    color: #4a5568;
    margin-bottom: 30px;
    line-height: 1.6;
  }
  .pdf-intro strong { color: #1a1a1a; }

  .estimation-block {
    margin-bottom: 35px;
    page-break-inside: avoid;
  }
  .estimation-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    background: #1a1a1a;
    color: white;
    padding: 14px 20px;
    border-radius: 6px 6px 0 0;
  }
  .estimation-num {
    font-size: 11px;
    color: #f0b90b;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .estimation-title {
    font-size: 17px;
    font-weight: 700;
  }
  .estimation-date {
    font-size: 11px;
    color: #d1d5db;
    margin-top: 2px;
  }
  .estimation-price {
    text-align: right;
  }
  .estimation-price-label {
    font-size: 9px;
    color: #f0b90b;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 2px;
  }
  .estimation-price-value {
    font-size: 24px;
    font-weight: 800;
    color: #f0b90b;
  }
  .estimation-body {
    border: 1px solid #e5e7eb;
    border-top: none;
    border-radius: 0 0 6px 6px;
    padding: 16px 20px;
  }
  .details-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 14px;
  }
  .detail-cell {
    background: #f9fafb;
    padding: 8px 12px;
    border-radius: 4px;
    border-left: 2px solid #f0b90b;
  }
  .detail-label {
    font-size: 9px;
    color: #5f6368;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .detail-value {
    font-size: 12px;
    font-weight: 700;
    color: #1a1a1a;
  }
  .equipements-block {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #e5e7eb;
  }
  .equipements-label {
    font-size: 10px;
    color: #5f6368;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .equipements-list {
    display: flex; flex-wrap: wrap; gap: 5px;
  }
  .eq-badge {
    background: #fef9e0;
    color: #8a6d08;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid #f0b90b;
  }
  .description-block {
    margin-top: 14px;
    padding: 10px 14px;
    background: #f9fafb;
    border-radius: 4px;
    font-size: 11px;
    color: #4a5568;
    font-style: italic;
    line-height: 1.5;
  }
  .description-block strong {
    font-style: normal;
    color: #1a1a1a;
  }

  .pdf-footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    text-align: center;
    font-size: 10px;
    color: #5f6368;
  }
  .pdf-footer .disclaimer {
    margin-bottom: 6px;
    font-style: italic;
  }
  .pdf-footer .brand-footer {
    color: #c99a08;
    font-weight: 700;
  }
</style>
</head>
<body>

<div class="pdf-header">
  <div class="pdf-logo">
    <svg viewBox="0 0 60 30" class="pdf-logo-svg">
      <path d="M5 20 Q 5 12, 15 12 L 22 8 L 38 8 L 45 12 Q 55 12, 55 20 L 55 24 L 5 24 Z" fill="#f0b90b"/>
      <circle cx="17" cy="24" r="4" fill="white" stroke="#c99a08" stroke-width="1.5"/>
      <circle cx="43" cy="24" r="4" fill="white" stroke="#c99a08" stroke-width="1.5"/>
      <rect x="24" y="10" width="12" height="6" fill="white" opacity="0.7"/>
    </svg>
    <div class="pdf-brand">
      <h1>Auto<span class="accent">Estimate</span></h1>
      <div class="tag">IA · Maroc</div>
    </div>
  </div>
  <div class="pdf-date">
    <strong>Rapport généré le</strong>
    ${dateNow}
  </div>
</div>

<div class="pdf-title-section">
  <h2>Rapport d'estimation${itemsToExport.length > 1 ? 's' : ''}</h2>
  <p>${itemsToExport.length} estimation${itemsToExport.length > 1 ? 's' : ''} sélectionnée${itemsToExport.length > 1 ? 's' : ''} · Utilisateur : <strong>${user?.username || '—'}</strong></p>
</div>

<div class="pdf-intro">
  Ce rapport présente le détail ${itemsToExport.length > 1 ? 'des estimations sélectionnées' : 'de l\'estimation sélectionnée'} dans votre historique AutoEstimate.
  Les prix sont calculés par notre modèle de Machine Learning <strong>Stacking (XGBoost + RandomForest)</strong>
  entraîné sur plus de 30 000 annonces réelles du marché marocain (Avito.ma), avec une précision R² de 0.91
  et une erreur moyenne d'environ 15 000 MAD.
</div>

${itemsToExport.map((item, idx) => {
  const details = parseInputData(item.input_data);
  const equipements = details._equipements || [];
  delete details._equipements;

  return `
<div class="estimation-block">
  <div class="estimation-header">
    <div>
      <div class="estimation-num">Estimation #${idx + 1}</div>
      <div class="estimation-title">${item.description || 'Estimation manuelle'}</div>
      <div class="estimation-date">📅 ${formatDate(item.created_at)}</div>
    </div>
    <div class="estimation-price">
      <div class="estimation-price-label">Prix estimé</div>
      <div class="estimation-price-value">${fmt(item.predicted_price)} MAD</div>
    </div>
  </div>
  <div class="estimation-body">
    ${Object.keys(details).length > 0 ? `
    <div class="details-grid">
      ${item.marque ? `
      <div class="detail-cell">
        <div class="detail-label">Marque</div>
        <div class="detail-value">${item.marque}</div>
      </div>` : ''}
      ${item.modele ? `
      <div class="detail-cell">
        <div class="detail-label">Modèle</div>
        <div class="detail-value">${item.modele}</div>
      </div>` : ''}
      ${Object.entries(details).map(([k, v]) => `
      <div class="detail-cell">
        <div class="detail-label">${k}</div>
        <div class="detail-value">${v}</div>
      </div>`).join('')}
    </div>` : ''}

    ${equipements.length > 0 ? `
    <div class="equipements-block">
      <div class="equipements-label">Équipements (${equipements.length})</div>
      <div class="equipements-list">
        ${equipements.map(eq => `<span class="eq-badge">✓ ${eq}</span>`).join('')}
      </div>
    </div>` : ''}

    <div class="description-block">
      <strong>Estimation calculée le ${formatDate(item.created_at)}</strong> pour
      ${item.marque || 'un véhicule'}${item.modele ? ' ' + item.modele : ''}.
      Le prix de <strong>${fmt(item.predicted_price)} MAD</strong> correspond à la valeur estimée
      de marché selon les caractéristiques saisies. Une fourchette de confiance d'environ
      ±15 000 MAD peut s'appliquer autour de ce montant.
    </div>
  </div>
</div>`;
}).join('')}

<div class="pdf-footer">
  <div class="disclaimer">
    Document généré automatiquement par AutoEstimate. Les estimations sont fournies à titre indicatif
    et ne constituent pas une expertise commerciale. Le prix réel d'un véhicule peut varier selon
    son état exact, sa région, et les conditions du marché.
  </div>
  <div class="brand-footer">AutoEstimate © ${new Date().getFullYear()} · Projet de Fin d'Année EMSI</div>
</div>

<script>
  window.onload = () => {
    setTimeout(() => {
      window.print();
    }, 300);
  };
</script>
</body>
</html>`;

    // Ouvrir le HTML dans un nouvel onglet — l'utilisateur n'a qu'à "Enregistrer en PDF"
    const pdfWindow = window.open('', '_blank');
    if (!pdfWindow) {
      toast.error('Veuillez autoriser les popups pour exporter en PDF');
      return;
    }
    pdfWindow.document.write(html);
    pdfWindow.document.close();
    toast.success(`PDF prêt : ${itemsToExport.length} estimation${itemsToExport.length > 1 ? 's' : ''}`);
  };

  const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
  const maxPrice = items.length > 0 ? Math.max(...items.map(i => i.predicted_price)) : 0;

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <span className="card-icon">📋</span>
          <div>
            <h2>Mon historique</h2>
            <p className="card-subtitle">
              {user && (<>Bonjour <strong>{user.username}</strong> — {total} estimation{total > 1 ? 's' : ''} au total</>)}
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="skeleton-list">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-line wide" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <div className="empty-state">
            <span>🚗</span>
            <p>Aucune estimation pour l'instant.</p>
            <p>Utilisez le formulaire d'estimation ou analysez une annonce Avito !</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            {/* Mini chart */}
            {items.length >= 2 && (
              <div className="mini-chart">
                <div className="mini-chart-label">Dernières estimations</div>
                <div className="mini-chart-bars">
                  {[...items].reverse().map(item => (
                    <div key={item.id} className="mini-bar-wrap" title={`${item.description}: ${fmt(item.predicted_price)} MAD`}>
                      <div className="mini-bar" style={{ height: `${Math.max(8, (item.predicted_price / maxPrice) * 100)}%` }} />
                      <span className="mini-bar-label">{(item.marque || '').slice(0, 6) || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Barre d'action sélection + export */}
            <div className="selection-bar">
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={selected.size === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                />
                <span>
                  {selected.size === 0
                    ? 'Tout sélectionner'
                    : `${selected.size} estimation${selected.size > 1 ? 's' : ''} sélectionnée${selected.size > 1 ? 's' : ''}`}
                </span>
              </label>
              <button
                className={`btn-export-pdf ${selected.size > 0 ? 'active' : ''}`}
                onClick={handleExportPDF}
                disabled={selected.size === 0}
                title="Exporter la sélection en PDF"
              >
                <span className="pdf-icon">📄</span>
                <span>Exporter en PDF</span>
                {selected.size > 0 && <span className="pdf-count">{selected.size}</span>}
              </button>
            </div>

            {/* Liste avec checkboxes */}
            <div className="history-list">
              {items.map(item => {
                const isSelected = selected.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`history-card selectable ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelect(item.id)}
                  >
                    <label className="history-check" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </label>
                    <div className="history-card-left">
                      <span className="history-desc">{item.description || 'Estimation'}</span>
                      <span className="history-date">{formatDate(item.created_at)}</span>
                    </div>
                    <div className="history-card-right">
                      <span className="history-price">{fmt(item.predicted_price)} MAD</span>
                      <button
                        className="btn-delete"
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        title="Supprimer"
                      >🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {pages > 1 && (
              <div className="pagination">
                <button className="btn-page" disabled={page === 1}
                  onClick={() => fetchHistory(page - 1)}>← Précédent</button>
                <span className="page-info">{page} / {pages}</span>
                <button className="btn-page" disabled={page === pages}
                  onClick={() => fetchHistory(page + 1)}>Suivant →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
