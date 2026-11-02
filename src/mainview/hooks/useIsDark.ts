import { useEffect, useState } from 'react';

// Tracks the app theme (the `dark` class useTheme puts on <html>), so components
// deep in the tree can react to theme toggles without prop drilling.
export function useIsDark(): boolean {
  const read = () => document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(read);

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setDark(read());
    return () => observer.disconnect();
  }, []);

  return dark;
}
