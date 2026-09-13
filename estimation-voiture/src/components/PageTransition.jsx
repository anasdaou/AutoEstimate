// ============================================================
// PageTransition : wrapper pour animer l'arrivée d'une page
// Effet "drive in" — la page glisse depuis la droite avec fade
// ============================================================
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageTransition({ children }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState('fadeIn');

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setStage('fadeOut');
    }
  }, [location, displayLocation]);

  const handleAnimationEnd = () => {
    if (stage === 'fadeOut') {
      setStage('fadeIn');
      setDisplayLocation(location);
    }
  };

  return (
    <div
      className={`page-transition ${stage}`}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}
