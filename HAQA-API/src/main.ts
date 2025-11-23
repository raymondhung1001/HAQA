import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filter/http-exception.filter';
import { TransformInterceptor } from './interceptor/transform.interceptor';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  
  app.useLogger(app.get(Logger));
  
  // Get instances from DI container to ensure proper dependency injection
  const httpExceptionFilter = app.get(HttpExceptionFilter);
  const transformInterceptor = app.get(TransformInterceptor);
  
  app.useGlobalFilters(httpExceptionFilter);
  app.useGlobalInterceptors(transformInterceptor);
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
