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
    }
}