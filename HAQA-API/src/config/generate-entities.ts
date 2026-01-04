import { appConfiguration } from './';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Validates that all required database configuration properties are present and valid
 */
const validateDbConfig = (dbConfig: any): void => {
    if (!dbConfig || typeof dbConfig !== 'object') {
        throw new Error('Database configuration is missing or invalid');
    }

    const errors: string[] = [];

    // Validate string fields
    const stringFields = ['host', 'database', 'username', 'password'];
    for (const field of stringFields) {
        const value = dbConfig[field];
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
            errors.push(field);
        }
    }

    // Validate port (must be a positive number)
    const port = dbConfig.port;
    if (typeof port !== 'number' || isNaN(port) || port <= 0 || port > 65535) {
        errors.push('port');
    }

    if (errors.length > 0) {
        throw new Error(
            `Missing or invalid database configuration fields: ${errors.join(', ')}`
        );
    }
};

/**
 * Ensures the output directory exists, creates it if it doesn't
 */
const ensureOutputDirectory = async (outputPath: string): Promise<void> => {
    try {
        await fs.access(outputPath);
    } catch {
        // Directory doesn't exist, create it
        await fs.mkdir(outputPath, { recursive: true });
    }
};

/**
 * Executes typeorm-model-generator with proper argument handling
 * Uses spawn instead of execSync for better security (prevents command injection)
 */
const executeGenerator = async (
    dbConfig: { host: string; port: number; database: string; username: string; password: string },
    outputPath: string
): Promise<void> => {
    return new Promise((resolve, reject) => {
        // Build command arguments as an array to prevent command injection
        const args = [
            'typeorm-model-generator',
            '-h', String(dbConfig.host),
            '-p', String(dbConfig.port),
            '-d', dbConfig.database,
            '-u', dbConfig.username,
            '-x', dbConfig.password,
            '-e', 'postgres',
            '-o', outputPath,
            '--noConfig',
            '--schema=haqa_schema',
            '--case-entity=pascal',
            '--case-property=camel',
            '--skipSchema=public',
            '--generateIndex',
        ];

        // Log the command (without password) for debugging
        const loggableArgs = args.map((arg, index) => {
            const prevArg = args[index - 1];
            return prevArg === '-x' ? '********' : arg;
        });
        console.log('Executing: npx', loggableArgs.join(' '));

        // Use spawn for better security and control
        const childProcess = spawn('npx', args, {
            stdio: 'inherit',
            shell: process.platform === 'win32', // Use shell on Windows for npx
            cwd: process.cwd(),
        });

        childProcess.on('error', (error) => {
            reject(new Error(`Failed to start typeorm-model-generator: ${error.message}`));
        });

        childProcess.on('exit', (code, signal) => {
            if (code === 0) {
                resolve();
            } else {
                reject(
                    new Error(
                        `typeorm-model-generator exited with code ${code}${signal ? ` and signal ${signal}` : ''}`
                    )
                );
            }
        });
    });
};

/**
 * Main function to generate TypeORM entities from database schema
 */
const generateEntities = async (): Promise<void> => {
    try {
        const config = await appConfiguration();
        const dbConfig = config.database;

        // Validate database configuration
        validateDbConfig(dbConfig);

        // Log database configuration
        const environment = process.env.NODE_ENV || 'development';
        console.log(`\nUsing database configuration for environment: ${environment}`);
        console.log('- Host:', dbConfig.host);
        console.log('- Port:', dbConfig.port);
        console.log('- Database:', dbConfig.database);
        console.log('- Username:', dbConfig.username);

        // Define output path - relative to project root
        const outputPath = path.resolve(process.cwd(), 'src/entities');

        // Ensure output directory exists
        await ensureOutputDirectory(outputPath);
        console.log(`- Output directory: ${outputPath}`);

        console.log('\nGenerating entities...');

        // Execute the generator
        await executeGenerator(dbConfig, outputPath);

        console.log('\n✅ Entities generated successfully!');
    } catch (error) {
        console.error('\n❌ Error generating entities:');
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            if (error.stack && process.env.DEBUG) {
                console.error('Stack trace:', error.stack);
            }
        } else {
            console.error('Unknown error:', String(error));
        }
        process.exit(1);
    }
};

// Execute the script
(async () => {
    await generateEntities();
})();