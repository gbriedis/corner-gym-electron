// Shared meta block present on every data file.
// version and description are optional because some files use `purpose` instead.
export interface Meta {
  version?: string
  description?: string
  [key: string]: unknown
}
