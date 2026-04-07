// loader.ts loads all game data from JSON files at startup.
// The engine receives this object and uses it throughout the simulation.
// Nothing in the engine reads JSON files directly — only the loader does.
//
// All files are loaded eagerly at startup rather than lazily per-request.
// Eager loading means any missing or malformed file crashes immediately with
// a clear error message — before any simulation runs. Lazy loading would
// produce silent failures or corrupt mid-simulation state that is harder
// to diagnose.

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import type {
  SoulTraitsData,
  AttributesData,
  WeightClassesData,
  PhysicalStatsData,
  HealthData,
  GiftsAndFlawsData,
  NationData,
  CitiesData,
  NamesData,
  EconomicStatusesData,
  ReasonsForBoxingData,
  CoachVoiceAttributesData,
  CoachVoicePhysicalData,
  CoachVoiceGiftsFlawsData,
} from '../types/data/index.js'

// DATA_ROOT resolves relative to this compiled file's location on disk.
// From dist/data/loader.js the path ../../data reaches packages/engine/data/.
// The same two-level traversal works when Vitest executes src/data/loader.ts directly.
const DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../data')

// load reads a single JSON file from within DATA_ROOT.
// Throws a descriptive error on any failure — the engine must not start with broken data.
function load<T>(relativePath: string): T {
  const fullPath = join(DATA_ROOT, relativePath)
  try {
    return JSON.parse(readFileSync(fullPath, 'utf-8')) as T
  } catch (err) {
    throw new Error(`Failed to load game data at "${fullPath}": ${String(err)}`)
  }
}

// GameData is the single typed object the engine holds after startup.
// All simulation code receives this object — nothing reads JSON after this point.
export interface GameData {
  soulTraits: SoulTraitsData
  attributes: AttributesData
  weightClasses: WeightClassesData
  physicalStats: PhysicalStatsData
  health: HealthData
  giftsAndFlaws: GiftsAndFlawsData
  nations: {
    latvia: {
      nation: NationData
      cities: CitiesData
      names: NamesData
      economicStatuses: EconomicStatusesData
      reasonsForBoxing: ReasonsForBoxingData
      coachVoice: {
        attributes: CoachVoiceAttributesData
        physicalStats: CoachVoicePhysicalData
        giftsAndFlaws: CoachVoiceGiftsFlawsData
      }
    }
  }
}

// loadGameData is called once when the engine initialises.
// The returned object is passed into every engine function that needs data.
export function loadGameData(): GameData {
  return {
    soulTraits: load<SoulTraitsData>('universal/soul-traits.json'),
    attributes: load<AttributesData>('universal/attributes.json'),
    weightClasses: load<WeightClassesData>('universal/weight-classes.json'),
    physicalStats: load<PhysicalStatsData>('universal/physical-stats.json'),
    health: load<HealthData>('universal/health.json'),
    giftsAndFlaws: load<GiftsAndFlawsData>('universal/gifts-and-flaws.json'),
    nations: {
      latvia: {
        nation: load<NationData>('nations/latvia/nation.json'),
        cities: load<CitiesData>('nations/latvia/cities.json'),
        names: load<NamesData>('nations/latvia/names.json'),
        economicStatuses: load<EconomicStatusesData>('nations/latvia/economic-statuses.json'),
        reasonsForBoxing: load<ReasonsForBoxingData>('nations/latvia/reasons-for-boxing.json'),
        coachVoice: {
          attributes: load<CoachVoiceAttributesData>('nations/latvia/coach-voice/attributes.json'),
          physicalStats: load<CoachVoicePhysicalData>('nations/latvia/coach-voice/physical-stats.json'),
          giftsAndFlaws: load<CoachVoiceGiftsFlawsData>('nations/latvia/coach-voice/gifts-and-flaws.json'),
        },
      },
    },
  }
}
