import { useState, useEffect, type JSX } from 'react'
import { useGameStore } from '../store/gameStore'
import { getNewGameOptions, generateAndSave } from '../ipc/client'
import type { NewGameOptions, DifficultyPreset, CityOption } from '../electron'
import type { GameConfig } from '@corner-gym/engine'

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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNewGameOptions()
      .then((opts) => {
        setOptions(opts)
        if (opts.defaults.renderedNations.length > 0) {
          setSelectedNation(opts.defaults.renderedNations[0])
        }
      })
      .catch((err: unknown) => {
        setError(String(err))
      })
  }, [])

  // Reset city when nation changes.
  useEffect(() => {
    setSelectedCity('')
  }, [selectedNation])

  const availableCities: CityOption[] =
    options !== null && selectedNation !== ''
      ? (options.nationCities[selectedNation] ?? []).filter((c: CityOption) => c.isStartingOption)
      : []

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
      setError('Seed must be a number')
      return
    }

    const config: GameConfig = {
      seed: parsedSeed,
      startYear: options.defaults.startYear,
      playerName: playerName.trim(),
      gymName: gymName.trim(),
      playerCityId: selectedCity,
      playerNationId: selectedNation,
      renderedNations: options.defaults.renderedNations,
      difficulty,
      difficultyModifiers: {
        rentModifier: selectedDifficultyPreset.modifiers.rentModifier,
        talentDensity: selectedDifficultyPreset.modifiers.talentDensity,
        rivalGymDensity: selectedDifficultyPreset.modifiers.rivalGymDensity,
        giftProbabilityMultiplier: selectedDifficultyPreset.modifiers.giftProbabilityMultiplier,
        flawProbabilityMultiplier: selectedDifficultyPreset.modifiers.flawProbabilityMultiplier,
        economicStatusWeightShift: selectedDifficultyPreset.modifiers.economicStatusWeightShift,
        developmentProfileShift: selectedDifficultyPreset.modifiers.developmentProfileShift,
      },
      leagues: options.defaults.leagues,
      worldSettings: options.defaults.worldSettings,
    }

    setScreen('loading')
    generateAndSave(config)
      .then((saveId) => {
        setPendingSaveId(saveId)
      })
      .catch((err: unknown) => {
        setError(String(err))
        setScreen('newGame')
      })
  }

  const difficulties: Array<'easy' | 'normal' | 'hard' | 'extreme'> = ['easy', 'normal', 'hard', 'extreme']
  const difficultyLabels: Record<string, string> = {
    easy: 'Easy',
    normal: 'Normal',
    hard: 'Hard',
    extreme: 'Extreme',
  }

  return (
    <div className="w-screen h-screen bg-gray-950 flex flex-col items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-white text-xl font-bold tracking-wide">New Game</h2>
          <button
            onClick={() => setScreen('mainMenu')}
            className="text-gray-500 hover:text-gray-300 text-sm uppercase tracking-wide"
          >
            Back
          </button>
        </div>

        {error !== null && (
          <p className="mb-4 text-red-400 text-sm">{error}</p>
        )}

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-gray-400 text-xs uppercase tracking-wide">Player Name</span>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name"
              className="bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-gray-400 text-xs uppercase tracking-wide">Gym Name</span>
            <input
              type="text"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="Your gym's name"
              className="bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-gray-400 text-xs uppercase tracking-wide">Nation</span>
            <select
              value={selectedNation}
              onChange={(e) => setSelectedNation(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-gray-500 appearance-none"
            >
              <option value="">Select a nation</option>
              {options?.defaults.renderedNations.map((n) => (
                <option key={n} value={n}>
                  {n.charAt(0).toUpperCase() + n.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-gray-400 text-xs uppercase tracking-wide">City</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={availableCities.length === 0}
              className="bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-gray-500 appearance-none disabled:opacity-50"
            >
              <option value="">Select a city</option>
              {availableCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-gray-400 text-xs uppercase tracking-wide">Difficulty</span>
            <div className="grid grid-cols-4 gap-1">
              {difficulties.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`py-2 text-xs font-medium uppercase tracking-wide transition-colors ${
                    difficulty === d
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {difficultyLabels[d]}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-gray-400 text-xs uppercase tracking-wide">Seed</span>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-gray-500 font-mono"
            />
          </label>

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="mt-2 py-3 bg-white hover:bg-gray-200 text-gray-900 text-sm font-bold uppercase tracking-wide transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Start Game
          </button>
        </div>
      </div>
    </div>
  )
}
