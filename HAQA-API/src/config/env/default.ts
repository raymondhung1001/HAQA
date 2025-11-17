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
    }
}