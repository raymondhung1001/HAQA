import { appConfiguration } from './';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Database configuration interface for entity generation
 */
interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
}

/**
 * Validates that all required database configuration properties are present and valid
 */
function validateDbConfig(dbConfig: unknown): asserts dbConfig is DatabaseConfig {
    if (!dbConfig || typeof dbConfig !== 'object') {
        throw new Error('Database configuration is missing or invalid');
    }

    const config = dbConfig as Record<string, unknown>;
    const errors: string[] = [];

    // Validate string fields
    const stringFields = ['host', 'database', 'username', 'password'];
    for (const field of stringFields) {
        const value = config[field];
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
            errors.push(field);
        }
    }

    // Validate port (must be a positive number)
    const port = config.port;
    if (typeof port !== 'number' || isNaN(port) || port <= 0 || port > 65535) {
        errors.push('port');
    }

    if (errors.length > 0) {
        throw new Error(
            `Missing or invalid database configuration fields: ${errors.join(', ')}`
        );
    }
}

/**
 * Validates that the output path is within the project directory for security
 */
const validateOutputPath = (outputPath: string): void => {
    const projectRoot = process.cwd();
    const resolvedOutput = path.resolve(outputPath);
    const resolvedRoot = path.resolve(projectRoot);

    // Use path.relative to check if output is within project root
    // If output is outside, relative will contain '..' or be absolute
    const relative = path.relative(resolvedRoot, resolvedOutput);

    // Check if path is outside project root (contains '..' or is absolute)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(
            `Output path "${resolvedOutput}" is outside the project root "${resolvedRoot}"`
        );
    }
};

/**
 * Ensures the output directory exists, creates it if it doesn't
 */
const ensureOutputDirectory = async (outputPath: string): Promise<void> => {
    try {
        await fs.access(outputPath);
        // Verify it's actually a directory
        const stats = await fs.stat(outputPath);
        if (!stats.isDirectory()) {
            throw new Error(`Output path "${outputPath}" exists but is not a directory`);
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('not a directory')) {
            throw error;
        }
        // Directory doesn't exist, create it
        try {
            await fs.mkdir(outputPath, { recursive: true });
        } catch (mkdirError) {
            throw new Error(
                `Failed to create output directory "${outputPath}": ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`
            );
        }
    }
};

/**
 * Creates a loggable version of command arguments (masks password)
 */
const createLoggableArgs = (args: string[]): string[] => {
    const loggableArgs = [...args];
    const passwordIndex = loggableArgs.findIndex((_, index) => 
        index > 0 && loggableArgs[index - 1] === '-x'
    );
    if (passwordIndex !== -1) {
        loggableArgs[passwordIndex] = '********';
    }
    return loggableArgs;
};

/**
 * Executes typeorm-model-generator with proper argument handling
 * Uses spawn instead of execSync for better security (prevents command injection)
 */
const executeGenerator = async (
    dbConfig: DatabaseConfig,
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
        const loggableArgs = createLoggableArgs(args);
        console.log('Executing: npx', loggableArgs.join(' '));

        // Use spawn for better security and control
        const childProcess: ChildProcess = spawn('npx', args, {
            stdio: 'inherit',
            shell: process.platform === 'win32', // Use shell on Windows for npx
            cwd: process.cwd(),
        });

        // Handle process interruption signals
        const signalHandler = (signal: NodeJS.Signals) => {
            if (!childProcess.killed) {
                childProcess.kill(signal);
            }
        };

        process.on('SIGINT', signalHandler);
        process.on('SIGTERM', signalHandler);

        // Clean up signal handlers (shared utility)
        const removeSignalHandlers = () => {
            process.removeListener('SIGINT', signalHandler);
            process.removeListener('SIGTERM', signalHandler);
        };

        // Wrap resolve/reject to clean up signal handlers
        const wrappedResolve = () => {
            removeSignalHandlers();
            resolve();
        };

        const wrappedReject = (error: Error) => {
            removeSignalHandlers();
            reject(error);
        };

        childProcess.on('error', (error) => {
            wrappedReject(
                new Error(
                    `Failed to start typeorm-model-generator: ${error.message}. ` +
                    `Make sure npx is available in your PATH.`
                )
            );
        });

        childProcess.on('exit', (code, signal) => {
            if (code === 0) {
                wrappedResolve();
            } else if (code === null) {
                // Process was killed by signal
                wrappedReject(
                    new Error(
                        `typeorm-model-generator was terminated by signal: ${signal || 'unknown'}`
                    )
                );
            } else {
                wrappedReject(
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

        // Validate output path is within project directory
        validateOutputPath(outputPath);

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