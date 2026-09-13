import { useState, useEffect, useRef } from 'react';
import { useToast } from '../utils/Toast';
import { apiFetch } from '../utils/api';
import Speedometer from '../components/Speedometer';

const EQUIPEMENTS_LIST = [
  { label: 'Climatisation',                      column: 'Climatisation',                       icon: '❄️' },
  { label: 'GPS',                                 column: 'Système de navigation/GPS',           icon: '📍' },
  { label: 'Caméra de recul',                    column: 'Caméra de recul',                     icon: '📹' },
  { label: 'Jantes aluminium',                   column: 'Jantes aluminium',                    icon: '⭕' },
  { label: 'Toit ouvrant',                       column: 'Toit ouvrant',                        icon: '☀️' },
  { label: 'Sièges cuir',                        column: 'Sièges cuir',                         icon: '🪑' },
  { label: 'Radar de recul',                     column: 'Radar de recul',                      icon: '📡' },
  { label: 'Vitres électriques',                 column: 'Vitres électriques',                  icon: '🪟' },
  { label: 'Verrouillage centralisé',            column: 'Verrouillage centralisé à distance',  icon: '🔒' },
  { label: 'Régulateur de vitesse',              column: 'Régulateur de vitesse',               icon: '⚡' },
  { label: 'ABS',                                column: 'ABS',                                 icon: '🛑' },
  { label: 'Airbags',                            column: 'Airbags',                             icon: '💨' },
  { label: 'CD / MP3 / Bluetooth',               column: 'CD/MP3/Bluetooth',                    icon: '🎵' },
  { label: 'ESP',                                column: 'ESP',                                 icon: '🎯' },
  { label: 'Limiteur de vitesse',                column: 'Limiteur de vitesse',                 icon: '🚦' },
  { label: 'Ordinateur de bord',                 column: 'Ordinateur de bord',                  icon: '💻' },
];

const INITIAL_FORM = {
  annee: '2020', km: '50000', puissance: '5', portes: 4, etat: 3,
  boiteAuto: false, carburant: '', marque: '', modele: '', origine: '', equipements: []
};

export default function Predict() {
  const toast = useToast();
  const [formOptions, setFormOptions] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [prediction, setPrediction] = useState(null);
  const [fourchette, setFourchette] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingModeles, setLoadingModeles] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const resultRef = useRef(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    apiFetch('/form-options')
      .then(res => res.json())
      .then(data => {
        setFormOptions(data);
        setFormData(prev => ({
          ...prev,
          marque: data.marques[0]?.column || '',
          modele: data.modeles[0]?.column || '',
          origine: data.origines[0]?.column || '',
          carburant: data.carburants[0]?.column || '',
        }));
        initialLoadDone.current = true;
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current || !formData.marque) return;
    const nomMarque = formData.marque.replace('Marque_', '');
    setLoadingModeles(true);
    apiFetch(`/form-options?marque=${encodeURIComponent(nomMarque)}`)
      .then(res => res.json())
      .then(data => {
        setFormOptions(prev => ({ ...prev, modeles: data.modeles }));
        setFormData(prev => ({ ...prev, modele: data.modeles[0]?.column || '' }));
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingModeles(false));
  }, [formData.marque]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formOptions) return;
    setLoading(true);
    setError(null);
    setPrediction(null);
    setFourchette(null);

    const allColumns = [
      ...formOptions.carburants.map(c => c.column),
      ...formOptions.marques.map(m => m.column),
      ...(formOptions.modeles || []).map(m => m.column),
      ...formOptions.origines.map(o => o.column),
      ...EQUIPEMENTS_LIST.map(eq => eq.column),
    ];

    let payload = Object.fromEntries(allColumns.map(col => [col, 0]));
    payload['Année-Modèle'] = Number(formData.annee) || 2020;
    payload['Kilométrage'] = Number(formData.km) || 0;
    payload['Puissance fiscale'] = Number(formData.puissance) || 5;
    payload['Nombre de portes'] = Number(formData.portes);
    payload['État'] = Number(formData.etat);
    payload['Boite de vitesses'] = formData.boiteAuto ? 1 : 0;

    if (formData.carburant) payload[formData.carburant] = 1;
    if (formData.marque) payload[formData.marque] = 1;
    if (formData.modele) payload[formData.modele] = 1;
    if (formData.origine) payload[formData.origine] = 1;
    formData.equipements.forEach(eq => { payload[eq] = 1; });

    try {
      const res = await apiFetch('/predict', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur serveur (${res.status})`);
      }
      const data = await res.json();
      setPrediction(data.prediction ?? data.prix_estime);
      if (data.prix_min && data.prix_max) {
        setFourchette({ min: data.prix_min, max: data.prix_max });
      }
      toast.success('Estimation calculée avec succès !');
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPrediction(null);
    setFourchette(null);
    setError(null);
    setActiveStep(1);
    setFormData(prev => ({
      ...INITIAL_FORM,
      marque: prev.marque,
      modele: prev.modele,
      origine: formOptions?.origines[0]?.column || '',
      carburant: formOptions?.carburants[0]?.column || '',
    }));
    toast.info('Formulaire réinitialisé');
  };

  const toggleEq = (col) => {
    setFormData(prev => ({
      ...prev,
      equipements: prev.equipements.includes(col)
        ? prev.equipements.filter(v => v !== col)
        : [...prev.equipements, col]
    }));
  };

  if (!formOptions) {
    return (
      <div className="page">
        <div className="loader-creative">
          {error ? <p className="error-msg">{error}</p> : (
            <>
              <div className="loader-car">🏎️</div>
              <div className="loader-road">
                <div className="loader-line"></div>
              </div>
              <p>Chargement des marques et modèles...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page predict-page">
      <div className="card predict-card">

        <div className="card-header">
          <span className="card-icon">🔧</span>
          <div>
            <h2>Estimation manuelle</h2>
            <p className="card-subtitle">Renseignez les caractéristiques de votre véhicule</p>
          </div>
        </div>

        {/* Stepper visuel : 3 étapes */}
        <div className="stepper">
          <div className={`step ${activeStep >= 1 ? 'active' : ''}`}>
            <div className="step-circle">1</div>
            <span className="step-label">Caractéristiques</span>
          </div>
          <div className={`step-line ${activeStep >= 2 ? 'active' : ''}`}></div>
          <div className={`step ${activeStep >= 2 ? 'active' : ''}`}>
            <div className="step-circle">2</div>
            <span className="step-label">Modèle & origine</span>
          </div>
          <div className={`step-line ${activeStep >= 3 ? 'active' : ''}`}></div>
          <div className={`step ${activeStep >= 3 ? 'active' : ''}`}>
            <div className="step-circle">3</div>
            <span className="step-label">Équipements</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="estimation-form">

          {/* ÉTAPE 1 — CARACTÉRISTIQUES */}
          <div className={`form-step ${activeStep === 1 ? 'active' : ''}`}>
            <h3 className="step-title">🎯 Caractéristiques techniques</h3>

            <div className="form-row">
              <div className="form-group">
                <label>📅 Année modèle</label>
                <input type="number" value={formData.annee}
                  onChange={e => setFormData({ ...formData, annee: e.target.value })}
                  min={1990} max={2026} />
              </div>
              <div className="form-group">
                <label>🛣️ Kilométrage</label>
                <input type="number" value={formData.km}
                  onChange={e => setFormData({ ...formData, km: e.target.value })}
                  min={0} step={1000} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>⚡ Puissance fiscale (CV)</label>
                <input type="number" value={formData.puissance}
                  onChange={e => setFormData({ ...formData, puissance: e.target.value })}
                  min={1} max={50} />
              </div>
              <div className="form-group">
                <label>🚪 Nombre de portes</label>
                <select value={formData.portes}
                  onChange={e => setFormData({ ...formData, portes: +e.target.value })}>
                  {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} portes</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>✨ État du véhicule</label>
              <div className="etat-selector">
                {['Pour Pièces','Endommagé','Correct','Bon','Très bon','Excellent','Neuf'].map((lbl, idx) => (
                  <button key={idx} type="button"
                    className={`etat-chip ${formData.etat === idx ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, etat: idx })}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={formData.boiteAuto}
                  onChange={e => setFormData({ ...formData, boiteAuto: e.target.checked })} />
                <span>⚙️ Boîte automatique</span>
              </label>
            </div>

            <div className="step-actions">
              <button type="button" className="btn-secondary" onClick={() => setActiveStep(2)}>
                Suivant <span>→</span>
              </button>
            </div>
          </div>

          {/* ÉTAPE 2 — MODÈLE & ORIGINE */}
          <div className={`form-step ${activeStep === 2 ? 'active' : ''}`}>
            <h3 className="step-title">🚗 Modèle, marque & carburant</h3>

            <div className="form-row">
              <div className="form-group">
                <label>⛽ Carburant</label>
                <select value={formData.carburant}
                  onChange={e => setFormData({ ...formData, carburant: e.target.value })}>
                  {formOptions.carburants.map(c => (
                    <option key={c.column} value={c.column}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>🏷️ Marque</label>
                <select value={formData.marque}
                  onChange={e => setFormData({ ...formData, marque: e.target.value })}>
                  {formOptions.marques.map(m => (
                    <option key={m.column} value={m.column}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>
                  🚙 Modèle
                  {loadingModeles && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--gold)' }}>chargement...</span>}
                </label>
                <select value={formData.modele}
                  onChange={e => setFormData({ ...formData, modele: e.target.value })}
                  disabled={loadingModeles || !formOptions.modeles?.length}>
                  {!formOptions.modeles?.length
                    ? <option value="">— Aucun modèle —</option>
                    : formOptions.modeles.map(m => (
                      <option key={m.column} value={m.column}>{m.label}</option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label>🌍 Origine</label>
                <select value={formData.origine}
                  onChange={e => setFormData({ ...formData, origine: e.target.value })}>
                  {formOptions.origines.map(o => (
                    <option key={o.column} value={o.column}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="step-actions">
              <button type="button" className="btn-secondary btn-back" onClick={() => setActiveStep(1)}>
                <span>←</span> Précédent
              </button>
              <button type="button" className="btn-secondary" onClick={() => setActiveStep(3)}>
                Suivant <span>→</span>
              </button>
            </div>
          </div>

          {/* ÉTAPE 3 — ÉQUIPEMENTS */}
          <div className={`form-step ${activeStep === 3 ? 'active' : ''}`}>
            <h3 className="step-title">🎨 Équipements ({formData.equipements.length} sélectionné{formData.equipements.length > 1 ? 's' : ''})</h3>

            <div className="equipements-grid">
              {EQUIPEMENTS_LIST.map(eq => {
                const active = formData.equipements.includes(eq.column);
                return (
                  <div
                    key={eq.column}
                    className={`chip-icon${active ? ' chip-active' : ''}`}
                    onClick={() => toggleEq(eq.column)}
                  >
                    <span className="chip-icon-emoji">{eq.icon}</span>
                    <span className="chip-icon-label">{eq.label}</span>
                    {active && <span className="chip-check">✓</span>}
                  </div>
                );
              })}
            </div>

            <div className="step-actions">
              <button type="button" className="btn-secondary btn-back" onClick={() => setActiveStep(2)}>
                <span>←</span> Précédent
              </button>
              <button type="submit" disabled={loading || loadingModeles} className="btn-primary btn-submit">
                {loading ? (
                  <>
                    <span className="spinner-inline"></span>
                    <span>Calcul en cours...</span>
                  </>
                ) : (
                  <>
                    <span className="btn-icon">🚀</span>
                    <span>Estimer le prix</span>
                    <span className="btn-shine"></span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

        {/* RÉSULTAT avec Speedometer */}
        {prediction !== null && (
          <div className="result-section fade-in" ref={resultRef}>
            <div className="result-divider">
              <span>RÉSULTAT</span>
            </div>

            <Speedometer
              value={prediction}
              min={0}
              max={500000}
              label="MAD"
              sublabel="Prix estimé"
            />

            {fourchette && (
              <div className="result-fourchette">
                <div className="fourchette-item">
                  <span className="fourchette-label">Minimum</span>
                  <span className="fourchette-value">{Math.round(fourchette.min).toLocaleString('fr-FR')} MAD</span>
                </div>
                <div className="fourchette-bar">
                  <div className="fourchette-fill"></div>
                  <div className="fourchette-dot"></div>
                </div>
                <div className="fourchette-item">
                  <span className="fourchette-label">Maximum</span>
                  <span className="fourchette-value">{Math.round(fourchette.max).toLocaleString('fr-FR')} MAD</span>
                </div>
              </div>
            )}

            <div className="result-actions">
              <button type="button" className="btn-secondary" onClick={handleReset}>
                <span>🔄</span> Nouvelle estimation
              </button>
            </div>
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}
      </div>
    </div>
  );
}
