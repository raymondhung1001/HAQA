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


}