// ============================================================
// Speedometer : affichage du résultat sous forme de compteur
// de vitesse stylisé — pile dans le thème voiture
// ============================================================
import { useEffect, useState } from 'react';

export default function Speedometer({ value, min = 0, max = 500000, label = 'MAD', sublabel = '' }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Animation d'arrivée
    let start = null;
    const duration = 2000;
    const startValue = displayValue;
    const targetValue = value;

    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + (targetValue - startValue) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  // Calcul de l'angle de l'aiguille (de -135° à +135°)
  const percentage = Math.max(0, Math.min(1, (displayValue - min) / (max - min)));
  const needleRotation = -135 + percentage * 270;

  // Couleur de l'arc selon le segment
  const getSegmentColor = (segIndex) => {
    const segPercent = (segIndex + 1) / 10;
    if (percentage >= segPercent) {
      if (segPercent < 0.4) return '#2ecc71';      // vert
      if (segPercent < 0.7) return '#f0b90b';      // or
      return '#e74c3c';                            // rouge
    }
    return 'var(--border)';
  };

  // Génère les 10 segments de l'arc
  const segments = Array.from({ length: 10 }).map((_, i) => {
    const start = -135 + (i * 27);
    const end = -135 + ((i + 1) * 27) - 3;
    const startRad = (start * Math.PI) / 180;
    const endRad = (end * Math.PI) / 180;
    const x1 = 150 + 110 * Math.cos(startRad);
    const y1 = 150 + 110 * Math.sin(startRad);
    const x2 = 150 + 110 * Math.cos(endRad);
    const y2 = 150 + 110 * Math.sin(endRad);
    const x3 = 150 + 85 * Math.cos(endRad);
    const y3 = 150 + 85 * Math.sin(endRad);
    const x4 = 150 + 85 * Math.cos(startRad);
    const y4 = 150 + 85 * Math.sin(startRad);
    return {
      path: `M ${x1} ${y1} A 110 110 0 0 1 ${x2} ${y2} L ${x3} ${y3} A 85 85 0 0 0 ${x4} ${y4} Z`,
      color: getSegmentColor(i),
    };
  });

  return (
    <div className="speedometer">
      <svg viewBox="0 0 300 180" className="speedo-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="speedoBg" cx="50%" cy="60%" r="60%">
            <stop offset="0%" stopColor="rgba(240,185,11,0.15)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Fond circulaire */}
        <circle cx="150" cy="150" r="120" fill="url(#speedoBg)" />

        {/* Segments colorés */}
        {segments.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            style={{ transition: 'fill 0.3s ease' }}
          />
        ))}

        {/* Graduations */}
        {Array.from({ length: 11 }).map((_, i) => {
          const angle = -135 + (i * 27);
          const rad = (angle * Math.PI) / 180;
          const x1 = 150 + 75 * Math.cos(rad);
          const y1 = 150 + 75 * Math.sin(rad);
          const x2 = 150 + 65 * Math.cos(rad);
          const y2 = 150 + 65 * Math.sin(rad);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--text)" strokeWidth="2" opacity="0.6" />
          );
        })}

        {/* Aiguille */}
        <g style={{
          transform: `rotate(${needleRotation}deg)`,
          transformOrigin: '150px 150px',
          transition: 'transform 0.3s ease-out'
        }}>
          <line x1="150" y1="150" x2="150" y2="60"
            stroke="var(--gold)" strokeWidth="4"
            strokeLinecap="round" filter="url(#glow)" />
        </g>

        {/* Centre */}
        <circle cx="150" cy="150" r="12" fill="var(--gold)" filter="url(#glow)" />
        <circle cx="150" cy="150" r="6" fill="var(--bg)" />
      </svg>

      <div className="speedo-value">
        <span className="speedo-number">{displayValue.toLocaleString('fr-FR')}</span>
        <span className="speedo-unit">{label}</span>
        {sublabel && <span className="speedo-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
}
