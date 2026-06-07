export type ScriptLanguage = 'javascript' | 'python' | 'bash'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type WaitDurationUnit = 'ms' | 's'

export interface ApiCallNodeConfig {
  method?: HttpMethod
  url?: string
  headers?: Record<string, string>
  body?: string
  expectedStatus?: number
}

export interface WaitNodeConfig {
  duration?: number
  durationUnit?: WaitDurationUnit
}
