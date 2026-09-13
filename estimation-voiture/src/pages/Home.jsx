import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useRef, useState } from 'react';
import AnimatedCounter from '../components/AnimatedCounter';

// Hook : reveal au scroll
function useScrollReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
}

function FeatureCard({ icon, title, desc, index }) {
  const [ref, visible] = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`feature-card ${visible ? 'reveal' : ''}`}
      style={{ transitionDelay: `${index * 0.1}s` }}
    >
      <div className="feature-icon-wrap">
        <span className="feature-icon">{icon}</span>
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

export default function Home() {
  const { token } = useAuth();
  const [statsRef, statsVisible] = useScrollReveal();
  const [ctaRef, ctaVisible] = useScrollReveal();

  return (
    <div className="page home-page">

      {/* HERO avec effet drive */}
      <section className="hero">
        <div className="hero-bg-decor">
          <div className="hero-circle hero-circle-1" />
          <div className="hero-circle hero-circle-2" />
          <div className="hero-grid" />
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            Propulsé par l'IA · Données Avito.ma
          </div>

          <h1 className="hero-title">
            Estimez le prix de votre voiture<br />
            <span className="accent gradient-text">
              au juste prix du marché
              <span className="title-cursor"></span>
            </span>
          </h1>

          <p className="hero-sub">
            Modèle de Machine Learning entraîné sur <strong>30 000+ annonces réelles</strong> du marché marocain.
            Précision <strong className="gold-text">R² = 0.91</strong> · Erreur moyenne <strong className="gold-text">~15 000 MAD</strong>.
          </p>

          <div className="hero-actions">
            {token ? (
              <>
                <Link to="/predict" className="btn-primary btn-hero">
                  <span className="btn-icon">🔧</span>
                  <span>Estimer maintenant</span>
                  <span className="btn-shine"></span>
                </Link>
                <Link to="/analyze" className="btn-secondary btn-hero">
                  <span className="btn-icon">🔍</span>
                  <span>Analyser une annonce</span>
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn-primary btn-hero">
                  <span>Commencer gratuitement</span>
                  <span className="btn-arrow">→</span>
                  <span className="btn-shine"></span>
                </Link>
                <Link to="/login" className="btn-secondary btn-hero">
                  <span>Se connecter</span>
                </Link>
              </>
            )}
          </div>

          {/* Scroll indicator */}
          <div className="scroll-indicator">
            <span className="scroll-mouse">
              <span className="scroll-wheel"></span>
            </span>
            <span className="scroll-text">Découvrir</span>
          </div>
        </div>

        {/* Voiture qui roule */}
        <div className="hero-car-track">
          <div className="hero-car">🏎️</div>
        </div>
      </section>

      {/* SECTION FEATURES */}
      <section className="features-section">
        <div className="section-header">
          <span className="section-tag">FONCTIONNALITÉS</span>
          <h2 className="section-title">Tout ce qu'il faut pour <span className="accent">décider</span></h2>
          <p className="section-sub">Quatre fonctionnalités majeures pour acheter et vendre en toute sérénité</p>
        </div>

        <div className="features">
          <FeatureCard
            index={0}
            icon="🤖"
            title="IA Stacking ensemble"
            desc="XGBoost + RandomForest combinés via Ridge regression, entraînés sur 30 000 annonces réelles. 663 features incluant marque, modèle, équipements et état."
          />
          <FeatureCard
            index={1}
            icon="🔧"
            title="Estimation manuelle"
            desc="Renseignez les caractéristiques de votre véhicule en quelques clics. L'IA calcule le prix juste avec fourchette de confiance ±15 000 MAD."
          />
          <FeatureCard
            index={2}
            icon="🔍"
            title="Analyse d'annonce Avito"
            desc="Collez une URL Avito.ma. L'IA scrape automatiquement les données et compare le prix demandé avec l'estimation du marché. Verdict instantané."
          />
          <FeatureCard
            index={3}
            icon="📊"
            title="Historique & Export"
            desc="Toutes vos estimations sauvegardées. Export CSV, mini graphiques d'évolution, et accès à votre historique paginé depuis votre espace personnel."
          />
        </div>
      </section>

      {/* SECTION STATS animées */}
      <section ref={statsRef} className={`stats-section ${statsVisible ? 'reveal' : ''}`}>
        <div className="section-header">
          <span className="section-tag">CHIFFRES CLÉS</span>
          <h2 className="section-title">Une IA <span className="accent">solide</span></h2>
        </div>

        <div className="stats-band">
          <div className="stat-item">
            <span className="stat-icon">📈</span>
            <span className="stat-num">
              {statsVisible && <AnimatedCounter value={30000} suffix="+" />}
            </span>
            <span className="stat-desc">annonces analysées</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">🎯</span>
            <span className="stat-num gradient-text">
              {statsVisible ? '0.91' : '0'}
            </span>
            <span className="stat-desc">précision R²</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">💰</span>
            <span className="stat-num">
              {statsVisible && <AnimatedCounter value={15000} suffix=" MAD" />}
            </span>
            <span className="stat-desc">erreur moyenne</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">🚗</span>
            <span className="stat-num">
              {statsVisible && <AnimatedCounter value={60} suffix="+" />}
            </span>
            <span className="stat-desc">marques couvertes</span>
          </div>
        </div>
      </section>

      {/* SECTION HOW IT WORKS */}
      <section className="how-section">
        <div className="section-header">
          <span className="section-tag">COMMENT ÇA MARCHE</span>
          <h2 className="section-title">3 étapes <span className="accent">simples</span></h2>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <span className="step-icon">📝</span>
            <h3>Renseignez les détails</h3>
            <p>Marque, modèle, année, kilométrage, équipements… ou collez directement une URL Avito.</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">2</div>
            <span className="step-icon">🤖</span>
            <h3>L'IA analyse</h3>
            <p>Le modèle Stacking compare votre véhicule à 30 000 annonces du marché en moins d'une seconde.</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">3</div>
            <span className="step-icon">✨</span>
            <h3>Recevez l'estimation</h3>
            <p>Prix juste avec fourchette de confiance. Sauvegardé dans votre historique pour comparaison future.</p>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      {!token && (
        <section ref={ctaRef} className={`cta-section ${ctaVisible ? 'reveal' : ''}`}>
          <div className="cta-bg-decor">
            <div className="cta-circle" />
          </div>
          <h2>Prêt à connaître la valeur réelle<br />de votre véhicule ?</h2>
          <p>Inscription gratuite en 30 secondes · Aucune carte bancaire requise</p>
          <Link to="/register" className="btn-primary btn-hero btn-large">
            <span>Démarrer maintenant</span>
            <span className="btn-arrow">→</span>
            <span className="btn-shine"></span>
          </Link>
        </section>
      )}

    </div>
  );
}
