import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RedisModule, RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { appConfiguration } from '@/config';

import { ControllerModule } from '@/controller/controller.module';
import { ServiceModule } from '@/service/service.module';
import { RepositoryModule } from '@/repository/repository.module';
import { RequestIdMiddleware, LoggingMiddleware } from '@/middleware';
import { HttpExceptionFilter } from '@/filter/http-exception.filter';
import { TransformInterceptor } from '@/interceptor/transform.interceptor';

@Module({
	imports: [
		LoggerModule.forRootAsync({
			useFactory: () => {
				const isDevelopment = process.env.NODE_ENV !== 'production';
				return {
					pinoHttp: {
						level: isDevelopment ? 'debug' : 'info',
						transport: isDevelopment
							? {
									target: 'pino-pretty',
									options: {
										colorize: true,
										singleLine: false,
										translateTime: 'SYS:standard',
										ignore: 'pid,hostname',
									},
								}
							: undefined,
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
						customProps: (req: any) => ({
							context: 'HTTP',
						}),
						redact: ['req.headers.authorization', 'req.headers.cookie'],
					},
				};
			},
		}),
		ConfigModule.forRoot({
			isGlobal: true,
			load: [appConfiguration],
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
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer
			.apply(RequestIdMiddleware, LoggingMiddleware)
			.forRoutes('*');
	}
}
