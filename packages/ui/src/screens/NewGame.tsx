import { useState, useEffect, type JSX } from 'react'
import { useGameStore } from '../store/gameStore'
import { getNewGameOptions, generateAndSave } from '../ipc/client'
import type { NewGameOptions, DifficultyPreset, CityOption } from '../electron'
import type { GameConfig } from '@corner-gym/engine'
import Button from '../components/Button'
import Input from '../components/Input'
import Dropdown from '../components/Dropdown'
import Badge, { type BadgeVariant } from '../components/Badge'

const DIFFICULTY_ORDER: Array<'easy' | 'normal' | 'hard' | 'extreme'> = ['easy', 'normal', 'hard', 'extreme']

export default function NewGame(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen)
  const setPendingSaveId = useGameStore((s) => s.setPendingSaveId)

  const [options, setOptions] = useState<NewGameOptions | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [gymName, setGymName] = useState('')
  const [selectedNation, setSelectedNation] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard' | 'extreme'>('normal')
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 999999).toString())
  const [seedError, setSeedError] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNewGameOptions()
      .then((opts) => {
        setOptions(opts)
        if (opts.defaults.renderedNations.length > 0) {
          setSelectedNation(opts.defaults.renderedNations[0])
        }
      })
      .catch((err: unknown) => { setError(String(err)) })
  }, [])

  useEffect(() => { setSelectedCity('') }, [selectedNation])

  const availableCities: CityOption[] =
    options !== null && selectedNation !== ''
      ? (options.nationCities[selectedNation] ?? []).filter((c: CityOption) => c.isStartingOption)
      : []

  const nationOptions = (options?.defaults.renderedNations ?? []).map((n) => ({
    value: n,
    label: n.charAt(0).toUpperCase() + n.slice(1),
  }))

  const cityOptions = availableCities.map((c) => ({ value: c.id, label: c.label }))

  const selectedDifficultyPreset: DifficultyPreset | undefined =
    options?.difficulties.find((d) => d.id === difficulty)

  const canStart =
    playerName.trim() !== '' &&
    gymName.trim() !== '' &&
    selectedNation !== '' &&
    selectedCity !== '' &&
    seed.trim() !== '' &&
    selectedDifficultyPreset !== undefined

  function handleStart(): void {
    if (!canStart || options === null || selectedDifficultyPreset === undefined) return

    const parsedSeed = parseInt(seed, 10)
    if (isNaN(parsedSeed)) {
      setSeedError('Must be a number')
      return
    }
    setSeedError('')

    const config: GameConfig = {
      seed: parsedSeed,
      startYear: options.defaults.startYear,
      playerName: playerName.trim(),
      gymName: gymName.trim(),
      playerCityId: selectedCity,
      playerNationId: selectedNation,
      renderedNations: options.defaults.renderedNations,
      difficulty,
      difficultyModifiers: selectedDifficultyPreset.modifiers,
      leagues: options.defaults.leagues,
      worldSettings: options.defaults.worldSettings,
    }

    setScreen('loading')
    generateAndSave(config)
      .then((saveId) => { setPendingSaveId(saveId) })
      .catch((err: unknown) => {
        setError(String(err))
        setScreen('newGame')
      })
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--color-bg-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: '760px', padding: 'var(--space-8) var(--space-6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--color-accent-amber)' }}>
            New Game
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setScreen('mainMenu')}>
            ← Back
          </Button>
        </div>

        {error !== null && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-accent-red)', marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
        )}

        {/* Two-column layout on wider screens */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input
              label="Your Name"
              value={playerName}
              onChange={setPlayerName}
              placeholder="Coach name"
              id="player-name"
            />
            <Input
              label="Gym Name"
              value={gymName}
              onChange={setGymName}
              placeholder="Name your gym"
              id="gym-name"
            />
            <Dropdown
              label="Nation"
              options={nationOptions}
              value={selectedNation}
              onChange={setSelectedNation}
              placeholder="Select nation"
            />
            <Dropdown
              label="Starting City"
              options={cityOptions}
              value={selectedCity}
              onChange={setSelectedCity}
              placeholder={availableCities.length === 0 ? 'Select a nation first' : 'Select city'}
              disabled={availableCities.length === 0}
            />
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Difficulty */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-text-muted)',
              }}>
                Difficulty
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {DIFFICULTY_ORDER.map((d) => (
                  <Badge
                    key={d}
                    variant={d as BadgeVariant}
                    label={d}
                    selected={difficulty === d}
                    onClick={() => setDifficulty(d)}
                  />
                ))}
              </div>
            </div>

            <Input
              label="Seed"
              value={seed}
              onChange={setSeed}
              error={seedError}
              id="seed"
            />

            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
              <Button
                variant="primary"
                size="lg"
                disabled={!canStart}
                onClick={handleStart}
              >
                Start Game
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
