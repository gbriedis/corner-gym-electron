// DevDashboard.tsx — developer diagnostic tool accessible via Ctrl+Shift+D or /dev.
// Not a game screen. Dense information is intentional — this is for the developer.
// All soul traits are revealed here — ocean rule does not apply in dev mode.

import { type JSX, useState, useEffect, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import {
  devWorldSummary, devFighterList, devFighterDetail,
  devAttributeDistribution, devBoutLog, devGymFinancials, devGymList,
} from '../ipc/client'
import type {
  WorldDevSummary, FighterListItem, FighterDevDetail,
  AttributeDistributionResult, BoutLogEntry, BoutLogSummary,
  GymFinancialDetail, GymListItem, DevFighterFilters,
} from '../electron'

// ─── Style constants ──────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: '#1a1c22',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: 'var(--font-body)',
    fontSize: '12px',
    color: 'var(--color-text-primary)',
    zIndex: 9999,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '0 16px',
    height: '40px',
    borderBottom: 'var(--border-mid)',
    backgroundColor: '#13151a',
    flexShrink: 0,
  },
  devBadge: {
    fontFamily: 'var(--font-body)',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--color-accent-amber)',
    letterSpacing: '2px',
    border: '1px solid var(--color-accent-amber)',
    padding: '2px 6px',
  },
  headerInfo: {
    fontSize: '11px',
    color: 'var(--color-text-muted)',
    flex: 1,
  },
  closeBtn: {
    fontSize: '11px',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: '4px 8px',
    border: 'var(--border-subtle)',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '160px',
    borderRight: 'var(--border-mid)',
    backgroundColor: '#13151a',
    padding: '8px 0',
    flexShrink: 0,
  },
  navItem: (active: boolean) => ({
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '8px 16px',
    fontSize: '11px',
    color: active ? 'var(--color-accent-amber)' : 'var(--color-text-muted)',
    backgroundColor: active ? 'rgba(238,178,74,0.08)' : 'transparent',
    borderLeft: active ? '2px solid var(--color-accent-amber)' : '2px solid transparent',
    cursor: 'pointer',
  }),
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--color-accent-amber)',
    letterSpacing: '1px',
    marginBottom: '12px',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  statBlock: {
    borderLeft: '2px solid rgba(238,178,74,0.3)',
    paddingLeft: '8px',
    marginBottom: '8px',
  },
  label: {
    fontSize: '10px',
    color: 'var(--color-text-muted)',
    marginBottom: '2px',
  },
  value: {
    fontSize: '13px',
    color: 'var(--color-text-primary)',
  },
  amber: {
    color: 'var(--color-accent-amber)',
  },
  muted: {
    color: 'var(--color-text-muted)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '11px',
  },
  th: {
    textAlign: 'left' as const,
    padding: '4px 8px',
    color: 'var(--color-text-muted)',
    fontSize: '10px',
    borderBottom: 'var(--border-subtle)',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '4px 8px',
    borderBottom: '1px solid rgba(218,212,201,0.04)',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: 'var(--border-subtle)',
    color: 'var(--color-text-primary)',
    padding: '4px 8px',
    fontSize: '11px',
    outline: 'none',
  },
  select: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: 'var(--border-subtle)',
    color: 'var(--color-text-primary)',
    padding: '4px 8px',
    fontSize: '11px',
    outline: 'none',
  },
  btn: {
    backgroundColor: 'rgba(238,178,74,0.12)',
    border: '1px solid rgba(238,178,74,0.3)',
    color: 'var(--color-accent-amber)',
    padding: '4px 12px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  dangerBtn: {
    backgroundColor: 'rgba(220,98,80,0.12)',
    border: '1px solid rgba(220,98,80,0.4)',
    color: 'var(--color-accent-red)',
    padding: '6px 16px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  divider: {
    borderTop: 'var(--border-subtle)',
    margin: '12px 0',
  },
  barTrack: {
    height: '8px',
    backgroundColor: 'rgba(255,255,255,0.06)',
    flex: 1,
  },
  barFill: (pct: number) => ({
    height: '100%',
    width: `${Math.min(100, pct)}%`,
    backgroundColor: 'var(--color-accent-amber)',
  }),
  identityBadge: (state: string) => ({
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    padding: '1px 5px',
    color: state === 'competing' ? '#55927f' :
           state === 'retired' ? '#deada5' :
           state === 'aspiring' ? '#eeb24a' :
           '#5a8bde',
    border: `1px solid ${
      state === 'competing' ? '#55927f' :
      state === 'retired' ? 'rgba(222,173,165,0.4)' :
      state === 'aspiring' ? 'rgba(238,178,74,0.5)' :
      'rgba(90,139,222,0.5)'
    }`,
  }),
}

type NavSection = 'overview' | 'fighters' | 'attributes' | 'bouts' | 'financials' | 'regenerate'

const NAV_ITEMS: Array<{ id: NavSection; label: string }> = [
  { id: 'overview', label: 'World Overview' },
  { id: 'fighters', label: 'Fighter Browser' },
  { id: 'attributes', label: 'Attribute Dist.' },
  { id: 'bouts', label: 'Bout Log' },
  { id: 'financials', label: 'Gym Financials' },
  { id: 'regenerate', label: 'Regenerate' },
]

// ─── Section: World Overview ──────────────────────────────────────────────────

function WorldOverview({ saveId }: { saveId: string }): JSX.Element {
  const [summary, setSummary] = useState<WorldDevSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    devWorldSummary(saveId)
      .then(s => { setSummary(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [saveId])

  if (loading) return <p style={S.muted}>Loading…</p>
  if (summary === null) return <p style={S.muted}>No summary data available.</p>

  const maxWc = Math.max(...summary.weightClassDistribution.map(w => w.count), 1)

  return (
    <div>
      <p style={S.sectionTitle}>WORLD OVERVIEW</p>
      <p style={{ ...S.muted, marginBottom: '16px', fontSize: '11px' }}>
        Seed: {summary.seed} · Backrun ended {summary.currentYear}
      </p>

      <div style={S.grid2}>
        {summary.nationSummaries.map(n => (
          <div key={n.nationId} style={{ borderTop: '1px solid rgba(238,178,74,0.2)', paddingTop: '12px' }}>
            <p style={{ ...S.sectionTitle, marginBottom: '8px' }}>{n.nationId.toUpperCase()}</p>
            <div style={S.statBlock}>
              <div style={S.label}>PERSONS</div>
              <div style={S.value}>{n.personCount.toLocaleString()}</div>
            </div>
            <div style={S.statBlock}>
              <div style={S.label}>GYMS</div>
              <div style={S.value}>{n.gymCount}</div>
            </div>
            <div style={S.statBlock}>
              <div style={S.label}>FIGHTERS</div>
              <div style={S.value}>{n.fighterCount.toLocaleString()}</div>
            </div>
            <div style={S.statBlock}>
              <div style={S.label}>COMPETING</div>
              <div style={S.value}>{n.competingCount}</div>
            </div>
            <div style={S.statBlock}>
              <div style={S.label}>ASPIRING / CURIOUS / UNAWARE</div>
              <div style={S.value}>{n.aspiringCount} / {n.curiousCount} / {n.unawareCount}</div>
            </div>
            <div style={S.statBlock}>
              <div style={S.label}>RETIRED</div>
              <div style={S.value}>{n.retiredCount}</div>
            </div>
            <div style={S.statBlock}>
              <div style={S.label}>BOUTS RESOLVED</div>
              <div style={S.value}>{n.boutCount.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...S.divider, marginTop: '20px' }} />

      <p style={S.sectionTitle}>WEIGHT CLASS DISTRIBUTION</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {summary.weightClassDistribution.map(wc => (
          <div key={wc.weightClassId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ ...S.muted, width: '140px', fontSize: '10px', flexShrink: 0 }}>
              {wc.weightClassId.replace(/_/g, ' ')}
            </span>
            <div style={{ ...S.barTrack, flex: 1 }}>
              <div style={S.barFill((wc.count / maxWc) * 100)} />
            </div>
            <span style={{ width: '40px', textAlign: 'right' as const, fontSize: '11px' }}>
              {wc.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section: Fighter Browser ─────────────────────────────────────────────────

function FighterDetail({ saveId, fighterId, onClose }: { saveId: string; fighterId: string; onClose: () => void }): JSX.Element {
  const [detail, setDetail] = useState<FighterDevDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    devFighterDetail(saveId, fighterId)
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [saveId, fighterId])

  if (loading) return <div style={{ padding: '16px' }}><p style={S.muted}>Loading…</p></div>
  if (detail === null) return <div style={{ padding: '16px' }}><p style={S.muted}>Fighter not found.</p></div>

  return (
    <div style={{ padding: '12px', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            {detail.firstName} {detail.surname}
          </p>
          <p style={{ ...S.muted, fontSize: '10px' }}>
            {detail.age}y · {detail.nationId} · {detail.cityId}
          </p>
        </div>
        <button style={S.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '12px' }}>
        <span style={S.identityBadge(detail.identityState)}>{detail.identityState.toUpperCase()}</span>
        <span style={{ ...S.muted, fontSize: '10px' }}>{detail.weightClassId.replace(/_/g, ' ')}</span>
        <span style={{ ...S.muted, fontSize: '10px' }}>{detail.competitionStatus}</span>
        {detail.southpaw && <span style={{ ...S.muted, fontSize: '10px' }}>SOUTHPAW</span>}
      </div>

      <div style={S.statBlock}>
        <div style={S.label}>RECORD</div>
        <div style={S.value}>{detail.wins}W – {detail.losses}L – {detail.kos} KO</div>
      </div>

      <div style={S.statBlock}>
        <div style={S.label}>STYLE</div>
        <div style={S.value}>{detail.styleTendency} ({detail.tendencyStrength}%)</div>
      </div>

      {detail.gymName !== null && (
        <div style={S.statBlock}>
          <div style={S.label}>GYM</div>
          <div style={S.value}>{detail.gymName} {detail.coachQuality !== null && <span style={S.muted}> · Coach Q:{detail.coachQuality}</span>}</div>
        </div>
      )}

      <div style={S.divider} />
      <p style={{ ...S.sectionTitle, marginBottom: '6px' }}>SOUL TRAITS (all revealed)</p>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px', marginBottom: '12px' }}>
        {detail.soulTraits.map(t => (
          <span key={t.traitId} style={{
            fontSize: '10px',
            padding: '2px 6px',
            border: 'var(--border-subtle)',
            color: 'var(--color-accent-amber)',
          }}>{t.traitId}</span>
        ))}
      </div>

      <div style={S.divider} />
      <p style={{ ...S.sectionTitle, marginBottom: '6px' }}>DEVELOPED ATTRIBUTES</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
        {detail.developedAttributes.map(a => (
          <div key={a.attributeId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
            <span style={{ ...S.muted, fontSize: '10px' }}>{a.attributeId.replace(/_/g, ' ')}</span>
            <span style={{ fontSize: '11px' }}>
              <span style={S.amber}>{a.current}</span>
              <span style={S.muted}>/{a.ceiling}</span>
            </span>
          </div>
        ))}
      </div>

      <div style={S.divider} />
      <p style={{ ...S.sectionTitle, marginBottom: '6px' }}>PHYSICAL PROFILE</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ ...S.muted, fontSize: '10px' }}>height</span>
          <span style={{ fontSize: '11px' }}>{detail.physicalProfile.heightCm}cm</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ ...S.muted, fontSize: '10px' }}>reach</span>
          <span style={{ fontSize: '11px' }}>{detail.physicalProfile.reachCm}cm</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ ...S.muted, fontSize: '10px' }}>weight</span>
          <span style={{ fontSize: '11px' }}>{detail.physicalProfile.weightKg}kg</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ ...S.muted, fontSize: '10px' }}>hands</span>
          <span style={{ fontSize: '11px' }}>{detail.physicalProfile.handSize}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ ...S.muted, fontSize: '10px' }}>neck</span>
          <span style={{ fontSize: '11px' }}>{detail.physicalProfile.neckThickness}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ ...S.muted, fontSize: '10px' }}>bone density</span>
          <span style={{ fontSize: '11px' }}>{detail.physicalProfile.boneDensity}</span>
        </div>
      </div>

      {detail.lastBouts.length > 0 && (
        <>
          <div style={S.divider} />
          <p style={{ ...S.sectionTitle, marginBottom: '6px' }}>LAST {detail.lastBouts.length} BOUTS</p>
          {detail.lastBouts.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px' }}>
              <span style={S.muted}>{b.year}w{String(b.week).padStart(2, '0')}</span>
              <span style={{ color: b.result === 'W' ? '#55927f' : b.result === 'L' ? '#dc6250' : 'var(--color-text-muted)', fontWeight: 700, width: '12px' }}>{b.result}</span>
              <span style={{ flex: 1 }}>{b.opponentName}</span>
              <span style={S.muted}>{b.method.replace(/_/g, ' ')} R{b.endRound}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function FighterBrowser({ saveId }: { saveId: string }): JSX.Element {
  const [fighters, setFighters] = useState<FighterListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<DevFighterFilters>({
    nationId: '',
    identityState: '',
    weightClassId: '',
    sortBy: 'wins',
  })

  const load = useCallback(() => {
    setLoading(true)
    devFighterList(saveId, filters)
      .then(r => { setFighters(r.fighters); setTotal(r.total); setLoading(false) })
      .catch(() => setLoading(false))
  }, [saveId, filters])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ display: 'flex', height: '100%', gap: '0', overflow: 'hidden' }}>
      {/* List panel */}
      <div style={{ flex: 1, overflow: 'auto', paddingRight: selectedId !== null ? '8px' : '0' }}>
        <p style={S.sectionTitle}>FIGHTER BROWSER</p>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' as const }}>
          <select
            style={S.select}
            value={filters.nationId ?? ''}
            onChange={e => setFilters(f => ({ ...f, nationId: e.target.value }))}
          >
            <option value="">All nations</option>
            <option value="latvia">Latvia</option>
            <option value="usa">USA</option>
          </select>
          <select
            style={S.select}
            value={filters.identityState ?? ''}
            onChange={e => setFilters(f => ({ ...f, identityState: e.target.value }))}
          >
            <option value="">All states</option>
            <option value="competing">Competing</option>
            <option value="aspiring">Aspiring</option>
            <option value="retired">Retired</option>
            <option value="curious">Curious</option>
            <option value="unaware">Unaware</option>
          </select>
          <select
            style={S.select}
            value={filters.sortBy ?? 'wins'}
            onChange={e => {
            const v = e.target.value as 'wins' | 'readiness' | 'age' | 'attributeTotal'
            setFilters(f => ({ ...f, sortBy: v }))
          }}
          >
            <option value="wins">Sort: Wins</option>
            <option value="readiness">Sort: Readiness</option>
            <option value="age">Sort: Age</option>
          </select>
        </div>

        <p style={{ ...S.muted, marginBottom: '8px', fontSize: '10px' }}>
          {loading ? 'Loading…' : `${total} fighters`}
        </p>

        {!loading && (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>STATE</th>
                <th style={S.th}>NAME</th>
                <th style={S.th}>NATION</th>
                <th style={S.th}>RECORD</th>
                <th style={S.th}>AGE</th>
                <th style={S.th}>WEIGHT CLASS</th>
              </tr>
            </thead>
            <tbody>
              {fighters.map(f => (
                <tr
                  key={f.id}
                  onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: f.id === selectedId ? 'rgba(238,178,74,0.06)' : 'transparent',
                  }}
                >
                  <td style={S.td}><span style={S.identityBadge(f.identityState)}>{f.identityState.slice(0,4).toUpperCase()}</span></td>
                  <td style={S.td}>{f.firstName} {f.surname}</td>
                  <td style={{ ...S.td, ...S.muted }}>{f.nationId}</td>
                  <td style={S.td}>{f.wins}-{f.losses}</td>
                  <td style={{ ...S.td, ...S.muted }}>{f.age}</td>
                  <td style={{ ...S.td, ...S.muted }}>{f.weightClassId.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail panel */}
      {selectedId !== null && (
        <div style={{ width: '340px', borderLeft: 'var(--border-mid)', overflow: 'auto', flexShrink: 0 }}>
          <FighterDetail
            saveId={saveId}
            fighterId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Section: Attribute Distributions ────────────────────────────────────────

function AttributeDistributions({ saveId }: { saveId: string }): JSX.Element {
  const ATTRIBUTES = [
    'power', 'hand_speed', 'punch_accuracy', 'punch_selection',
    'combination_punching', 'head_movement', 'defensive_footwork',
    'guard', 'counter_punching', 'chin', 'durability', 'stamina',
    'recovery_rate', 'footwork', 'lateral_movement', 'ring_generalship',
    'ring_iq', 'heart', 'pressure_resistance', 'composure',
    'adaptability', 'dirty_boxing',
  ]
  const KEY_ATTRS = ['power', 'chin', 'ring_iq', 'heart']

  const [nationFilter, setNationFilter] = useState<string>('')
  const [selectedAttr, setSelectedAttr] = useState<string>('power')
  const [result, setResult] = useState<AttributeDistributionResult | null>(null)
  const [keyResults, setKeyResults] = useState<Record<string, AttributeDistributionResult>>({})
  const [loading, setLoading] = useState(false)

  // Load the selected attribute distribution.
  useEffect(() => {
    setLoading(true)
    devAttributeDistribution(saveId, selectedAttr, nationFilter || null)
      .then(r => { setResult(r); setLoading(false) })
      .catch(() => setLoading(false))
  }, [saveId, selectedAttr, nationFilter])

  // Load key attribute distributions for the 2×2 grid.
  useEffect(() => {
    Promise.all(
      KEY_ATTRS.map(attr =>
        devAttributeDistribution(saveId, attr, nationFilter || null)
          .then(r => [attr, r] as [string, AttributeDistributionResult]),
      ),
    ).then(entries => {
      setKeyResults(Object.fromEntries(entries))
    }).catch(() => undefined)
  }, [saveId, nationFilter])

  function Histogram({ data, height = 60 }: { data: AttributeDistributionResult; height?: number }): JSX.Element {
    const max = Math.max(...data.distribution, 1)
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: `${height}px` }}>
          {data.distribution.map((count, i) => (
            <div
              key={i}
              title={`Value ${i + 1}: ${count}`}
              style={{
                flex: 1,
                height: `${(count / max) * 100}%`,
                backgroundColor: 'var(--color-accent-amber)',
                opacity: 0.8,
                minHeight: count > 0 ? '2px' : '0',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span style={{ ...S.muted, fontSize: '9px' }}>1</span>
          <span style={{ ...S.muted, fontSize: '9px' }}>20</span>
        </div>
        <p style={{ ...S.muted, fontSize: '10px', marginTop: '4px' }}>
          Mean: <span style={S.amber}>{data.stats.mean}</span> ·
          Med: {data.stats.median} ·
          Min: {data.stats.min} ·
          Max: {data.stats.max} ·
          σ: {data.stats.stdDev}
        </p>
      </div>
    )
  }

  return (
    <div>
      <p style={S.sectionTitle}>ATTRIBUTE DISTRIBUTIONS — COMPETING FIGHTERS ONLY</p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <select style={S.select} value={nationFilter} onChange={e => setNationFilter(e.target.value)}>
          <option value="">All nations</option>
          <option value="latvia">Latvia</option>
          <option value="usa">USA</option>
        </select>
        <select style={S.select} value={selectedAttr} onChange={e => setSelectedAttr(e.target.value)}>
          {ATTRIBUTES.map(a => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Selected attribute distribution */}
      {result !== null && !loading && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '11px', marginBottom: '8px' }}>
            <span style={S.amber}>{selectedAttr.replace(/_/g, ' ').toUpperCase()}</span>
          </p>
          <Histogram data={result} height={80} />
        </div>
      )}
      {loading && <p style={S.muted}>Loading…</p>}

      <div style={S.divider} />
      <p style={{ ...S.sectionTitle, marginBottom: '12px' }}>KEY ATTRIBUTES — 2×2</p>
      <div style={S.grid2}>
        {KEY_ATTRS.map(attr => {
          const d = keyResults[attr]
          if (d === undefined) return <div key={attr} style={S.muted}>Loading…</div>
          return (
            <div key={attr} style={{ borderTop: '1px solid rgba(238,178,74,0.15)', paddingTop: '8px' }}>
              <p style={{ fontSize: '10px', ...S.muted, marginBottom: '6px' }}>{attr.replace(/_/g, ' ').toUpperCase()}</p>
              <Histogram data={d} height={50} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Section: Bout Log ────────────────────────────────────────────────────────

function BoutLog({ saveId }: { saveId: string }): JSX.Element {
  const [bouts, setBouts] = useState<BoutLogEntry[]>([])
  const [summary, setSummary] = useState<BoutLogSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [methodFilter, setMethodFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    const boutFilters = methodFilter !== '' ? { method: methodFilter, limit: 200 } : { limit: 200 }
    devBoutLog(saveId, boutFilters)
      .then(r => { setBouts(r.bouts); setSummary(r.summary); setLoading(false) })
      .catch(() => setLoading(false))
  }, [saveId, methodFilter])

  const koTkoPct = summary !== null && summary.total > 0
    ? Math.round((summary.koTko / summary.total) * 100)
    : 0
  const decPct = summary !== null && summary.total > 0
    ? Math.round((summary.decision / summary.total) * 100)
    : 0
  const splitPct = summary !== null && summary.decision > 0
    ? Math.round((summary.splitMajority / summary.decision) * 100)
    : 0

  return (
    <div>
      <p style={S.sectionTitle}>BOUT LOG</p>

      {summary !== null && (
        <div style={{
          backgroundColor: 'rgba(0,0,0,0.2)',
          border: 'var(--border-subtle)',
          padding: '10px 14px',
          marginBottom: '16px',
        }}>
          <p style={{ fontSize: '10px', ...S.muted, marginBottom: '6px', letterSpacing: '1px' }}>
            BOUT LOG SUMMARY (Last {summary.total} bouts)
          </p>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' as const }}>
            <div>
              <span style={{ fontSize: '10px', ...S.muted }}>KO/TKO </span>
              <span style={{ fontSize: '14px', color: koTkoPct > 50 ? '#dc6250' : 'var(--color-accent-amber)', fontWeight: 700 }}>
                {koTkoPct}%
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', ...S.muted }}>Decision </span>
              <span style={{ fontSize: '14px', ...S.amber, fontWeight: 700 }}>{decPct}%</span>
            </div>
            <div>
              <span style={{ fontSize: '10px', ...S.muted }}>Split/Maj </span>
              <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 700 }}>{splitPct}%</span>
              <span style={{ ...S.muted, fontSize: '9px' }}> of decisions</span>
            </div>
            <div>
              <span style={{ fontSize: '10px', ...S.muted }}>Avg end round </span>
              <span style={{ fontSize: '14px', ...S.amber }}>{summary.avgEndRound}</span>
            </div>
            <div>
              <span style={{ fontSize: '10px', ...S.muted }}>Avg scheduled </span>
              <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{summary.avgScheduledRounds}</span>
            </div>
          </div>
          {/* Health indicator — target range is 25–40% per simulation calibration */}
          <p style={{ ...S.muted, fontSize: '10px', marginTop: '6px', borderTop: 'var(--border-subtle)', paddingTop: '6px' }}>
            {koTkoPct >= 25 && koTkoPct <= 40
              ? '✓ KO rate in healthy range (25–40%)'
              : koTkoPct < 25
              ? '⚠ KO rate low — check damage calculation'
              : '⚠ KO rate high — check damage accumulation'}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <select style={S.select} value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
          <option value="">All methods</option>
          <option value="ko">KO</option>
          <option value="tko">TKO</option>
          <option value="decision">Decision</option>
          <option value="split_decision">Split Decision</option>
          <option value="majority_decision">Majority Decision</option>
        </select>
      </div>

      {loading && <p style={S.muted}>Loading…</p>}
      {!loading && (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>DATE</th>
              <th style={S.th}>CIRCUIT</th>
              <th style={S.th}>WINNER</th>
              <th style={S.th}>LOSER</th>
              <th style={S.th}>METHOD</th>
              <th style={S.th}>RND</th>
            </tr>
          </thead>
          <tbody>
            {bouts.map(b => (
              <tr key={b.boutId}>
                <td style={{ ...S.td, ...S.muted }}>
                  {b.year > 0 ? `${b.year} W${String(b.week).padStart(2, '0')}` : '—'}
                </td>
                <td style={{ ...S.td, ...S.muted }}>{b.circuitLevel.replace(/_/g, ' ')}</td>
                <td style={S.td}>{b.fighterAName}</td>
                <td style={{ ...S.td, ...S.muted }}>{b.fighterBName}</td>
                <td style={{ ...S.td, color: b.method === 'ko' || b.method === 'tko' ? '#dc6250' : 'var(--color-text-primary)' }}>
                  {b.method.replace(/_/g, ' ')}
                </td>
                <td style={{ ...S.td, ...S.muted }}>R{b.endRound}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Section: Gym Financials ──────────────────────────────────────────────────

function GymFinancials({ saveId }: { saveId: string }): JSX.Element {
  const [gyms, setGyms] = useState<GymListItem[]>([])
  const [selectedGymId, setSelectedGymId] = useState<string>('')
  const [detail, setDetail] = useState<GymFinancialDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    devGymList(saveId)
      .then(g => { setGyms(g); if (g.length > 0 && g[0] !== undefined) setSelectedGymId(g[0].id) })
      .catch(() => undefined)
  }, [saveId])

  useEffect(() => {
    if (selectedGymId === '') return
    setLoading(true)
    devGymFinancials(saveId, selectedGymId)
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [saveId, selectedGymId])

  // Simple line chart via SVG — x = week index, y = balance.
  function BalanceChart({ history }: { history: GymFinancialDetail['revenueHistory'] }): JSX.Element {
    if (history.length < 2) return <p style={S.muted}>Insufficient history data.</p>

    const width = 600
    const height = 120
    const pad = { top: 12, bottom: 20, left: 50, right: 12 }
    const innerW = width - pad.left - pad.right
    const innerH = height - pad.top - pad.bottom

    const balances = history.map(r => r.balance)
    const minB = Math.min(...balances)
    const maxB = Math.max(...balances)
    const range = maxB - minB || 1

    const points = history.map((r, i) => {
      const x = pad.left + (i / (history.length - 1)) * innerW
      const y = pad.top + innerH - ((r.balance - minB) / range) * innerH
      return `${x},${y}`
    })

    const zeroY = pad.top + innerH - ((0 - minB) / range) * innerH
    const zeroYClamped = Math.max(pad.top, Math.min(pad.top + innerH, zeroY))

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: '600px', height: 'auto' }}>
        {/* Zero line */}
        <line
          x1={pad.left} y1={zeroYClamped}
          x2={width - pad.right} y2={zeroYClamped}
          stroke="rgba(218,212,201,0.15)" strokeWidth="1" strokeDasharray="4,4"
        />
        {/* Balance line */}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="var(--color-accent-amber)"
          strokeWidth="1.5"
        />
        {/* Labels */}
        <text x={pad.left - 4} y={pad.top + 4} fill="rgba(218,212,201,0.5)" fontSize="9" textAnchor="end">
          {Math.round(maxB)}
        </text>
        <text x={pad.left - 4} y={pad.top + innerH} fill="rgba(218,212,201,0.5)" fontSize="9" textAnchor="end">
          {Math.round(minB)}
        </text>
        <text x={pad.left} y={height - 4} fill="rgba(218,212,201,0.4)" fontSize="9">
          {history[0]?.year ?? ''}
        </text>
        <text x={width - pad.right} y={height - 4} fill="rgba(218,212,201,0.4)" fontSize="9" textAnchor="end">
          {history[history.length - 1]?.year ?? ''}
        </text>
      </svg>
    )
  }

  return (
    <div>
      <p style={S.sectionTitle}>GYM FINANCIALS</p>

      <div style={{ marginBottom: '16px' }}>
        <select
          style={{ ...S.select, width: '280px' }}
          value={selectedGymId}
          onChange={e => setSelectedGymId(e.target.value)}
        >
          {gyms.map(g => (
            <option key={g.id} value={g.id}>{g.name} · {g.cityId} · {g.nationId}</option>
          ))}
        </select>
      </div>

      {loading && <p style={S.muted}>Loading…</p>}

      {!loading && detail !== null && (
        <>
          <p style={{ fontSize: '13px', marginBottom: '4px' }}>
            {detail.name} <span style={S.muted}>· {detail.cityId} · {detail.gymTier}</span>
          </p>

          <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
            <div style={S.statBlock}>
              <div style={S.label}>BALANCE</div>
              <div style={{ ...S.value, color: detail.balance < 0 ? '#dc6250' : 'var(--color-accent-amber)' }}>
                {detail.balance < 0 ? '-' : ''}€{Math.abs(detail.balance).toLocaleString()}
              </div>
            </div>
            <div style={S.statBlock}>
              <div style={S.label}>MONTHLY RENT</div>
              <div style={S.value}>€{detail.monthlyRent.toLocaleString()}</div>
            </div>
            <div style={S.statBlock}>
              <div style={S.label}>MEMBERS / FIGHTERS</div>
              <div style={S.value}>{detail.memberCount} / {detail.fighterCount}</div>
            </div>
          </div>

          <p style={{ ...S.sectionTitle, marginBottom: '8px' }}>FINANCIAL HISTORY</p>
          {detail.revenueHistory.length > 0
            ? <BalanceChart history={detail.revenueHistory} />
            : <p style={S.muted}>No revenue history recorded.</p>
          }

          {detail.equipment.length > 0 && (
            <>
              <div style={S.divider} />
              <p style={{ ...S.sectionTitle, marginBottom: '8px' }}>EQUIPMENT STATE</p>
              {detail.equipment.map(e => (
                <div key={e.typeId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ ...S.muted, fontSize: '10px', width: '160px' }}>
                    {e.typeId.replace(/_/g, ' ')}{e.instanceCount > 1 ? ` (×${e.instanceCount})` : ''}
                  </span>
                  <div style={{ ...S.barTrack, width: '120px', flex: 'none' }}>
                    <div style={S.barFill(e.avgCondition)} />
                  </div>
                  <span style={{ ...S.muted, fontSize: '10px' }}>{e.avgCondition}%</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── Section: Regenerate ──────────────────────────────────────────────────────

function RegenerateSection({ worldSeed }: { worldSeed: number }): JSX.Element {
  const setScreen = useGameStore(s => s.setScreen)
  const clearWorld = useGameStore(s => s.clearWorld)
  const [seed, setSeed] = useState(String(worldSeed))

  function handleRegenerate(): void {
    if (!confirm('This will wipe the current save and regenerate everything. Continue?')) return
    clearWorld()
    setScreen('newGame')
  }

  return (
    <div>
      <p style={S.sectionTitle}>REGENERATE WORLD</p>
      <p style={{ ...S.muted, marginBottom: '16px', fontSize: '11px' }}>
        Current seed: <span style={S.amber}>{worldSeed}</span>
      </p>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
        <label style={{ ...S.muted, fontSize: '11px' }}>New seed:</label>
        <input
          type="number"
          style={{ ...S.input, width: '140px' }}
          value={seed}
          onChange={e => setSeed(e.target.value)}
        />
        <button
          style={S.btn}
          onClick={() => setSeed(String(Math.floor(Math.random() * 9000000) + 1000000))}
        >
          Random
        </button>
      </div>

      <p style={{ ...S.muted, fontSize: '11px', marginBottom: '16px', maxWidth: '400px' }}>
        Warning: This will wipe the current save and return to the New Game screen.
        You can enter the new seed there to regenerate with it.
      </p>

      <button style={S.dangerBtn} onClick={handleRegenerate}>
        GO TO NEW GAME
      </button>
    </div>
  )
}

// ─── Main DevDashboard ────────────────────────────────────────────────────────

export default function DevDashboard(): JSX.Element {
  const worldState = useGameStore(s => s.worldState)
  const setScreen = useGameStore(s => s.setScreen)
  const [activeSection, setActiveSection] = useState<NavSection>('overview')

  const saveId = worldState?.saveId ?? ''

  if (worldState === null || saveId === '') {
    return (
      <div style={{ ...S.overlay, alignItems: 'center', justifyContent: 'center' }}>
        <p style={S.muted}>No save loaded — start a new game first.</p>
        <button style={{ ...S.btn, marginTop: '12px' }} onClick={() => setScreen('mainMenu')}>
          Return to Main Menu
        </button>
      </div>
    )
  }

  function renderSection(): JSX.Element {
    switch (activeSection) {
      case 'overview': return <WorldOverview saveId={saveId} />
      case 'fighters': return <FighterBrowser saveId={saveId} />
      case 'attributes': return <AttributeDistributions saveId={saveId} />
      case 'bouts': return <BoutLog saveId={saveId} />
      case 'financials': return <GymFinancials saveId={saveId} />
      case 'regenerate': return <RegenerateSection worldSeed={worldState?.seed ?? 0} />
    }
  }

  return (
    <div style={S.overlay}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.devBadge}>DEV MODE</span>
        <span style={S.headerInfo}>
          {worldState.playerName} · {worldState.gymName} · {worldState.currentYear} W{worldState.currentWeek}
        </span>
        <button style={S.closeBtn} onClick={() => setScreen('game')}>
          ESC — Close
        </button>
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* Sidebar */}
        <nav style={S.sidebar}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              style={S.navItem(activeSection === item.id)}
              onClick={() => setActiveSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div style={S.content}>
          {renderSection()}
        </div>
      </div>
    </div>
  )
}
