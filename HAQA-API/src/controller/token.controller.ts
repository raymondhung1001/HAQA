import { Controller, Post } from "@nestjs/common";
import { z } from "zod";

import { AuthService, AuthTokenResponse } from "@/service/auth.service";
import { Public } from "@/decorators";
import { BodySchema } from "@/pipe";

// Define Zod schema for login validation
const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Define Zod schema for refresh token validation
const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

type LoginDto = z.infer<typeof loginSchema>;
type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

@Controller('token')
export class TokenController {

    constructor(private readonly authService: AuthService) { 
    }

    @Public()
    @Post()
    async createToken(@BodySchema(loginSchema) loginDto: LoginDto): Promise<AuthTokenResponse> {
        return this.authService.getToken(loginDto.username, loginDto.password);
    }

    @Public()
    @Post('refresh')
    async refreshToken(@BodySchema(refreshTokenSchema) refreshDto: RefreshTokenDto): Promise<AuthTokenResponse> {
        return this.authService.refreshToken(refreshDto.refreshToken);
    }

}