import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('Swagger Documentation & Postman Export', () => {
  it('should generate swagger openapi json and export postman collection for A1', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: async () => {},
        $disconnect: async () => {},
        $queryRaw: async () => [{ 1: 1 }],
      })
      .compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');

    const config = new DocumentBuilder()
      .setTitle('BrewLite API')
      .setDescription(
        'Tài liệu OpenAPI / Swagger cho hệ thống bán cà phê BrewLite (Assignment 1). Hỗ trợ xác thực JWT Bearer, quản lý sản phẩm, tồn kho định lượng nguyên liệu, đặt hàng, xử lý thanh toán tiền mặt & kiểm kê kho.',
      )
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

    expect(document).toBeDefined();
    expect(document.paths).toBeDefined();

    const postmanDir = path.resolve(process.cwd(), 'postman');
    if (!fs.existsSync(postmanDir)) {
      fs.mkdirSync(postmanDir, { recursive: true });
    }

    const swaggerJsonContent = JSON.stringify(document, null, 2);
    fs.writeFileSync(path.join(postmanDir, 'brewlite-api.swagger.json'), swaggerJsonContent, 'utf-8');
    console.log(`Saved OpenAPI JSON to backend/postman/`);

    const postmanCollection = generatePostmanCollection(document);
    const postmanJsonContent = JSON.stringify(postmanCollection, null, 2);
    fs.writeFileSync(path.join(postmanDir, 'BrewLite_API.postman_collection.json'), postmanJsonContent, 'utf-8');
    console.log(`Saved Postman Collection to backend/postman/`);

    const localEnv = {
      id: 'brewlite-a1-local-environment',
      name: 'BrewLite A1 Local',
      values: [
        { key: 'baseUrl', value: 'http://localhost:4000/api', enabled: true },
        { key: 'accessToken', value: '', enabled: true },
        { key: 'currentOrderId', value: '1', enabled: true },
      ],
      _postman_variable_scope: 'environment',
    };
    const prodEnv = {
      id: 'brewlite-a1-production-environment',
      name: 'BrewLite A1 Production',
      values: [
        { key: 'baseUrl', value: 'https://brewlite-api.onrender.com/api', enabled: true },
        { key: 'accessToken', value: '', enabled: true },
        { key: 'currentOrderId', value: '1', enabled: true },
      ],
      _postman_variable_scope: 'environment',
    };
    fs.writeFileSync(
      path.join(postmanDir, 'BrewLite_Local.postman_environment.json'),
      JSON.stringify(localEnv, null, 2),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(postmanDir, 'BrewLite_Production.postman_environment.json'),
      JSON.stringify(prodEnv, null, 2),
      'utf-8',
    );
    console.log(`Saved Postman Environments to backend/postman/`);

    await app.close();
  });
});

function generatePostmanCollection(openapi: any) {
  const collection: any = {
    info: {
      name: 'BrewLite A1 API - Postman Collection',
      description:
        'Bộ sưu tập 26 API chuẩn 1:1 theo Swagger UI BrewLite Assignment 1. Hỗ trợ biến môi trường baseUrl, tự động lưu JWT token khi đăng nhập và tự sinh idempotency-key.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      {
        key: 'baseUrl',
        value: 'http://localhost:4000/api',
        type: 'string',
      },
      {
        key: 'accessToken',
        value: '',
        type: 'string',
      },
    ],
    item: [],
  };

  const TAG_ORDER = [
    'Auth',
    'Products',
    'Toppings',
    'Ingredients',
    'Orders',
    'Payments',
    'Promotions',
    'Health',
    'App',
  ];

  const TAG_META: Record<string, { title: string; desc: string }> = {
    Auth: {
      title: '1. Auth',
      desc: 'Đăng ký, đăng nhập và xác thực người dùng',
    },
    Products: {
      title: '2. Products',
      desc: 'Quản lý danh mục thực đơn và công thức pha chế sản phẩm',
    },
    Toppings: {
      title: '3. Toppings',
      desc: 'Quản lý danh sách và định lượng nguyên liệu topping',
    },
    Ingredients: {
      title: '4. Ingredients',
      desc: 'Quản lý kho nguyên vật liệu, cảnh báo tồn kho và lịch sử biến động',
    },
    Orders: {
      title: '5. Orders',
      desc: 'Đặt hàng, xem danh sách và cập nhật trạng thái đơn',
    },
    Payments: {
      title: '6. Payments',
      desc: 'Thanh toán trực tiếp hỗ trợ Idempotency Key',
    },
    Promotions: {
      title: '7. Promotions',
      desc: 'Kiểm tra và áp dụng mã voucher giảm giá',
    },
    Health: {
      title: '8. Health',
      desc: 'Kiểm tra trạng thái máy chủ và kết nối CSDL (Health Check)',
    },
    App: {
      title: '9. App',
      desc: 'Kiểm tra hoạt động dịch vụ gốc (Root API)',
    },
  };

  const tagGroups: Record<string, any[]> = {};
  for (const tag of TAG_ORDER) {
    tagGroups[tag] = [];
  }

  for (const [routePath, methods] of Object.entries<any>(openapi.paths)) {
    for (const [httpMethod, op] of Object.entries<any>(methods)) {
      const tag = op.tags?.[0] || 'App';
      if (!tagGroups[tag]) {
        tagGroups[tag] = [];
      }

      let cleanPath = routePath.replace(/^\/api\//, '').replace(/^\//, '');
      const pathSegments = cleanPath.split('/').map((seg) => {
        if (seg.startsWith('{') && seg.endsWith('}')) {
          return ':' + seg.slice(1, -1);
        }
        return seg;
      });

      const urlObj: any = {
        raw: `{{baseUrl}}/${cleanPath.replace(/\{([^}]+)\}/g, ':$1')}`,
        host: ['{{baseUrl}}'],
        path: pathSegments,
        variable: [],
      };

      const pathParams = op.parameters?.filter((p: any) => p.in === 'path') || [];
      for (const p of pathParams) {
        urlObj.variable.push({
          key: p.name,
          value: p.example ? String(p.example) : '1',
          description: p.description || '',
        });
      }

      const queryParams = op.parameters?.filter((p: any) => p.in === 'query') || [];
      if (queryParams.length > 0) {
        urlObj.query = queryParams.map((q: any) => ({
          key: q.name,
          value: q.example ? String(q.example) : '',
          description: q.description || '',
          disabled: !q.required,
        }));
      }

      const headers: any[] = [
        {
          key: 'Content-Type',
          value: 'application/json',
          type: 'text',
        },
      ];

      const hasBearer = op.security && op.security.some((s: any) => 'bearer' in s);
      const authConfig: any = hasBearer
        ? {
            type: 'bearer',
            bearer: [
              {
                key: 'token',
                value: '{{accessToken}}',
                type: 'string',
              },
            ],
          }
        : {
            type: 'noauth',
          };

      if (routePath.includes('payments') || routePath.includes('orders')) {
        headers.push({
          key: 'idempotency-key',
          value: '{{$guid}}',
          type: 'text',
          description: 'Tự động tạo UUID ngẫu nhiên chống trừ tiền / tạo trùng đơn',
          disabled: httpMethod.toLowerCase() === 'get',
        });
      }

      let body: any = undefined;
      if (['post', 'put', 'patch'].includes(httpMethod.toLowerCase())) {
        let sampleBody: any = {};

        if (routePath.includes('auth/login')) {
          sampleBody = {
            username: 'customer1',
            password: 'Password123!',
          };
        } else if (routePath.includes('auth/register')) {
          sampleBody = {
            username: 'newcustomer',
            password: 'Password123!',
            fullName: 'Nguyen Van A',
            phone: '0901234567',
          };
        } else if (routePath.includes('orders') && httpMethod.toLowerCase() === 'post') {
          sampleBody = {
            orderType: 'DINE_IN',
            tableNumber: 'B01',
            items: [
              {
                productId: 1,
                sizeId: 1,
                quantity: 1,
                toppingIds: [1],
              },
            ],
            notes: 'Ít đường, nhiều đá',
          };
        } else if (routePath.includes('orders') && routePath.includes('status')) {
          sampleBody = { status: 'PREPARING' };
        } else if (routePath.includes('orders') && routePath.includes('cancel')) {
          sampleBody = { reason: 'Đổi ý không mua nữa' };
        } else if (routePath.includes('payments')) {
          sampleBody = {
            orderId: 1,
            paymentMethod: 'CASH',
            amount: 50000,
          };
        } else if (routePath.includes('promotions/validate')) {
          sampleBody = { code: 'CHAOBANMOI', orderTotal: 50000 };
        } else if (routePath.includes('ingredients') && httpMethod.toLowerCase() === 'post') {
          sampleBody = {
            name: 'Cà phê Robusta Đắk Lắk',
            unit: 'gram',
            currentStock: 1000,
            safetyStock: 200,
          };
        } else if (routePath.includes('stock')) {
          sampleBody = { quantity: 500, reason: 'Nhập kho đầu ca' };
        } else if (routePath.includes('adjust')) {
          sampleBody = { newStock: 1200, reason: 'Kiểm kê định kỳ' };
        }

        body = {
          mode: 'raw',
          raw: JSON.stringify(sampleBody, null, 2),
          options: {
            raw: {
              language: 'json',
            },
          },
        };
      }

      const events: any[] = [];
      if (routePath.includes('auth/login')) {
        events.push({
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              'const response = pm.response.json();',
              'if (response.access_token) {',
              '    pm.collectionVariables.set("accessToken", response.access_token);',
              '    pm.environment.set("accessToken", response.access_token);',
              '    console.log("Đã tự động lưu access_token vào Postman Variable!");',
              '}',
            ],
          },
        });
      }

      const fullDisplayRoute = routePath.startsWith('/') ? routePath : `/${routePath}`;
      const requestName = op.summary
        ? `${fullDisplayRoute} ${op.summary}`
        : fullDisplayRoute;

      const requestItem: any = {
        name: requestName,
        request: {
          method: httpMethod.toUpperCase(),
          auth: authConfig,
          header: headers,
          url: urlObj,
          description: op.description || op.summary || '',
        },
        response: [],
      };

      if (body) {
        requestItem.request.body = body;
      }
      if (events.length > 0) {
        requestItem.event = events;
      }

      tagGroups[tag].push(requestItem);
    }
  }

  for (const tag of TAG_ORDER) {
    const items = tagGroups[tag];
    if (items && items.length > 0) {
      const meta = TAG_META[tag] || { title: tag, desc: '' };
      collection.item.push({
        name: `${meta.title} (${meta.desc})`,
        item: items,
      });
    }
  }

  return collection;
}
