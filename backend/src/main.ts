import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('BrewLite API')
    .setDescription('Tài liệu OpenAPI / Swagger cho hệ thống bán cà phê BrewLite (Assignment 1). Hỗ trợ xác thực JWT Bearer, quản lý sản phẩm, tồn kho định lượng nguyên liệu, đặt hàng, xử lý thanh toán tiền mặt & kiểm kê kho.')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Nhập access_token nhận được từ /api/auth/login',
    })
    .addTag('Auth', 'Đăng ký, đăng nhập và xác thực người dùng')
    .addTag('Products', 'Quản lý danh mục thực đơn và công thức pha chế sản phẩm')
    .addTag('Toppings', 'Quản lý danh sách và định lượng nguyên liệu topping')
    .addTag('Ingredients', 'Quản lý kho nguyên vật liệu, cảnh báo tồn kho và lịch sử biến động')
    .addTag('Orders', 'Đặt hàng, xem danh sách và cập nhật trạng thái đơn')
    .addTag('Payments', 'Thanh toán trực tiếp hỗ trợ Idempotency Key')
    .addTag('Promotions', 'Kiểm tra và áp dụng mã voucher giảm giá')
    .addTag('Health', 'Kiểm tra trạng thái máy chủ và kết nối cơ sở dữ liệu')
    .addTag('App', 'Kiểm tra hoạt động dịch vụ gốc')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();