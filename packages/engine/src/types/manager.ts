// Manager stub — full implementation when pro career system is built.
// A manager handles fighter business at pro level — separate from gym and promoter.
// Fighter references managerId — this type makes that reference valid.

export interface Manager {
  id: string
  name: string
  reputation: number   // 0-100
  nationality: string
  // Full manager fields added when pro career system is built
}
