// ============================================================
// Background animé : route + voitures en mouvement
// Effet de "drive" en arrière-plan
// ============================================================
import { useEffect, useState } from 'react';

export default function AnimatedBackground() {
  const [cars, setCars] = useState([]);

  useEffect(() => {
    // Générer 5 voitures à des positions/vitesses aléatoires
    const initial = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      top: 15 + Math.random() * 70,      // entre 15% et 85% de hauteur
      duration: 15 + Math.random() * 20, // entre 15s et 35s
      delay: Math.random() * 10,
      emoji: ['🚗', '🚙', '🏎️', '🚓', '🚕'][i % 5],
      size: 24 + Math.random() * 16,
    }));
    setCars(initial);
  }, []);

  return (
    <div className="animated-bg" aria-hidden="true">
      {/* Lignes de route */}
      <div className="road-lines">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="road-line"
            style={{ top: `${(i * 12) + 5}%`, animationDelay: `${i * 0.3}s` }}
          />
        ))}
      </div>

      {/* Voitures qui passent */}
      {cars.map(c => (
        <span
          key={c.id}
          className="bg-car"
          style={{
            top: `${c.top}%`,
            fontSize: `${c.size}px`,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
          }}
        >
          {c.emoji}
        </span>
      ))}

      {/* Particules dorées qui flottent */}
      <div className="particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${10 + Math.random() * 15}s`,
              animationDelay: `${Math.random() * 10}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
