import { parseSizeToBytes } from '@/utils/size.util';

export const config = {
    database: {
        type: 'postgres',
        synchronize: false,
        logging: true,
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
        username: 'haqa_app',
        password: process.env.APP_USER_PASSWORD || 'P@ssw0rd',
        database: 'haqa_db',
        extra: {
            connectionLimit: 10,
        },
        autoLoadEntities: true,
    },
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
        username: 'haqa_app',
        password: process.env.REDIS_PASSWORD || 'P@ssw0rd',
    },
    auth: {
        jwt: {
            secret: process.env.JWT_SECRET || 'change-me-in-prod',
            expiresIn: process.env.JWT_EXPIRES_IN ? parseInt(process.env.JWT_EXPIRES_IN, 10) : 3600,
            refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'change-me-in-prod',
            refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ? parseInt(process.env.JWT_REFRESH_EXPIRES_IN, 10) : 604800,
            issuer: process.env.JWT_ISSUER || 'haqa-api',
            audience: process.env.JWT_AUDIENCE || 'haqa-clients',
        },
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
        logDir: process.env.LOG_DIR || 'logs',
        maxFileSize: parseSizeToBytes(process.env.LOG_MAX_FILE_SIZE) ?? 10 * 1024 * 1024, // 10MB default, supports units like "10MB", "1GB", etc.
        maxFiles: process.env.LOG_MAX_FILES ? parseInt(process.env.LOG_MAX_FILES, 10) : 10, // Keep 10 rotated files
        compress: process.env.LOG_COMPRESS !== 'false', // Compress archived logs
    },
    app: {
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
        globalPrefix: process.env.API_PREFIX || 'api',
    },
    mist: {
        // Mist ID Generator Configuration
        // Mist algorithm uses Redis for centralized sequence management
        // No timestamp dependency - works "forever" without overflow concerns
        
        // Sequence batch size - pre-fetch sequence numbers in batches for performance
        // Larger batches = fewer Redis calls but more wasted IDs if instance crashes
        // Default: 1000 (good balance between performance and efficiency)
        sequenceBatchSize: process.env.MIST_SEQUENCE_BATCH_SIZE 
            ? parseInt(process.env.MIST_SEQUENCE_BATCH_SIZE, 10) 
            : 1000,
        
        // Sequence batch TTL in seconds - how long to reserve a batch in Redis
        // Used for cleanup/recovery if an instance crashes with unused sequence numbers
        // Default: 60 seconds
        sequenceBatchTtl: process.env.MIST_SEQUENCE_BATCH_TTL 
            ? parseInt(process.env.MIST_SEQUENCE_BATCH_TTL, 10) 
            : 60,
    },
    security: {
        helmet: {
            contentSecurityPolicy: process.env.NODE_ENV === 'production',
            crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
            crossOriginOpenerPolicy: true,
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            dnsPrefetchControl: true,
            frameguard: { action: 'deny' },
            hidePoweredBy: true,
            hsts: {
                maxAge: 31536000, // 1 year
                includeSubDomains: true,
                preload: process.env.NODE_ENV === 'production',
            },
            ieNoOpen: true,
            noSniff: true,
            originAgentCluster: true,
            permittedCrossDomainPolicies: false,
            referrerPolicy: { policy: 'no-referrer' },
            xssFilter: true,
        },
        csrf: {
            enabled: process.env.CSRF_ENABLED !== 'false',
            cookie: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict' as const,
                path: '/',
            },
            ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
            skipIf: (req: any) => {
                // Skip CSRF for API routes that use Bearer tokens (JWT)
                const authHeader = req.headers.authorization;
                return authHeader && authHeader.startsWith('Bearer ');
            },
        },
        cors: {
            origin: process.env.CORS_ORIGIN 
                ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
                : process.env.NODE_ENV === 'production' 
                    ? [] // Must be explicitly configured in production
                    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Correlation-ID', 'X-CSRF-Token'],
            exposedHeaders: ['X-Request-ID', 'X-CSRF-Token'],
            credentials: true,
            maxAge: 86400, // 24 hours
        },
    },
}