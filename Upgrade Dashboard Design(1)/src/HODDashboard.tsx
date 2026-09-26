import { useState } from 'react';
import { ThemeCtx, LIGHT, DARK } from './theme';
import { Sidebar, type NavId } from './Sidebar';
import { ReviewView } from './ReviewView';

export function HODDashboard() {
  const [dark, setDark] = useState(false);
  const T = dark ? DARK : LIGHT;
  const toggle = () => setDark(d => !d);

  return (
    <ThemeCtx.Provider value={{ T, dark, toggle }}>
      <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <Sidebar active={'review' as NavId} onNav={() => {}} />
        <ReviewView />
      </div>
    </ThemeCtx.Provider>
  );
}
