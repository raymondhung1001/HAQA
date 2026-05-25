export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

export interface AuthTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt: number
  tokenType: 'Bearer'
}
