import { appConfiguration } from './';
import { execSync } from 'child_process';
import * as path from 'path';

const generateEntities = async () => {
    try {
        const config = await appConfiguration();
        const dbConfig = config.database;

        // Log database configuration
        console.log(`\nUsing database configuration for environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('- Host:', dbConfig.host);
        console.log('- Port:', dbConfig.port);
        console.log('- Database:', dbConfig.database);
        console.log('- Username:', dbConfig.username);

        // Define output path - relative to project root
        const outputPath = path.resolve(process.cwd(), 'src/entities');

        // Define generator options in a more readable format
        const generatorOptions = [
            `-h ${dbConfig.host}`,
            `-p ${dbConfig.port}`,
            `-d ${dbConfig.database}`,
            `-u ${dbConfig.username}`,
            `-x ${dbConfig.password}`,
            `-e postgres`,
            `-o ${outputPath}`,
            `--noConfig`,
            `--schema=haqa_schema`,
            `--case-entity=pascal`,
            `--case-property=camel`,
            `--skipSchema=public`
        ];

        // Construct the command string
        const command = `npx typeorm-model-generator ${generatorOptions.join(' ')}`;

        console.log('\nGenerating entities...');
        
        // Log a cleaner version of the command (without password)
        const loggableCommand = command.replace(`-x ${dbConfig.password}`, '-x ********');
        console.log('Command:', loggableCommand);
        
        execSync(command, { stdio: 'inherit' });
        console.log('Entities generated successfully!');
    } catch (error) {
        console.error('Error generating entities:', error);
        console.error('Error details:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
};

(async () => {
    await generateEntities();
})();