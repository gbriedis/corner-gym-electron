// loader.ts loads all game data from JSON files at startup.
// The engine receives this object and uses it throughout the simulation.
// Nothing in the engine reads JSON files directly — only the loader does.
//
// All files are loaded eagerly at startup rather than lazily per-request.
// Eager loading means any missing or malformed file crashes immediately with
// a clear error message — before any simulation runs. Lazy loading would
// produce silent failures or corrupt mid-simulation state that is harder
// to diagnose.
//
// Nations are loaded dynamically by scanning data/nations/ rather than
// hardcoding nation keys in this file. This means adding a nation is:
// drop the folder in, restart. No engine code changes required.
// This is the foundation for future mod support.

import { readFileSync, readdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import type {
  SoulTraitsData,
  AttributesData,
  WeightClassesData,
  PhysicalStatsData,
  HealthData,
  GiftsAndFlawsData,
  DevelopmentProfilesData,
  NationData,
  CitiesData,
  NamesData,
  EconomicStatusesData,
  ReasonsForBoxingData,
  CoachVoiceAttributesData,
  CoachVoicePhysicalData,
  CoachVoiceGiftsFlawsData,
  SanctioningBodiesData,
  AmateurCircuitData,
  EventTemplatesData,
  VenuesData,
  InternationalCircuitsData,
  RewardsData,
  AttributeAccumulationData,
  GymStartingStatesData,
  GymEquipmentTypesData,
  GymNamesData,
  StyleMatchupsData,
  StyleDevelopmentData,
} from '../types/data/index.js'
import type { RulesData } from '../types/competition.js'

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

// NationBoxingData holds all boxing files for a single nation.
// Optional on NationBundle — nations can exist without a boxing scene.
// Adding boxing to a nation is: drop the boxing/ folder in, restart.
export interface NationBoxingData {
  sanctioningBodies: SanctioningBodiesData
  amateurCircuit: AmateurCircuitData
  eventTemplates: EventTemplatesData
  venues: VenuesData
  // rules is undefined when the nation has no *-rules.json file in boxing/.
  // A nation can operate without explicit rules data — the engine falls back to
  // defaults when rules are absent. Latvia uses lbf-rules.json.
  rules?: RulesData
}

// NationBundle holds all data for a single loaded nation.
// The structure is identical regardless of which nation it is —
// any nation folder with the standard files becomes a valid bundle.
export interface NationBundle {
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
  gymStartingStates: GymStartingStatesData
  // gymNames is undefined when the nation has no gym-names.json — engine falls back to patterns.
  gymNames?: GymNamesData
  // boxing is undefined when the nation has no boxing/ folder — not an error.
  boxing?: NationBoxingData
}

// InternationalData holds shared data that is not nation-specific.
// International boxing bodies, circuits, and venues are referenced by
// any nation that participates in those events.
export interface InternationalData {
  boxing: {
    sanctioningBodies: SanctioningBodiesData
    circuits: InternationalCircuitsData
    eventTemplates: EventTemplatesData
    venues: VenuesData
    eubcRules: RulesData
    ibaRules: RulesData
  }
}

// loadNationBundle loads all required files for a single nation folder.
// The nation id in nation.json must match the folder name — a mismatch means
// the engine would silently use the wrong id for city lookups, name pools,
// and generation, so we treat it as a hard error rather than a warning.
function loadNationBundle(nationsDir: string, folderName: string): NationBundle {
  const base = join(nationsDir, folderName)

  // loadFile wraps individual file loads with nation-level context in the error.
  // This ensures the error message always names the nation and the missing file,
  // not just a raw path — important when loading many nations at startup.
  function loadFile<T>(file: string): T {
    try {
      const fullPath = join(base, file)
      return JSON.parse(readFileSync(fullPath, 'utf-8')) as T
    } catch (_err) {
      throw new Error(`Nation "${folderName}" is missing required file "${file}"`)
    }
  }

  const nation = loadFile<NationData>('nation.json')

  // Folder name is the canonical nation id throughout the engine.
  // If nation.json declares a different id, any code that uses the folder
  // name to look up the bundle would find a mismatch and break silently.
  if (nation.id !== folderName) {
    throw new Error(
      `Nation folder "${folderName}" contains nation.json with id "${nation.id}" — ` +
      `folder name and nation id must match.`,
    )
  }

  // Boxing data is optional — a nation without a boxing/ folder is valid.
  // We check for the folder before attempting any loads so missing boxing
  // produces undefined rather than a hard error. This allows new nations to
  // be added incrementally without requiring boxing data on day one.
  const boxingDir = join(base, 'boxing')
  let boxing: NationBoxingData | undefined
  if (existsSync(boxingDir)) {
    // Scan for a *-rules.json file. A nation may have exactly one rules file
    // named after its sanctioning body (e.g. lbf-rules.json). If none is found,
    // rules remains undefined — the engine will fall back to defaults.
    const rulesFile = readdirSync(boxingDir).find(f => f.endsWith('-rules.json'))
    const rulesData = rulesFile !== undefined
      ? loadFile<RulesData>(`boxing/${rulesFile}`)
      : undefined

    boxing = {
      sanctioningBodies: loadFile<SanctioningBodiesData>('boxing/sanctioning-bodies.json'),
      amateurCircuit: loadFile<AmateurCircuitData>('boxing/amateur-circuit.json'),
      eventTemplates: loadFile<EventTemplatesData>('boxing/event-templates.json'),
      venues: loadFile<VenuesData>('boxing/venues.json'),
    }

    if (rulesData !== undefined) {
      boxing.rules = rulesData
    }
  }

  const bundle: NationBundle = {
    nation,
    cities: loadFile<CitiesData>('cities.json'),
    names: loadFile<NamesData>('names.json'),
    economicStatuses: loadFile<EconomicStatusesData>('economic-statuses.json'),
    reasonsForBoxing: loadFile<ReasonsForBoxingData>('reasons-for-boxing.json'),
    coachVoice: {
      attributes: loadFile<CoachVoiceAttributesData>('coach-voice/attributes.json'),
      physicalStats: loadFile<CoachVoicePhysicalData>('coach-voice/physical-stats.json'),
      giftsAndFlaws: loadFile<CoachVoiceGiftsFlawsData>('coach-voice/gifts-and-flaws.json'),
    },
    gymStartingStates: loadFile<GymStartingStatesData>('gym-starting-states.json'),
  }

  // Conditionally assign so exactOptionalPropertyTypes is satisfied —
  // the field must be absent (not undefined) when the file does not exist.

  // gym-names.json is optional — nations can be added without a name pool.
  // Engine falls back to pattern-based generation when absent.
  const gymNamesPath = join(base, 'gym-names.json')
  if (existsSync(gymNamesPath)) {
    bundle.gymNames = loadFile<GymNamesData>('gym-names.json')
  }

  if (boxing !== undefined) {
    bundle.boxing = boxing
  }

  return bundle
}

// loadNationsFromDir scans a directory for nation subfolders and loads each one.
// Exported so tests can point it at a temporary directory to verify error behaviour
// without touching the real data folder.
export function loadNationsFromDir(nationsDir: string): Record<string, NationBundle> {
  const folders = readdirSync(nationsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)

  const nations: Record<string, NationBundle> = {}
  for (const folder of folders) {
    nations[folder] = loadNationBundle(nationsDir, folder)
  }
  return nations
}

// GameData is the single typed object the engine holds after startup.
// All simulation code receives this object — nothing reads JSON after this point.
// nations is keyed by nation id (which equals the folder name in data/nations/).
// Engine code accesses nations as: data.nations['latvia']
export interface GameData {
  soulTraits: SoulTraitsData
  attributes: AttributesData
  weightClasses: WeightClassesData
  physicalStats: PhysicalStatsData
  health: HealthData
  giftsAndFlaws: GiftsAndFlawsData
  developmentProfiles: DevelopmentProfilesData
  rewards: RewardsData
  attributeAccumulation: AttributeAccumulationData
  gymEquipmentTypes: GymEquipmentTypesData
  styleMatchups: StyleMatchupsData
  styleDevelopment: StyleDevelopmentData
  nations: Record<string, NationBundle>
  international: InternationalData
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
    developmentProfiles: load<DevelopmentProfilesData>('universal/development-profiles.json'),
    rewards: load<RewardsData>('universal/rewards.json'),
    attributeAccumulation: load<AttributeAccumulationData>('universal/attribute-accumulation.json'),
    gymEquipmentTypes: load<GymEquipmentTypesData>('universal/gym-equipment-types.json'),
    styleMatchups: load<StyleMatchupsData>('universal/style-matchups.json'),
    styleDevelopment: load<StyleDevelopmentData>('universal/style-development.json'),
    nations: loadNationsFromDir(join(DATA_ROOT, 'nations')),
    international: {
      boxing: {
        sanctioningBodies: load<SanctioningBodiesData>('international/boxing/sanctioning-bodies.json'),
        circuits: load<InternationalCircuitsData>('international/boxing/circuits.json'),
        eventTemplates: load<EventTemplatesData>('international/boxing/event-templates.json'),
        venues: load<VenuesData>('international/boxing/venues.json'),
        eubcRules: load<RulesData>('international/boxing/eubc-rules.json'),
        ibaRules: load<RulesData>('international/boxing/iba-rules.json'),
      },
    },
  }
}
