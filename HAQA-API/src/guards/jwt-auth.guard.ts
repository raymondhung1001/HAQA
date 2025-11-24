import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { RequestContextService } from '@/context/request-context.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(
        private reflector: Reflector,
        private readonly requestContextService: RequestContextService,
    ) {
        super();
    }

    canActivate(context: ExecutionContext) {
        // Check if route is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        // Call parent handler first
        const result = super.handleRequest(err, user, info, context);

        // If user is authenticated, set userId in request context
        if (user && user.id) {
            this.requestContextService.setUserId(user.id);
        }

        return result;
    }
}

