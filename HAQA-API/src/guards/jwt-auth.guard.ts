import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { RequestContextService } from '@/context/request-context.service';
import { AuthCacheRepository } from '@/repository';
import { Users } from '@/entities/Users';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(
        private reflector: Reflector,
        private readonly requestContextService: RequestContextService,
        private readonly authCacheRepository: AuthCacheRepository,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const activated = await super.canActivate(context);
        if (!activated) {
            return false;
        }

        const request = context.switchToHttp().getRequest<Request & { user?: Users }>();
        const user = request.user;
        const accessToken = this.extractAccessToken(request);

        if (!user?.id || !accessToken) {
            throw new UnauthorizedException('Invalid token');
        }

        const cachedSession = await this.authCacheRepository.getAuthToken(String(user.id));
        if (!cachedSession || cachedSession.token !== accessToken) {
            throw new UnauthorizedException('Session expired or invalid');
        }

        return true;
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        const result = super.handleRequest(err, user, info, context);

        if (user && user.id) {
            this.requestContextService.setUserId(user.id);
        }

        return result;
    }

    private extractAccessToken(request: Request): string | null {
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.slice(7);
        }

        return request.cookies?.['accessToken'] || null;
    }
}

