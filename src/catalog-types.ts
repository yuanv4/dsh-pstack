export interface LiveEffort {
  readonly id: string
  readonly name: string
  readonly description?: string
}

export interface LiveRoute {
  readonly provider: string
  readonly providerName: string
  readonly model: string
  readonly modelName: string
  readonly efforts: readonly LiveEffort[]
  readonly defaultEffort?: string
}

export interface CatalogResult {
  readonly routes: LiveRoute[]
  readonly overlayPath: string
  readonly overlayMissing: boolean
  readonly inheritParent: true
  readonly emptyReason?: string
}
