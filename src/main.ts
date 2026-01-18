import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express'; // ✅ AGREGAR
import { join } from 'path'; // ✅ AGREGAR
import { AppModule } from './app.module';

function getCorsOrigins() {
  const raw = process.env.CORS_ORIGINS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  // ✅ CAMBIAR: Agregar tipo NestExpressApplication
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const origins = getCorsOrigins();

  // Prefijo global para rutas API
  app.setGlobalPrefix('api');

  // ✅ AGREGAR: Servir archivos estáticos ANTES del prefijo global
  // Los archivos estáticos NO tendrán el prefijo 'api'
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (origins.includes(origin)) return callback(null, true);

      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(3000);

  console.log('Server running on http://localhost:3000');
}
bootstrap();
