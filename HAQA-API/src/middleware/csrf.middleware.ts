import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import CSRFToken from 'csrf';

/**
 * CSRF Protection Middleware
 * 
 * This middleware provides CSRF protection using the Double Submit Cookie pattern.
 * It generates a CSRF token and stores it in a cookie, then validates the token
 * from the request header or body.
 * 
 * Features:
 * - Skips CSRF for routes decorated with @SkipCsrf() (handled in AppModule)
 * - Skips CSRF for requests with Bearer tokens (JWT authentication)
 * - Configurable via environment variables
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
    private readonly csrfInstance: CSRFToken;
    private readonly enabled: boolean;
    private readonly cookieOptions: any;
    private readonly ignoreMethods: string[];

    constructor(private readonly configService: ConfigService) {
        this.csrfInstance = new CSRFToken();
        const csrfConfig = this.configService.get('security.csrf');
        this.enabled = csrfConfig?.enabled !== false;
        this.cookieOptions = csrfConfig?.cookie || {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
        };
        this.ignoreMethods = csrfConfig?.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'];
    }

    use(req: Request, res: Response, next: NextFunction) {
        // Skip CSRF if disabled
        if (!this.enabled) {
            return next();
        }

        // Skip CSRF for ignored HTTP methods
        if (this.ignoreMethods.includes(req.method)) {
            return this.handleTokenGeneration(req, res, next);
        }

        // Skip CSRF for requests with Bearer tokens (API authentication)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return next();
        }

        // Skip CSRF if custom skip function returns true
        const skipIf = this.configService.get('security.csrf.skipIf');
        if (skipIf && typeof skipIf === 'function' && skipIf(req)) {
            return next();
        }

        // Handle token generation for safe methods
        if (req.method === 'GET' || req.method === 'HEAD') {
            return this.handleTokenGeneration(req, res, next);
        }

        // Validate CSRF token for state-changing methods
        this.validateToken(req, res, next);
    }

    private handleTokenGeneration(req: Request, res: Response, next: NextFunction) {
        // Get existing secret from cookie or generate new one
        let secret = req.cookies?.['_csrf_secret'];
        
        if (!secret) {
            secret = this.csrfInstance.secretSync();
            res.cookie('_csrf_secret', secret, this.cookieOptions);
        }

        // Generate and set token
        const token = this.csrfInstance.create(secret);
        res.cookie('XSRF-TOKEN', token, {
            ...this.cookieOptions,
            httpOnly: false, // Client needs to read this for header/body
        });

        // Also expose token in response header for AJAX requests
        res.setHeader('X-CSRF-Token', token);

        next();
    }

    private validateToken(req: Request, res: Response, next: NextFunction) {
        const secret = req.cookies?.['_csrf_secret'];
        const token = this.getTokenFromRequest(req);

        if (!secret || !token) {
            throw new ForbiddenException('CSRF token missing');
        }

        if (!this.csrfInstance.verify(secret, token)) {
            throw new ForbiddenException('Invalid CSRF token');
        }

        next();
    }

    private getTokenFromRequest(req: Request): string | undefined {
        // Check header first (preferred for AJAX requests)
        const headerToken = req.headers['x-csrf-token'] || req.headers['xsrf-token'];
        if (headerToken && typeof headerToken === 'string') {
            return headerToken;
        }

        // Check cookie (set by browser automatically)
        const cookieToken = req.cookies?.['XSRF-TOKEN'];
        if (cookieToken) {
            return cookieToken;
        }

        // Check body (for form submissions)
        const bodyToken = req.body?._csrf || req.body?._token;
        if (bodyToken) {
            return bodyToken;
        }

        return undefined;
    }
}

