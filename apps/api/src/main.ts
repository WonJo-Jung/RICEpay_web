
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  await app.listen(process.env.PORT || 4000);
  console.log('API on http://localhost:' + (process.env.PORT || 4000));
}
bootstrap();
