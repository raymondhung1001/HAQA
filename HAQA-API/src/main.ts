import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filter/http-exception.filter';
import { TransformInterceptor } from './interceptor/transform.interceptor';
import { LoggingInterceptor } from './interceptor/logging.interceptor';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  
  app.useLogger(logger);
  
  // Configure Helmet for security headers
  const helmetConfig = configService.get('security.helmet') || {};
  app.use(helmet(helmetConfig));
  
  // Configure cookie parser (required for CSRF)
  app.use(cookieParser());
  
  // Configure CORS with security settings
  const corsConfig = configService.get('security.cors') || {};
  app.enableCors(corsConfig);
  
  // Set global prefix (optional, but recommended for API versioning)
  const globalPrefix = configService.get<string>('app.globalPrefix', 'api');
  app.setGlobalPrefix(globalPrefix);
  
  // Get instances from DI container to ensure proper dependency injection
  const httpExceptionFilter = app.get(HttpExceptionFilter);
  const transformInterceptor = app.get(TransformInterceptor);
  const loggingInterceptor = app.get(LoggingInterceptor);
  
  app.useGlobalFilters(httpExceptionFilter);
  app.useGlobalInterceptors(transformInterceptor, loggingInterceptor);
  
  const port = configService.get<number>('app.port') || process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`Application is running on: http://localhost:${port}/${globalPrefix}`);
}
bootstrap();
