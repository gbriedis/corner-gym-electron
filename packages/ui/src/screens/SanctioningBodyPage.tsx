// SanctioningBodyPage — full detail view for a sanctioning body.
// Navigated to by clicking a sanctioning body name anywhere in the app.
// Shows rules table per circuit level + age category, titles controlled, governed events.

import type { JSX } from 'react'
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
} from '@radix-ui/react-icons'
import GameShell from '../components/layout/GameShell'
import Badge from '../components/Badge'
import { useGameStore } from '../store/gameStore'

import type { SanctioningBody, CircuitLevelDefinition, RulesData } from '@corner-gym/engine'

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

function ageCategoryLabel(id: string): string {
  switch (id) {
    case 'junior': return 'Junior'
    case 'youth':  return 'Youth'
    case 'senior': return 'Senior'
    default: return id.charAt(0).toUpperCase() + id.slice(1)
  }
}

// SectionLabel renders a small all-caps label for detail sections.
function SectionLabel({ label }: { label: string }): JSX.Element {
  return (
    <div
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '9px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'rgba(218,212,201,0.35)',
        marginBottom: 'var(--space-2)',
      }}
    >
      {label}
    </div>
  )
}

// RulesTable renders a table of circuit rules grouped by age category.
function RulesTable({ rules, circuitId }: {
  rules: RulesData
  circuitId: string
}): JSX.Element {
  const circuitRules = rules.circuitRules.filter(r => r.circuitLevel === circuitId)
  if (circuitRules.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.35)', fontStyle: 'italic' }}>
        No rules defined for this circuit level.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {circuitRules.map(rule => (
        <div
          key={`${rule.circuitLevel}-${rule.ageCategory}`}
          style={{
            background: 'rgba(218,212,201,0.03)',
            border: 'var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
          }}
        >
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            {ageCategoryLabel(rule.ageCategory)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            <RuleRow label="Rounds" value={String(rule.rounds)} />
            <RuleRow label="Round duration" value={`${rule.roundDurationMinutes} min`} />
            <RuleRow label="Scoring" value={rule.scoringSystem.replace(/_/g, ' ')} />
            <RuleRow label="Gloves" value={`${rule.gloveWeightOz} oz`} />
            <RuleRow label="Headgear" value={rule.headgearRequired ? 'Required' : 'Not required'} />
            <RuleRow label="Max bouts/day" value={String(rule.maxBoutsPerDay)} />
          </div>
        </div>
      ))}
    </div>
  )
}

function RuleRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(218,212,201,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
        {value}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SanctioningBodyPage(): JSX.Element {
  const gameData = useGameStore(s => s.gameData)
  const params = useGameStore(s => s.navigationParams)
  const setScreen = useGameStore(s => s.setScreen)

  const bodyId = params?.bodyId ?? ''

  // Collect all sanctioning bodies from national + international data.
  const allBodies: SanctioningBody[] = []
  const allCircuits: CircuitLevelDefinition[] = []
  let matchedRules: RulesData | undefined

  if (gameData !== null) {
    for (const bundle of Object.values(gameData.nations)) {
      if (bundle.boxing !== undefined) {
        allBodies.push(...bundle.boxing.sanctioningBodies.sanctioningBodies)
        allCircuits.push(...bundle.boxing.amateurCircuit.circuitLevels)
        if (bundle.boxing.rules !== undefined && bundle.boxing.sanctioningBodies.sanctioningBodies.some(b => b.id === bodyId)) {
          matchedRules = bundle.boxing.rules
        }
      }
    }
    allBodies.push(...gameData.international.boxing.sanctioningBodies.sanctioningBodies)
    allCircuits.push(...gameData.international.boxing.circuits.circuitLevels)
    if (bodyId === 'eubc') matchedRules = gameData.international.boxing.eubcRules
    if (bodyId === 'iba')  matchedRules = gameData.international.boxing.ibaRules
  }

  const body = allBodies.find(b => b.id === bodyId)

  // Find circuits this body sanctions.
  const governedCircuits = allCircuits.filter(c => c.sanctioningBody === bodyId)

  // Find the parent body for affiliation display.
  const affiliatedBody = body?.affiliation !== null && body?.affiliation !== undefined
    ? allBodies.find(b => b.id === body.affiliation)
    : undefined

  function handleBack(): void {
    setScreen('calendar')
  }

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

  return (
    <GameShell activeNav="calendar" onNavigate={handleNavigate}>
      {/* Back button */}
      <button
        onClick={handleBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          marginBottom: 'var(--space-4)',
        }}
      >
        <ArrowLeftIcon width={12} height={12} />
        Back to Calendar
      </button>

      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start', maxWidth: '900px' }}>
        {/* Left column — main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h1
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: '0 0 var(--space-2)',
              }}
            >
              {body.label}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Badge variant="neutral" label={levelLabel(body.level)} />
              {affiliatedBody !== undefined && (
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.5)' }}>
                  Affiliated with{' '}
                  <button
                    onClick={() => setScreen('sanctioningBody', { bodyId: affiliatedBody.id })}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '10px',
                      color: 'var(--color-text-primary)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none' }}
                  >
                    {affiliatedBody.label}
                  </button>
                  {' '}
                  <ExternalLinkIcon width={9} height={9} style={{ display: 'inline', verticalAlign: 'middle', opacity: 0.4 }} />
                </span>
              )}
            </div>
          </div>

          {/* About */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <SectionLabel label="About" />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>
              {body.description}
            </p>
          </div>

          {/* Competition Rules — per circuit level */}
          {matchedRules !== undefined && governedCircuits.length > 0 && (
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <SectionLabel label="Competition Rules" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {governedCircuits.map(circuit => (
                  <div key={circuit.id}>
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        marginBottom: 'var(--space-2)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {circuitDisplayLabel(circuit.id)}
                    </div>
                    <RulesTable rules={matchedRules!} circuitId={circuit.id} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Titles controlled */}
          {body.titlesPerWeightClass.length > 0 && (
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <SectionLabel label="Titles Controlled" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {body.titlesPerWeightClass.map(title => (
                  <span
                    key={title}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '10px',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(218,212,201,0.06)',
                      border: 'var(--border-subtle)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {title.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — governed events */}
        <div style={{ width: '240px', flexShrink: 0 }}>
          <div
            style={{
              background: 'rgba(10,10,14,0.4)',
              border: 'var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: 'var(--border-subtle)' }}>
              <SectionLabel label="Governed Events" />
            </div>
            {governedCircuits.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.35)', padding: 'var(--space-3)', margin: 0 }}>
                No circuit levels found.
              </p>
            ) : (
              <div>
                {governedCircuits.map((circuit, i) => (
                  <div
                    key={circuit.id}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      borderBottom: i < governedCircuits.length - 1 ? 'var(--border-subtle)' : 'none',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                      {circuitDisplayLabel(circuit.id)}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(218,212,201,0.4)' }}>
                      Prestige {circuit.prestige} · {circuit.locationScope}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </GameShell>
  )
}
