export default function About() {
  return (
    <div className="page">
      <div className="card about-card">
        <div className="card-header">
          <span className="card-icon">ℹ️</span>
          <h2>À propos d'AutoEstimate</h2>
        </div>

        <section className="about-section">
          <h3>🎯 Objectif</h3>
          <p>
            AutoEstimate est une plateforme web d'estimation du prix des voitures d'occasion
            au Maroc. Elle permet aux acheteurs et vendeurs d'obtenir une estimation objective
            basée sur les données réelles du marché marocain.
          </p>
        </section>

        <section className="about-section">
          <h3>🤖 Le modèle IA</h3>
          <div className="about-grid">
            <div className="about-item">
              <span className="about-label">Dataset</span>
              <span className="about-val">~30 000 annonces Avito.ma</span>
            </div>
            <div className="about-item">
              <span className="about-label">Algorithme</span>
              <span className="about-val">Stacking (XGBoost + RandomForest → Ridge)</span>
            </div>
            <div className="about-item">
              <span className="about-label">Précision R²</span>
              <span className="about-val accent">0.9052</span>
            </div>
            <div className="about-item">
              <span className="about-label">Erreur moyenne (MAE)</span>
              <span className="about-val">~15 200 MAD</span>
            </div>
            <div className="about-item">
              <span className="about-label">Features</span>
              <span className="about-val">663 colonnes (marques, modèles, équipements...)</span>
            </div>
            <div className="about-item">
              <span className="about-label">Marques couvertes</span>
              <span className="about-val">60+ marques, 300+ modèles</span>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h3>⚙️ Stack technique</h3>
          <div className="tech-badges">
            {['Python', 'Flask', 'Scikit-learn', 'XGBoost', 'Selenium',
              'React 19', 'Vite', 'SQLite', 'JWT', 'BeautifulSoup'].map(t => (
              <span key={t} className="tech-badge">{t}</span>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h3>📌 Fonctionnalités</h3>
          <ul className="about-list">
            <li>✅ Estimation manuelle via formulaire détaillé</li>
            <li>✅ Analyse automatique d'une annonce Avito par URL</li>
            <li>✅ Comparaison prix annonce vs prix marché</li>
            <li>✅ Fourchette de prix estimée (±MAE)</li>
            <li>✅ Historique personnel avec export CSV</li>
            <li>✅ Système de comptes avec authentification JWT</li>
            <li>✅ Dashboard administrateur avec statistiques</li>
          </ul>
        </section>

        <section className="about-section">
          <h3>⚠️ Limites</h3>
          <p>
            Les estimations sont basées sur des données historiques du marché marocain.
            Elles constituent une indication et non une valeur garantie.
            Le prix réel peut varier selon l'état exact du véhicule, la région, et la négociation.
          </p>
        </section>

        {/* [B18] Lien vers le code source / notebook */}
        <section className="about-section">
          <h3>📂 Code source</h3>
          <p>
            Ce projet est un Projet de Fin d'Année (PFA). Le notebook d'entraînement du modèle
            (<code>etape1_preprocessing.ipynb</code>) documente l'ensemble du pipeline :
            nettoyage des données, feature engineering, comparaison des modèles,
            et sélection du stacking final.
          </p>
        </section>

      </div>
    </div>
  );
}
