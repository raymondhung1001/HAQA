import { BadRequestException, Controller, Post, Res, Req, UseGuards } from "@nestjs/common";
import { Response, Request } from "express";
import { z } from "zod";
import { ConfigService } from "@nestjs/config";

import { AuthService, AuthTokenResponse } from "@/service/auth.service";
import { Public } from "@/decorators";
import { CurrentUser } from "@/decorators";
import { BodySchema } from "@/pipe";
import { Users } from "@/entities/Users";
import { JwtAuthGuard } from "@/guards";

// Define Zod schema for login validation
const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    rememberMe: z.boolean().optional(),
});

// Define Zod schema for refresh token validation
// Refresh token can come from cookies, so body is optional
const refreshTokenSchema = z.object({
    refreshToken: z.string().optional(),
}).passthrough();

type LoginDto = z.infer<typeof loginSchema>;
type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

@Controller('token')
@UseGuards(JwtAuthGuard)
export class TokenController {

    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { 
    }

    /**
     * Set tokens in HttpOnly cookies
     */
    private setTokenCookies(res: Response, tokenData: AuthTokenResponse, rememberMe: boolean = false): void {
        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        const sameSite = isProduction ? 'strict' : 'lax';
        const baseCookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: sameSite as 'strict' | 'lax' | 'none',
            path: '/',
        };

        res.cookie('accessToken', tokenData.accessToken, {
            ...baseCookieOptions,
            maxAge: tokenData.expiresIn * 1000,
        });

        const refreshExpiresIn = this.configService.get<number>('auth.jwt.refreshExpiresIn', 604800);
        res.cookie(
            'refreshToken',
            tokenData.refreshToken,
            rememberMe
                ? { ...baseCookieOptions, maxAge: refreshExpiresIn * 1000 }
                : baseCookieOptions,
        );
    }

    @Public()
    @Post()
    async createToken(
        @BodySchema(loginSchema) loginDto: LoginDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AuthTokenResponse> {
        const tokenData = await this.authService.getToken(loginDto.username, loginDto.password);
        
        // Set tokens in HttpOnly cookies
        this.setTokenCookies(res, tokenData, loginDto.rememberMe || false);
        
        return tokenData;
    }

    @Public()
    @Post('refresh')
    async refreshToken(
        @BodySchema(refreshTokenSchema) refreshDto: RefreshTokenDto,
        @Res({ passthrough: true }) res: Response,
        @Req() req: Request,
    ): Promise<AuthTokenResponse> {
        // Try to get refresh token from cookie first, then from body
        const refreshToken = req.cookies?.['refreshToken'] || refreshDto?.refreshToken;
        
        if (!refreshToken) {
            throw new BadRequestException('Refresh token is required');
        }
        
        const tokenData = await this.authService.refreshToken(refreshToken);
        
        // Set new tokens in HttpOnly cookies
        this.setTokenCookies(res, tokenData);
        
        return tokenData;
    }

    /**
     * Clear auth cookies and invalidate cached tokens.
     */
    @Post('logout')
    async logout(
        @CurrentUser() user: Users,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ success: true }> {
        await this.authService.logout(String(user.id));

        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        const sameSite = isProduction ? 'strict' : 'lax';
        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: sameSite as 'strict' | 'lax' | 'none',
            path: '/',
            maxAge: 0,
        };

        res.clearCookie('accessToken', cookieOptions);
        res.clearCookie('refreshToken', cookieOptions);

        return { success: true };
    }

}