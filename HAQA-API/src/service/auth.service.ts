import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

import { UsersRepository, AuthCacheRepository } from "@/repository";
import { Users } from "@/entities/Users";
import { AuthCacheEntity } from "@/redis-entities/AuthCacheEntity";

export interface AuthTokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    expiresAt: number;
    tokenType: 'Bearer';
}

@Injectable()
export class AuthService {

    constructor(
        private readonly usersRepository: UsersRepository,
        private readonly authCacheRepository: AuthCacheRepository,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {

    }

    async getToken(username: string, password: string): Promise<AuthTokenResponse> {
        const user: Users | null = await this.usersRepository.verifyCredentials(username, password);

        if (!user || user.isActive === false) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const secret = this.configService.get<string>('auth.jwt.secret');
        if (!secret) {
            throw new Error('JWT secret is not configured');
        }

        const refreshSecret = this.configService.get<string>('auth.jwt.refreshSecret', secret);
        const issuer = this.configService.get<string>('auth.jwt.issuer');
        const audience = this.configService.get<string>('auth.jwt.audience');

        const expiresIn = this.configService.get<number>('auth.jwt.expiresIn', 3600);
        const refreshExpiresIn = this.configService.get<number>('auth.jwt.refreshExpiresIn', 604800);

        const payload = {
            sub: String(user.id),
            username: user.username,
            email: user.email,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret,
                expiresIn,
                issuer,
                audience,
            }),
            this.jwtService.signAsync(payload, {
                secret: refreshSecret,
                expiresIn: refreshExpiresIn,
                issuer,
                audience,
            }),
        ]);

        const issuedAt = Date.now();
        const expiresAt = issuedAt + expiresIn * 1000;

        const cacheEntry: AuthCacheEntity = {
            userId: String(user.id),
            token: accessToken,
            refreshToken,
            expiresAt,
            issuedAt,
        };

        await Promise.all([
            this.authCacheRepository.setAuthToken(String(user.id), cacheEntry, expiresIn),
            this.authCacheRepository.setRefreshToken(String(user.id), refreshToken, refreshExpiresIn),
        ]);

        return {
            accessToken,
            refreshToken,
            expiresIn,
            expiresAt,
            tokenType: 'Bearer',
        };
    }

    async refreshToken(refreshToken: string): Promise<AuthTokenResponse> {
        const secret = this.configService.get<string>('auth.jwt.secret');
        if (!secret) {
            throw new Error('JWT secret is not configured');
        }

        const refreshSecret = this.configService.get<string>('auth.jwt.refreshSecret', secret);
        const issuer = this.configService.get<string>('auth.jwt.issuer');
        const audience = this.configService.get<string>('auth.jwt.audience');

        // Verify and decode the refresh token
        let payload: any;
        try {
            payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: refreshSecret,
                issuer,
                audience,
            });
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const userId = payload.sub;
        if (!userId) {
            throw new UnauthorizedException('Invalid token payload');
        }

        // Verify the refresh token matches what's stored in Redis
        const storedRefreshToken = await this.authCacheRepository.getRefreshToken(userId);
        if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
            throw new UnauthorizedException('Refresh token not found or invalid');
        }

        // Get user to ensure they're still active
        const user = await this.usersRepository.findById(parseInt(userId, 10));
        if (!user || user.isActive === false) {
            throw new UnauthorizedException('User not found or inactive');
        }

        const expiresIn = this.configService.get<number>('auth.jwt.expiresIn', 3600);
        const refreshExpiresIn = this.configService.get<number>('auth.jwt.refreshExpiresIn', 604800);

        const newPayload = {
            sub: String(user.id),
            username: user.username,
            email: user.email,
        };

        // Generate new tokens
        const [newAccessToken, newRefreshToken] = await Promise.all([
            this.jwtService.signAsync(newPayload, {
                secret,
                expiresIn,
                issuer,
                audience,
            }),
            this.jwtService.signAsync(newPayload, {
                secret: refreshSecret,
                expiresIn: refreshExpiresIn,
                issuer,
                audience,
            }),
        ]);

        const issuedAt = Date.now();
        const expiresAt = issuedAt + expiresIn * 1000;

        const cacheEntry: AuthCacheEntity = {
            userId: String(user.id),
            token: newAccessToken,
            refreshToken: newRefreshToken,
            expiresAt,
            issuedAt,
        };

        // Update tokens in cache
        await Promise.all([
            this.authCacheRepository.setAuthToken(String(user.id), cacheEntry, expiresIn),
            this.authCacheRepository.setRefreshToken(String(user.id), newRefreshToken, refreshExpiresIn),
        ]);

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn,
            expiresAt,
            tokenType: 'Bearer',
        };
    }


}