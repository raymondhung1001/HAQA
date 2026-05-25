/** JSON-serializable request/response bodies */
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface ApiErrorBody {
  message?: string
  error?: string
  statusCode?: number
}

export interface SuccessResponse<T> {
  success?: boolean
  data: T
  message?: string
}

export type ApiEnvelope<T> = SuccessResponse<T> | T
