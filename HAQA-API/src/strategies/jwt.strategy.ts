import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { UsersRepository } from '@/repository';
import { Users } from '@/entities/Users';

export interface JwtPayload {
    sub: string;
    username: string;
    email: string;
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
}

// Custom extractor that checks both Bearer token and cookies
const cookieExtractor = (req: Request): string | null => {
    if (req && req.cookies) {
        return req.cookies['accessToken'] || null;
    }
    return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        private readonly usersRepository: UsersRepository,
    ) {
        const secret = configService.get<string>('auth.jwt.secret');
        if (!secret) {
            throw new Error('JWT secret is not configured');
        }

        const issuer = configService.get<string>('auth.jwt.issuer');
        const audience = configService.get<string>('auth.jwt.audience');

        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                cookieExtractor,
            ]),
            ignoreExpiration: false,
            secretOrKey: secret,
            ...(issuer && { issuer }),
            ...(audience && { audience }),
        });
    }

    async validate(payload: JwtPayload): Promise<Users> {
        const userId = parseInt(payload.sub, 10);
        
        if (isNaN(userId)) {
            throw new UnauthorizedException('Invalid token payload');
        }

        const user = await this.usersRepository.findById(userId);

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (user.isActive === false) {
            throw new UnauthorizedException('User account is inactive');
        }

        return user;
    }
}

