import { useState } from 'react';
import { useT } from './theme';
import { Ico, I, type SvgPath } from './icons';

const USER = { name: 'Dr. Aryan Singh', initials: 'AS', dept: 'Computer Science Engineering', role: 'Head of Department' };

export type NavId = 'review' | 'department' | 'alerts' | 'approved';

const NAV: { id: NavId; label: string; icon: SvgPath; badge?: number }[] = [
  { id: 'review',     label: 'Review Papers',   icon: I.doc,   badge: 5 },
  { id: 'department', label: 'Department',      icon: I.users },
  { id: 'alerts',     label: 'Teacher Alerts',  icon: I.bell },
  { id: 'approved',   label: 'Approved Papers', icon: I.lock },
];

function NavBtn({ item, active }: { item: typeof NAV[0]; active: boolean }) {
  const { T } = useT();
  const [hov, setHov] = useState(false);
  const bg = hov ? T.bgHover : 'transparent';
  const fg = active ? T.teal : hov ? T.ink : T.inkMid;
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '8.5px 10px', borderRadius: 8, marginBottom: 1,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        background: bg, color: fg, position: 'relative',
        transition: 'background 100ms, color 100ms',
      }}
    >
      {active && (
        <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 2.5, height: 18, background: T.teal, borderRadius: '0 2px 2px 0' }} />
      )}
      <span style={{ lineHeight: 0 }}><Ico d={item.icon} size={14} /></span>
      <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, flex: 1, letterSpacing: '-0.01em' }}>{item.label}</span>
      {item.badge != null && (
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500,
          padding: '2px 7px', borderRadius: 99,
          background: active ? T.tealMid : T.bgHover,
          color: active ? T.teal : T.inkDim,
          minWidth: 22, textAlign: 'center',
        }}>
          {item.badge}
        </span>
      )}
    </button>
  );
}

export function Sidebar({ active, onNav }: { active: NavId; onNav: (id: NavId) => void }) {
  const { T } = useT();
  return (
    <aside style={{
      width: 232, minHeight: '100vh', background: T.sidebar,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'sticky', top: 0, height: '100vh',
      borderRight: `1px solid ${T.border}`,
    }}>
      {/* Brand */}
      <div style={{ padding: '22px 16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(145deg, #12b09a, #0a7a6a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 2px 8px rgba(12,143,126,0.35)',
          }}>
            <Ico d={I.shield} size={16} stroke={1.5} />
          </div>
          <div>
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 400, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.2 }}>ExamVault</p>
            <p style={{ fontSize: 10.5, color: T.inkDim, letterSpacing: '0.04em' }}>HOD Portal</p>
          </div>
        </div>
        <div style={{ padding: '9px 12px', borderRadius: 8, background: T.tealSoft, border: `1px solid rgba(13,122,107,0.15)` }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: T.inkDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Department</p>
          <p style={{ fontSize: 11.5, fontWeight: 500, color: T.teal, lineHeight: 1.4 }}>{USER.dept}</p>
        </div>
      </div>

      <div style={{ height: 1, background: T.border, margin: '0 12px' }} />

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1, overflowY: 'auto' }}>
        <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: T.inkDim, textTransform: 'uppercase', padding: '0 10px 8px' }}>
          Workspace
        </p>
        {NAV.map(item => (
          <div key={item.id} onClick={() => onNav(item.id)} style={{ cursor: 'pointer' }}>
            <NavBtn item={item} active={active === item.id} />
          </div>
        ))}

        <div style={{ height: 1, background: T.border, margin: '10px 10px' }} />

        <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: T.inkDim, textTransform: 'uppercase', padding: '0 10px 8px' }}>
          Account
        </p>
        <NavBtn item={{ id: 'department', label: 'Profile', icon: I.profile }} active={false} />
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 12px 14px', borderTop: `1px solid ${T.border}`, background: T.sidebarFoot }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: T.tealSoft, border: `1px solid rgba(13,122,107,0.18)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500, color: T.teal, letterSpacing: '0.05em',
          }}>
            {USER.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 500, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{USER.name}</p>
            <p style={{ fontSize: 10.5, color: T.inkDim, marginTop: 1 }}>{USER.role}</p>
          </div>
          <button
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.inkDim, padding: 5, borderRadius: 6, lineHeight: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = T.rose)}
            onMouseLeave={e => (e.currentTarget.style.color = T.inkDim)}
            title="Sign out"
          >
            <Ico d={I.logout} size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
