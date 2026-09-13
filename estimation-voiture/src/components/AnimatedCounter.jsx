// ============================================================
// AnimatedCounter : nombre qui s'incrémente progressivement
// quand l'élément entre dans le viewport
// ============================================================
import { useEffect, useRef, useState } from 'react';

export default function AnimatedCounter({ value, duration = 2000, suffix = '', prefix = '' }) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTimestamp = null;
    const animate = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutQuart pour un effet d'arrivée fluide
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(eased * value));

      if (progress < 1) requestAnimationFrame(animate);
      else setCount(value);
    };
    requestAnimationFrame(animate);
  }, [hasStarted, value, duration]);

  const formatted = count.toLocaleString('fr-FR');
  return (
    <span ref={ref} className="animated-counter">
      {prefix}{formatted}{suffix}
    </span>
  );
}
