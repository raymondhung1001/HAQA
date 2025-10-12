import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RedisModule, RedisModuleOptions } from '@liaoliaots/nestjs-redis';

import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { appConfiguration } from '@/config';

import { ControllerModule } from '@/controller/controller.module';
import { ServiceModule } from '@/service/service.module';
import { RepositoryModule } from '@/repository/repository.module';

@Module({
	imports: [
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
			useFactory: (config: ConfigService) => ({
				config: config.get<RedisModuleOptions['config']>('redis'),
			}),
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
	providers: [AppService],
})
export class AppModule { }
