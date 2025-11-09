export interface AuthCacheEntity {
    userId: string;
    token: string;
    refreshToken?: string;
    expiresAt: number;
    issuedAt: number;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
}