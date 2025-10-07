import * as defaultConfig from './env/default';
import * as productionConfig from './env/production';

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type BaseConfig = typeof defaultConfig.config;
type EnvConfig = typeof productionConfig.config;
type Config = BaseConfig & EnvConfig;

const isObject = (item: any): item is Record<string, any> => {
    return item && typeof item === 'object' && !Array.isArray(item);
};

const deepMerge = <T extends Record<string, any>, U extends DeepPartial<T>>(
    target: T,
    source: U
): T & U => {
    const output = { ...target } as Record<string, any>;

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach((key) => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }

    return output as T & U;
};

export const appConfiguration = async (): Promise<Config> => {
    try {
        const defaultEnv = defaultConfig.config;
        const environment = process.env.NODE_ENV || 'development';

        let envConfig;
        try {
            envConfig = (await import(`./env/${environment}`)).config;
        } catch (error) {
            console.warn(`Could not load environment config for "${environment}", using default only.`);
            envConfig = {};
        }

        return deepMerge(defaultEnv, envConfig);

    } catch (error) {
        console.error('Failed to load configuration:', error);
        throw new Error('Configuration loading failed');
    }
};