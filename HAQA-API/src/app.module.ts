import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RedisModule, RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { LoggerModule } from 'nestjs-pino';
import * as fs from 'fs';
import * as path from 'path';
import pinoRoll from 'pino-roll';
import { multistream } from 'pino';

import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { appConfiguration } from '@/config';

import { ControllerModule } from '@/controller/controller.module';
import { ServiceModule } from '@/service/service.module';
import { RepositoryModule } from '@/repository/repository.module';
import { ContextModule } from '@/context/context.module';
import { RequestIdMiddleware, LoggingMiddleware, CsrfMiddleware } from '@/middleware';
import { TokenController } from '@/controller/token.controller';
import { HttpExceptionFilter } from '@/filter/http-exception.filter';
import { TransformInterceptor } from '@/interceptor/transform.interceptor';
import { LoggingInterceptor } from '@/interceptor/logging.interceptor';
import { LoggerService } from '@/logger';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [appConfiguration],
		}),
		LoggerModule.forRootAsync({
			inject: [ConfigService],
			useFactory: async (config: ConfigService) => {
				const isDevelopment = process.env.NODE_ENV !== 'production';
				const loggingConfig = config.get('logging');
				const logLevel = loggingConfig?.level || (isDevelopment ? 'debug' : 'info');
				const enableFileLogging = loggingConfig?.enableFileLogging !== false;
				
				// Prepare streams array for multistream
				const streams: Array<{ level: string; stream: any }> = [];
				
				// Console stream - pretty printing for development, raw for production
				if (isDevelopment) {
					streams.push({
						level: logLevel,
						stream: require('pino-pretty')({
							colorize: true,
							singleLine: false,
							translateTime: 'SYS:standard',
							ignore: 'pid,hostname',
						}),
					});
				} else {
					// In production, also log to console (stdout) for containerized environments
					streams.push({
						level: logLevel,
						stream: process.stdout,
					});
				}
				
				// File stream with rotation
				if (enableFileLogging) {
					const logDir = loggingConfig?.logDir || 'logs';
					const logPath = path.resolve(process.cwd(), logDir);
					
					// Ensure log directory exists
					if (!fs.existsSync(logPath)) {
						fs.mkdirSync(logPath, { recursive: true });
					}
					
					const logFile = path.join(logPath, 'app.log');
					const maxFileSize = loggingConfig?.maxFileSize || 10 * 1024 * 1024; // 10MB
					const maxFiles = loggingConfig?.maxFiles || 10;
					const compress = loggingConfig?.compress !== false;
					
					// Create file stream with rotation using pino-roll (async function)
					const fileStream = await pinoRoll({
						file: logFile,
						frequency: 'daily', // Rotate daily
						size: maxFileSize, // Also rotate when file size exceeds
						limit: { count: maxFiles }, // Keep maxFiles rotated files
						compress: compress, // Compress archived logs
					});
					
					streams.push({
						level: logLevel,
						stream: fileStream,
					});
				}
				
				// Use multistream if we have multiple streams, otherwise use single transport
				const useMultistream = streams.length > 1;
				
				return {
					pinoHttp: {
						level: logLevel,
						// Use multistream for multiple outputs, otherwise use transport
						...(useMultistream
							? {
									stream: multistream(streams),
								}
							: isDevelopment && streams.length === 1
							? {
									transport: {
										target: 'pino-pretty',
										options: {
											colorize: true,
											singleLine: false,
											translateTime: 'SYS:standard',
											ignore: 'pid,hostname',
										},
									},
								}
							: {}),
						serializers: {
							req: (req: any) => ({
								id: req.id,
								method: req.method,
								url: req.url,
								query: req.query,
								params: req.params,
								remoteAddress: req.remoteAddress,
								remotePort: req.remotePort,
							}),
							res: (res: any) => ({
								statusCode: res.statusCode,
							}),
						},
						customProps: (req: any) => {
							const props: Record<string, any> = {
								context: 'HTTP',
							};
							if (req.id) {
								props.requestId = req.id;
							}
							return props;
						},
						redact: ['req.headers.authorization', 'req.headers.cookie'],
					},
				};
			},
		}),
		TypeOrmModule.forRootAsync({
			useFactory: (config: ConfigService) => ({
				...config.get<TypeOrmModuleOptions>('database'),
			}),
			inject: [ConfigService],
		}),
		RedisModule.forRootAsync({
			useFactory: (config: ConfigService) => {
				const redisConfig = config.get('redis');
				return {
					config: {
						host: redisConfig.host,
						port: redisConfig.port,
						username: redisConfig.username,
						password: redisConfig.password,
						enableReadyCheck: false,
					},
				};
			},
			inject: [ConfigService],
		}),

		/**
		 * Context
		 */
		ContextModule,

		/**
		 * Conrollers
		 */
		ControllerModule,

		/**
		 * Services
		 */
		ServiceModule,

		/**
		 * Repositories
		 */
		RepositoryModule
	],
	controllers: [AppController],
	providers: [
		AppService,
		HttpExceptionFilter,
		TransformInterceptor,
		LoggingInterceptor,
		LoggerService,
		CsrfMiddleware,
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		// Request ID and Logging middleware (applied first)
		// Apply to all route classes explicitly to avoid path-to-regexp wildcard issues
		consumer
			.apply(RequestIdMiddleware, LoggingMiddleware)
			.forRoutes(AppController, TokenController);

		// CSRF middleware (applied after cookie parser is set up in main.ts)
		// The middleware automatically skips CSRF for requests with Bearer tokens
		// Apply to all route classes explicitly to avoid path-to-regexp wildcard issues
		consumer
			.apply(CsrfMiddleware)
			.forRoutes(AppController, TokenController);
	}
}
