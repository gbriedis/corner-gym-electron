// SanctioningBodyPage — full detail view for a sanctioning body.
// Navigated to by clicking a sanctioning body name anywhere in the app.
// Styled as an official document: dense rule specs, age category tabs, no web-UI cards.

import { useState, type JSX, type ReactNode } from 'react'
import GameShell from '../components/layout/GameShell'
import Badge from '../components/Badge'
import { useGameStore } from '../store/gameStore'

import type { SanctioningBody, CircuitLevelDefinition, RulesData, CircuitRules } from '@corner-gym/engine'
import type { BadgeVariant } from '../components/Badge'

// ─── Helpers ────────────────────────────────────────────────────────────────

function levelLabel(id: string): string {
  switch (id) {
    case 'national':      return 'National'
    case 'continental':   return 'Continental'
    case 'international': return 'International'
    default: return id
  }
}

function circuitDisplayLabel(id: string): string {
  switch (id) {
    case 'club_card':             return 'Club Card'
    case 'regional_tournament':   return 'Regional Tournament'
    case 'national_championship': return 'National Championship'
    case 'baltic_championship':   return 'Baltic Championship'
    case 'european_championship': return 'European Championship'
    case 'world_championship':    return 'World Championship'
    case 'olympics':              return 'Olympics'
    default: return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}

function circuitBadgeVariant(id: string): BadgeVariant {
  switch (id) {
    case 'club_card':             return 'neutral'
    case 'regional_tournament':   return 'normal'
    case 'national_championship': return 'hard'
    case 'baltic_championship':   return 'easy'
    case 'european_championship': return 'normal'
    case 'world_championship':    return 'hard'
    case 'olympics':              return 'hard'
    default:                      return 'neutral'
  }
}

function ageCategoryLabel(id: string): string {
  switch (id) {
    case 'junior': return 'Junior'
    case 'youth':  return 'Youth'
    case 'senior': return 'Senior'
    default: return id.charAt(0).toUpperCase() + id.slice(1)
  }
}

// bodyAccentColor — the circuit-level colour most associated with this body.
// LBF: amber (national championship). EUBC: blue-dark. IBA: gold (world/olympics).
function bodyAccentColor(id: string): string {
  switch (id) {
    case 'lbf':  return 'var(--color-accent-amber)'
    case 'eubc': return 'var(--color-accent-blue-dark)'
    case 'iba':  return 'var(--color-accent-gold)'
    default:     return 'var(--color-text-muted)'
  }
}

// formatRuleLine — compresses a CircuitRules record into one dense specification line.
// Reads like a technical spec, not a form.
function formatRuleLine(rule: CircuitRules): string {
  const headgear = rule.headgearRequired ? 'Headgear req.' : 'No headgear'
  const scoring  = rule.scoringSystem.replace(/_/g, ' ')
  const bouts    = rule.maxBoutsPerDay === 1 ? '1 bout/day' : `Max ${rule.maxBoutsPerDay} bouts/day`
  return `${rule.rounds} rounds · ${rule.roundDurationMinutes} min · ${scoring} · ${headgear} · ${rule.gloveWeightOz} oz · ${bouts}`
}

// AGE_CATEGORIES — canonical order for tab display.
const AGE_CATEGORY_ORDER = ['junior', 'youth', 'senior'] as const
type AgeCategoryKey = typeof AGE_CATEGORY_ORDER[number]

// ─── Sub-components ──────────────────────────────────────────────────────────

// SectionBlock — stamp label (1px rule above, 10px tracked uppercase, content below).
function SectionBlock({
  label,
  children,
  style,
}: {
  label: string
  children: ReactNode
  style?: React.CSSProperties
}): JSX.Element {
  return (
    <div
      style={{
        borderTop: 'var(--border-subtle)',
        paddingTop: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'rgba(218,212,201,0.35)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

// RulesSpecSection — age category tabs + per-circuit dense spec lines.
// Rendered inside the COMPETITION RULES section block.
function RulesSpecSection({
  rules,
  governedCircuits,
}: {
  rules: RulesData
  governedCircuits: CircuitLevelDefinition[]
}): JSX.Element {
  // Collect only age categories that have rules for at least one governed circuit.
  const availableCategories = AGE_CATEGORY_ORDER.filter(cat =>
    governedCircuits.some(c => rules.circuitRules.some(r => r.circuitLevel === c.id && r.ageCategory === cat)),
  )

  const defaultCat: AgeCategoryKey = availableCategories.includes('senior')
    ? 'senior'
    : (availableCategories[0] ?? 'senior')

  const [activeTab, setActiveTab] = useState<AgeCategoryKey>(defaultCat)

  if (availableCategories.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(218,212,201,0.35)', margin: 0 }}>
        No rules defined.
      </p>
    )
  }

  // Rules for the active tab, grouped by circuit level.
  const activeRules = governedCircuits
    .map(c => ({
      circuit: c,
      rule: rules.circuitRules.find(r => r.circuitLevel === c.id && r.ageCategory === activeTab),
    }))
    .filter((entry): entry is { circuit: CircuitLevelDefinition; rule: CircuitRules } => entry.rule !== undefined)

  return (
    <div>
      {/* Age category tabs */}
      {availableCategories.length > 1 && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--space-4)', borderBottom: 'var(--border-subtle)' }}>
          {availableCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: activeTab === cat ? 'var(--color-text-primary)' : 'rgba(218,212,201,0.4)',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === cat
                  ? '1px solid var(--color-text-primary)'
                  : '1px solid transparent',
                padding: 'var(--space-1) var(--space-3)',
                marginBottom: '-1px',
                cursor: 'pointer',
              }}
            >
              {ageCategoryLabel(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Circuit level spec rows */}
      <div>
        {activeRules.map(({ circuit, rule }, i) => (
          <div
            key={circuit.id}
            style={{
              padding: 'var(--space-3) 0',
              borderBottom: i < activeRules.length - 1 ? 'var(--border-subtle)' : 'none',
              background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '9px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(218,212,201,0.45)',
                marginBottom: '4px',
              }}
            >
              {circuitDisplayLabel(circuit.id)}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
              }}
            >
              {formatRuleLine(rule)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SanctioningBodyPage(): JSX.Element {
  const gameData  = useGameStore(s => s.gameData)
  const params    = useGameStore(s => s.navigationParams)
  const setScreen = useGameStore(s => s.setScreen)

  const bodyId = params?.bodyId ?? ''

  const allBodies:  SanctioningBody[]        = []
  const allCircuits: CircuitLevelDefinition[] = []
  let matchedRules: RulesData | undefined

  if (gameData !== null) {
    for (const bundle of Object.values(gameData.nations)) {
      if (bundle.boxing !== undefined) {
        allBodies.push(...bundle.boxing.sanctioningBodies.sanctioningBodies)
        allCircuits.push(...bundle.boxing.amateurCircuit.circuitLevels)
        if (
          bundle.boxing.rules !== undefined &&
          bundle.boxing.sanctioningBodies.sanctioningBodies.some(b => b.id === bodyId)
        ) {
          matchedRules = bundle.boxing.rules
        }
      }
    }
    allBodies.push(...gameData.international.boxing.sanctioningBodies.sanctioningBodies)
    allCircuits.push(...gameData.international.boxing.circuits.circuitLevels)
    if (bodyId === 'eubc') matchedRules = gameData.international.boxing.eubcRules
    if (bodyId === 'iba')  matchedRules = gameData.international.boxing.ibaRules
  }

  const body            = allBodies.find(b => b.id === bodyId)
  const governedCircuits = allCircuits.filter(c => c.sanctioningBody === bodyId)
  const affiliatedBody   = body?.affiliation != null
    ? allBodies.find(b => b.id === body.affiliation)
    : undefined

  function handleNavigate(id: string): void {
    if (id !== 'calendar') setScreen('game')
    else setScreen('calendar')
  }

  if (gameData === null) {
    return (
      <GameShell activeNav="calendar" onNavigate={handleNavigate}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Loading data…
        </p>
      </GameShell>
    )
  }

  if (body === undefined) {
    return (
      <GameShell activeNav="calendar" onNavigate={handleNavigate}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Sanctioning body not found: {bodyId}
        </p>
      </GameShell>
    )
  }

  const accentColor = bodyAccentColor(bodyId)

  return (
    <GameShell activeNav="calendar" onNavigate={handleNavigate}>
      {/* Content — max 900px */}
      <div style={{ maxWidth: '900px' }}>

        {/* Header — thick left accent border, body name in Rock Bro, level badge, affiliation */}
        <div
          style={{
            borderLeft: `4px solid ${accentColor}`,
            paddingLeft: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              color: 'var(--color-text-primary)',
              margin: '0 0 var(--space-2)',
              lineHeight: 1.1,
            }}
          >
            {body.label}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Badge variant="neutral" label={levelLabel(body.level)} />
            {affiliatedBody !== undefined && (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'rgba(218,212,201,0.5)',
                }}
              >
                Affiliated with{' '}
                <button
                  onClick={() => setScreen('sanctioningBody', { bodyId: affiliatedBody.id })}
                  onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                  onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    color: 'var(--color-text-primary)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                >
                  {affiliatedBody.label}
                </button>
              </span>
            )}
          </div>
        </div>

        {/* ABOUT */}
        <SectionBlock label="About">
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {body.description}
          </p>
        </SectionBlock>

        {/* COMPETITION RULES — age category tabs, circuit spec lines */}
        {matchedRules !== undefined && governedCircuits.length > 0 && (
          <SectionBlock label="Competition Rules">
            <RulesSpecSection rules={matchedRules} governedCircuits={governedCircuits} />
          </SectionBlock>
        )}

        {/* TITLES AWARDED — plain list, no pills */}
        {body.titlesPerWeightClass.length > 0 && (
          <SectionBlock label="Titles Awarded Per Weight Class">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {body.titlesPerWeightClass.map(title => (
                <span
                  key={title}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {title.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              ))}
            </div>
          </SectionBlock>
        )}

        {/* GOVERNED EVENTS — circuit badges in a row */}
        {governedCircuits.length > 0 && (
          <SectionBlock label="Governed Events">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {governedCircuits.map(c => (
                <Badge key={c.id} variant={circuitBadgeVariant(c.id)} label={circuitDisplayLabel(c.id)} />
              ))}
            </div>
          </SectionBlock>
        )}

      </div>
    </GameShell>
  )
}
