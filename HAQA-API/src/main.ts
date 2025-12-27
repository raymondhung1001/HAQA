import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filter/http-exception.filter';
import { TransformInterceptor } from './interceptor/transform.interceptor';
import { LoggingInterceptor } from './interceptor/logging.interceptor';

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		bufferLogs: true,
	});

	const configService = app.get(ConfigService);
	const logger = app.get(Logger);

	app.useLogger(logger);

	// Security middleware
	app.use(helmet(configService.get('security.helmet') || {}));
	app.use(cookieParser());
	app.enableCors(configService.get('security.cors') || {});

	// Global configuration
	const globalPrefix = configService.get<string>('app.globalPrefix', 'api');
	// Using exclude option to avoid path-to-regexp warnings with global prefix
	// The exclude array is empty since we want the prefix on all routes
	app.setGlobalPrefix(globalPrefix, {
		exclude: [],
	});

	// Global filters and interceptors
	app.useGlobalFilters(app.get(HttpExceptionFilter));
	app.useGlobalInterceptors(
		app.get(TransformInterceptor),
		app.get(LoggingInterceptor),
	);

	// Start server
	const port = configService.get<number>('app.port') || 3001;
	await app.listen(port);

	logger.log(`Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap().catch((error) => {
	console.error('Failed to start application:', error);
	process.exit(1);
});
