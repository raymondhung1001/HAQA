interface AuthFields {
    JWT: {
        TOKEN: string;
        USER_ID: string;
        ROLE: string;
        EXPIRES_AT: string;
        JTI: string;
    };
}

interface AuthKeys {
    JWT: (userId: string, deviceId?: string) => string;
}

interface RedisSchema {
    PREFIX: {
        AUTH: string;
    };
    AUTH: {
        KEYS: AuthKeys;
        FIELDS: {
            JWT: AuthFields['JWT'];
        };
    };
    CONFIG: {
        TOKEN_TTL: number;
    };
}

const redisSchema: RedisSchema = {
    PREFIX: {
        AUTH: 'auth'
    },

    AUTH: {
        KEYS: {
            JWT: (userId: string, deviceId: string = 'default'): string => `auth:jwt:${userId}:${deviceId}`,
        },
        FIELDS: {
            JWT: {
                TOKEN: 'token',
                USER_ID: 'userId',
                ROLE: 'role',
                EXPIRES_AT: 'expiresAt',
                JTI: 'jti'
            }
        }
    },
    CONFIG: {
        TOKEN_TTL: 86400
    }
};

export default redisSchema;