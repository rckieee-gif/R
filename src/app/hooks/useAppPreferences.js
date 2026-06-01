import { useState, useEffect } from 'react';

const ZERO_GRAVITY_STORAGE_KEY = 'octavioZeroGravityEnabled';
const LEGACY_ZERO_GRAVITY_STORAGE_KEY = 'antigravityMode';

function readZeroGravityPreference() {
  const saved = localStorage.getItem(ZERO_GRAVITY_STORAGE_KEY);

  return saved !== 'false';
}

export default function useAppPreferences() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('themeMode');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('themeMode', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const [isZeroGravity, setIsZeroGravity] = useState(readZeroGravityPreference);

  useEffect(() => {
    document.body.classList.toggle('antigravity-active', isZeroGravity);
    localStorage.setItem(ZERO_GRAVITY_STORAGE_KEY, String(isZeroGravity));
    localStorage.setItem(LEGACY_ZERO_GRAVITY_STORAGE_KEY, String(isZeroGravity));

    return () => {
      document.body.classList.remove('antigravity-active');
    };
  }, [isZeroGravity]);

  const [isNavMinimized, setIsNavMinimized] = useState(() => {
    const saved = localStorage.getItem('octavioNavMinimized');
    return saved ? saved === 'true' : false;
  });

  const toggleNavMinimized = () => {
    setIsNavMinimized((prev) => {
      const next = !prev;
      localStorage.setItem('octavioNavMinimized', String(next));
      return next;
    });
  };

  return { isDarkMode, setIsDarkMode, isZeroGravity, setIsZeroGravity, isNavMinimized, toggleNavMinimized };
}
