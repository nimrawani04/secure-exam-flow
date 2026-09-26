import { useState } from 'react';
import { useT } from './theme';
import { Ico, I } from './icons';

const USER_NAME = 'Dr. Aryan Singh';
const USER_INITIALS = 'AS';
const DEPT = 'Computer Science Engineering';

const PAPERS_RAW = [
  { id: 'p1', subjectId: 's1', subject: 'Data Structures & Algorithms', code: 'CS-301', anon: 'Submission 1', deadline: new Date(Date.now() + 1.4 * 864e5), set: 'A' },
  { id: 'p2', subjectId: 's1', subject: 'Data Structures & Algorithms', code: 'CS-301', anon: 'Submission 2', deadline: new Date(Date.now() + 1.4 * 864e5), set: 'B' },
  { id: 'p3', subjectId: 's2', subject: 'Database Management Systems',  code: 'CS-302', anon: 'Submission 1', deadline: new Date(Date.now() + 4.8 * 864e5), set: 'A' },
  { id: 'p4', subjectId: 's3', subject: 'Operating Systems',            code: 'CS-303', anon: 'Submission 1', deadline: new Date(Date.now() + 7.5 * 864e5), set: 'A' },
  { id: 'p5', subjectId: 's4', subject: 'Computer Networks',            code: 'CS-304', anon: 'Submission 1', deadline: new Date(Date.now() + 11 * 864e5),  set: 'A' },
];

/* ── Helpers ── */
function daysLeft(d: Date) { return Math.ceil((d.getTime() - Date.now()) / 864e5); }
function fmtDate(d: Date) { return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
function greeting() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; }

/* ── Pulse ── */
function Pulse({ color }: { color: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7, flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, animation: 'ping 1.6s ease-out infinite' }} />
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, position: 'relative' }} />
    </span>
  );
}

/* ── Counter ── */
function Counter({ to }: { to: number }) {
  const [n, setN] = useState(0);
  const ran = useState(false);
  if (!ran[0] && to > 0) {
    ran[1](true);
    let v = 0;
    const step = Math.max(1, Math.ceil(to / 18));
    const id = setInterval(() => { v = Math.min(v + step, to); setN(v); if (v >= to) clearInterval(id); }, 28);
  }
  return <>{n}</>;
}

/* ── ThemeToggle ── */
function ThemeToggle() {
  const { T, dark, toggle } = useT();
  return (
    <button
      onClick={toggle}
      title={dark ? 'Light mode' : 'Dark mode'}
      style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, color: T.inkMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.background = T.bgHover; el.style.color = T.ink; }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.background = T.panel; el.style.color = T.inkMid; }}
    >
      <Ico d={dark ? I.sun : I.moon} size={14} />
    </button>
  );
}

/* ── Header ── */
function Header({ pending }: { pending: number }) {
  const { T } = useT();
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 20, background: T.headerBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${T.border}`, padding: '0 40px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: T.inkDim }}>ExamVault</span>
        <span style={{ fontSize: 12, color: T.inkDim, margin: '0 1px' }}>/</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: T.ink }}>Review Papers</span>
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {pending > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 99, background: T.amberSoft, border: `1px solid ${T.amberLine}33`, fontSize: 11.5, fontWeight: 500, color: T.amber }}>
            <Pulse color={T.amberLine} />
            {pending} pending
          </div>
        )}
        <ThemeToggle />
        <div style={{ width: 30, height: 30, borderRadius: 8, background: T.tealSoft, border: `1px solid rgba(13,122,107,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500, color: T.teal, cursor: 'pointer' }}>
          {USER_INITIALS}
        </div>
      </div>
    </header>
  );
}

/* ── StatRow ── */
function StatRow({ pending, approved, rejected, locked }: { pending: number; approved: number; rejected: number; locked: number }) {
  const { T } = useT();
  const stats = [
    { label: 'Pending review', value: pending,  color: T.amber,   line: T.amberLine,   soft: T.amberSoft,   hint: 'Awaiting selection' },
    { label: 'Approved',       value: approved, color: T.emerald, line: T.emeraldLine, soft: T.emeraldSoft },
    { label: 'Rejected',       value: rejected, color: T.rose,    line: T.roseLine,    soft: T.roseSoft },
    { label: 'Locked & sent',  value: locked,   color: T.violet,  line: T.violetLine,  soft: T.violetSoft,  hint: 'Sent to exam cell' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 28 }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{ padding: '20px 24px 22px', borderRight: i < 3 ? `1px solid ${T.border}` : 'none', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 2, background: s.line, borderRadius: '0 0 3px 3px', opacity: 0.7 }} />
          <div style={{ position: 'absolute', top: -20, right: -10, width: 80, height: 80, borderRadius: '50%', background: s.soft, filter: 'blur(20px)', pointerEvents: 'none' }} />
          <p style={{ fontSize: 10.5, fontWeight: 600, color: T.inkDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{s.label}</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 46, fontWeight: 400, color: s.color, lineHeight: 1, letterSpacing: '-0.04em' }}>
            <Counter to={s.value} />
          </p>
          {s.hint && <p style={{ fontSize: 11, color: T.inkDim, marginTop: 8 }}>{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}

/* ── SubjectNav ── */
function SubjectNav({ subjects, active, onSelect }: {
  subjects: { id: string; name: string; code: string; count: number; deadline: Date }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const { T } = useT();
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 66 }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: T.inkDim, letterSpacing: '0.09em', textTransform: 'uppercase' }}>Subjects</p>
      </div>
      {subjects.map((s, i) => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{ width: '100%', textAlign: 'left', padding: '11px 16px', border: 'none', cursor: 'pointer', borderBottom: i < subjects.length - 1 ? `1px solid ${T.border}` : 'none', background: 'transparent', position: 'relative' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.bgHover; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {isActive && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5, background: T.teal, borderRadius: '0 2px 2px 0' }} />}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: isActive ? 500 : 400, color: isActive ? T.teal : T.ink, lineHeight: 1.35, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: T.inkDim }}>{s.code}</span>
                  {daysLeft(s.deadline) <= 3 && <span style={{ fontSize: 10, color: T.amber, fontWeight: 600 }}>· Due soon</span>}
                </div>
              </div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, fontWeight: 500, flexShrink: 0, padding: '2px 7px', borderRadius: 99, marginTop: 1, background: isActive ? T.tealMid : T.bgHover, color: isActive ? T.teal : T.inkMid }}>
                {s.count}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── PaperRow ── */
function PaperRow({ paper, selected, onClick }: { paper: typeof PAPERS_RAW[0]; selected: boolean; onClick: () => void }) {
  const { T } = useT();
  const [hov, setHov] = useState(false);
  const days = daysLeft(paper.deadline);
  const urgent = days <= 3;
  return (
    <tr onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ cursor: 'pointer', background: selected ? T.tealSoft : hov ? T.bgHover : 'transparent' }}>
      <td style={{ padding: '12px 14px 12px 16px', width: 40, borderBottom: `1px solid ${T.borderSoft}`, position: 'relative' }}>
        {selected && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5, background: T.teal }} />}
        <div style={{ width: 28, height: 28, borderRadius: 7, background: selected ? T.tealMid : T.bgHover, border: `1px solid ${selected ? 'rgba(13,122,107,0.2)' : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: selected ? T.teal : T.inkMid }}>
          <Ico d={I.doc} size={12} />
        </div>
      </td>
      <td style={{ padding: '12px 8px', borderBottom: `1px solid ${T.borderSoft}` }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 2 }}>{paper.anon}</p>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: T.inkDim }}>Set {paper.set} · {paper.code}</p>
      </td>
      <td style={{ padding: '12px 16px', borderBottom: `1px solid ${T.borderSoft}`, verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: urgent ? T.amber : T.inkMid, fontWeight: urgent ? 500 : 400 }}>{fmtDate(paper.deadline)}</span>
          {urgent && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: T.amberSoft, color: T.amber, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{days <= 0 ? 'Overdue' : `${days}d`}</span>}
        </div>
      </td>
      <td style={{ padding: '12px 16px 12px 8px', borderBottom: `1px solid ${T.borderSoft}`, textAlign: 'right', color: selected ? T.teal : T.inkDim, width: 30 }}>
        <Ico d={I.chevR} size={13} />
      </td>
    </tr>
  );
}

/* ══════════════════════════════════════════
   MAIN VIEW EXPORT
══════════════════════════════════════════ */
export function ReviewView() {
  const { T } = useT();
  const [activeSubject, setActiveSubject] = useState('s1');
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [locked, setLocked] = useState<string[]>([]);
  const [dismissedReq, setDismissedReq] = useState(false);

  const papers = PAPERS_RAW.filter(p => !locked.includes(p.id));

  const subjectMap = new Map<string, { id: string; name: string; code: string; count: number; deadline: Date }>();
  papers.forEach(p => {
    const ex = subjectMap.get(p.subjectId);
    if (!ex) subjectMap.set(p.subjectId, { id: p.subjectId, name: p.subject, code: p.code, count: 1, deadline: p.deadline });
    else { ex.count++; if (p.deadline < ex.deadline) ex.deadline = p.deadline; }
  });
  const subjects = Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const visiblePapers = papers.filter(p => p.subjectId === activeSubject);
  const selPaper = papers.find(p => p.id === selectedPaper);
  const pendingCount = papers.length;
  const lockedCount = 2 + locked.length;

  const handleApprove = () => {
    if (!selectedPaper) return;
    setApproving(true);
    setTimeout(() => { setLocked(prev => [...prev, selectedPaper]); setSelectedPaper(null); setApproving(false); }, 900);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Header pending={pendingCount} />

      <main style={{ flex: 1, padding: '36px 40px 64px' }}>
        {/* Heading */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: T.inkDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Good {greeting()}, Dr. Singh
          </p>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 46, fontWeight: 300, fontStyle: 'italic', lineHeight: 1.1, letterSpacing: '-0.025em', color: T.ink, marginBottom: 14 }}>
            {pendingCount > 0
              ? <>{pendingCount} paper{pendingCount !== 1 ? 's' : ''} need <em style={{ fontStyle: 'normal' }}>your eye</em></>
              : <>All <em style={{ fontStyle: 'normal', color: T.teal }}>caught up</em>.</>}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ height: 1, width: 32, background: T.border }} />
            <p style={{ fontSize: 13, color: T.inkMid }}>{subjects.length} subject{subjects.length !== 1 ? 's' : ''} pending · {DEPT}</p>
          </div>
        </div>

        <StatRow pending={pendingCount} approved={1} rejected={1} locked={lockedCount} />

        {/* Anon notice */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 10, background: T.violetSoft, border: `1px solid ${T.violetLine}28`, marginBottom: 20 }}>
          <span style={{ color: T.violet, lineHeight: 0, marginTop: 1, flexShrink: 0 }}><Ico d={I.eye} size={14} /></span>
          <p style={{ fontSize: 12.5, lineHeight: 1.65, color: T.inkMid }}>
            <strong style={{ color: T.ink, fontWeight: 600 }}>Anonymous review is active.</strong>{' '}
            Teacher identities are hidden — submission labels only until after locking.
          </p>
        </div>

        {/* Replacement request */}
        {!dismissedReq && (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.roseLine}30`, background: T.roseSoft, position: 'relative', marginBottom: 20 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: T.roseLine }} />
            <div style={{ padding: '14px 18px 14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Pulse color={T.roseLine} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 2 }}>
                    Replacement needed — Software Engineering (CS-401)
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: T.roseSoft, color: T.rose, letterSpacing: '0.05em', textTransform: 'uppercase', border: `1px solid ${T.roseLine}40`, verticalAlign: 'middle' }}>Critical</span>
                  </p>
                  <p style={{ fontSize: 12, color: T.inkMid }}>Paper accidentally shared before print. Select a replacement immediately.</p>
                </div>
              </div>
              <button onClick={() => setDismissedReq(true)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, color: T.ink, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
                Acknowledge <Ico d={I.chevR} size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Two-column */}
        <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 20 }}>
          <SubjectNav subjects={subjects} active={activeSubject} onSelect={id => { setActiveSubject(id); setSelectedPaper(null); }} />

          <div>
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, background: T.bg, display: 'grid', gridTemplateColumns: '40px 1fr 160px 30px' }}>
                {['', 'Submission', 'Deadline', ''].map((h, i) => (
                  <p key={i} style={{ fontSize: 10, fontWeight: 700, color: T.inkDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</p>
                ))}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {visiblePapers.length === 0
                    ? <tr><td colSpan={4} style={{ padding: '52px 20px', textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 500, color: T.inkMid, marginBottom: 4 }}>Nothing pending here</p><p style={{ fontSize: 12, color: T.inkDim }}>New submissions land here automatically.</p></td></tr>
                    : visiblePapers.map(p => <PaperRow key={p.id} paper={p} selected={selectedPaper === p.id} onClick={() => setSelectedPaper(selectedPaper === p.id ? null : p.id)} />)
                  }
                </tbody>
              </table>
            </div>

            {/* Approve bar */}
            {selectedPaper && selPaper && (
              <div style={{ marginTop: 10, padding: '13px 18px', borderRadius: 12, border: `1px solid ${T.teal}35`, background: T.tealSoft, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: T.tealMid, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.teal }}>
                    <Ico d={I.check} size={13} stroke={1.7} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>{selPaper.anon} selected</p>
                    <p style={{ fontSize: 11.5, color: T.inkMid }}>{selPaper.subject} · Set {selPaper.set} · Due {fmtDate(selPaper.deadline)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleApprove} disabled={approving}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${T.tealBright}, ${T.teal})`, color: '#fff', fontSize: 13, fontWeight: 600, opacity: approving ? 0.7 : 1, boxShadow: `0 2px 8px ${T.teal}40` }}
                  >
                    {approving
                      ? <svg width={13} height={13} viewBox="0 0 13 13" fill="none" style={{ animation: 'spin 0.7s linear infinite' }}><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="22" strokeDashoffset="7" /></svg>
                      : <Ico d={I.lock} size={13} stroke={1.5} />}
                    {approving ? 'Locking…' : 'Approve & lock'}
                  </button>
                  <button onClick={() => setSelectedPaper(null)} style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.panel, color: T.inkMid, fontSize: 13, cursor: 'pointer' }}>Clear</button>
                </div>
              </div>
            )}

            {/* Lock warning */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 10, background: T.amberSoft, border: `1px solid ${T.amberLine}28`, marginTop: 14 }}>
              <span style={{ color: T.amber, lineHeight: 0, marginTop: 1, flexShrink: 0 }}><Ico d={I.warn} size={14} /></span>
              <p style={{ fontSize: 12.5, lineHeight: 1.65, color: T.inkMid }}>
                <strong style={{ color: T.ink, fontWeight: 600 }}>Locking is irreversible.</strong>{' '}
                Once approved, the paper goes to the Exam Cell and all other submissions for that subject are auto-rejected.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
