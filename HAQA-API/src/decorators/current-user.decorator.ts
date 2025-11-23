import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Users } from '@/entities/Users';

export const CurrentUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): Users => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);

