import { useEffect, useState } from 'react';

function seededUnit(index, salt) {
  const raw = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

/**
 * A lightweight, performant particle burst component for completion celebrations.
 * Renders 10-12 floating organic particles drifting outwards from the center.
 * Automatically cleans up its rendering after 800ms.
 */
export default function SuccessBurst({ active = true, particleCount = 12 }) {
  const [show, setShow] = useState(active);

  useEffect(() => {
    let showTimer;
    let hideTimer;

    if (!active) {
      showTimer = setTimeout(() => setShow(false), 0);
      return () => clearTimeout(showTimer);
    }

    showTimer = setTimeout(() => setShow(true), 0);
    hideTimer = setTimeout(() => {
      setShow(false);
    }, 800);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [active]);

  if (!show) return null;

  const particles = Array.from({ length: particleCount }).map((_, i) => {
    const angle = (i * 2 * Math.PI) / particleCount + (seededUnit(i, 1) * 0.4 - 0.2);
    const distance = 30 + seededUnit(i, 2) * 45; // distance in pixels
    const dx = `${Math.cos(angle) * distance}px`;
    const dy = `${Math.sin(angle) * distance}px`;
    
    // Theme-compatible organic palette colors
    const colors = [
      'var(--app-success)', // Green
      'var(--app-accent)',  // Accent Blue
      '#fbbf24',            // Gold
      '#34d399'             // Emerald
    ];
    const color = colors[i % colors.length];
    const size = `${Math.floor(seededUnit(i, 3) * 5) + 5}px`; // 5px - 9px
    const delay = `${seededUnit(i, 4) * 0.08}s`;

    return {
      id: i,
      style: {
        '--dx': dx,
        '--dy': dy,
        backgroundColor: color,
        width: size,
        height: size,
        animationDelay: delay,
      }
    };
  });

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-[9999]" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full animate-particle-drift"
          style={p.style}
        />
      ))}
    </div>
  );
}
