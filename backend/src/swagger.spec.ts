import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('Swagger Documentation & Postman Export', () => {
  it('should generate swagger openapi json and export postman collection', async () => {
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
        'Tài liệu OpenAPI / Swagger cho hệ thống bán cà phê BrewLite (Assignment 2). Hỗ trợ xác thực JWT Bearer, quản lý sản phẩm, tồn kho định lượng nguyên liệu, đặt hàng, xử lý thanh toán VNPay & hoàn tiền.',
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
      .addTag('Orders', 'Đặt hàng, xem danh sách, cập nhật trạng thái đơn và xử lý hoàn tiền')
      .addTag('Payments', 'Thanh toán trực tiếp, cổng thanh toán điện tử VNPay và hoàn tất giả lập')
      .addTag('Promotions', 'Kiểm tra và áp dụng mã voucher giảm giá')
      .addTag('Health', 'Kiểm tra trạng thái máy chủ và kết nối cơ sở dữ liệu')
      .addTag('App', 'Kiểm tra hoạt động dịch vụ gốc')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    expect(document).toBeDefined();
    expect(document.paths).toBeDefined();

    const paths = Object.keys(document.paths);
    expect(paths.length).toBeGreaterThan(15);

    const apiPostmanDir = path.resolve(process.cwd(), 'postman');
    if (!fs.existsSync(apiPostmanDir)) {
      fs.mkdirSync(apiPostmanDir, { recursive: true });
    }

    const swaggerJsonContent = JSON.stringify(document, null, 2);
    fs.writeFileSync(path.join(apiPostmanDir, 'brewlite-api.swagger.json'), swaggerJsonContent, 'utf-8');
    console.log(`Saved OpenAPI JSON to apps/api/postman/`);

    // Generate Full Postman Collection v2.1
    const postmanCollection = generatePostmanCollection(document, false);
    const postmanJsonContent = JSON.stringify(postmanCollection, null, 2);
    fs.writeFileSync(path.join(apiPostmanDir, 'BrewLite_API.postman_collection.json'), postmanJsonContent, 'utf-8');
    console.log(`Saved Full Postman Collection to apps/api/postman/`);

    // Generate Frontend-Only Postman Collection (Only APIs used in apps/web)
    const frontendCollection = generatePostmanCollection(document, true);
    const frontendJsonContent = JSON.stringify(frontendCollection, null, 2);
    fs.writeFileSync(path.join(apiPostmanDir, 'BrewLite_Frontend_API.postman_collection.json'), frontendJsonContent, 'utf-8');
    console.log(`Saved Frontend-Only Postman Collection to apps/api/postman/`);

    // Generate Environments with dual tokens (Customer & Barista)
    const localEnv = {
      id: 'brewlite-local-environment',
      name: 'BrewLite Local (Docker Port 4001)',
      values: [
        { key: 'baseUrl', value: 'http://localhost:4001/api', enabled: true },
        { key: 'customerToken', value: '', enabled: true },
        { key: 'baristaToken', value: '', enabled: true },
        { key: 'managerToken', value: '', enabled: true },
        { key: 'accessToken', value: '', enabled: true },
        { key: 'currentOrderId', value: '1', enabled: true },
      ],
      _postman_variable_scope: 'environment',
    };
    const prodEnv = {
      id: 'brewlite-production-environment',
      name: 'BrewLite Production (Render)',
      values: [
        { key: 'baseUrl', value: 'https://brewlite-a2-syoc.onrender.com/api', enabled: true },
        { key: 'customerToken', value: '', enabled: true },
        { key: 'baristaToken', value: '', enabled: true },
        { key: 'managerToken', value: '', enabled: true },
        { key: 'accessToken', value: '', enabled: true },
        { key: 'currentOrderId', value: '1', enabled: true },
      ],
      _postman_variable_scope: 'environment',
    };
    fs.writeFileSync(
      path.join(apiPostmanDir, 'BrewLite_Local.postman_environment.json'),
      JSON.stringify(localEnv, null, 2),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(apiPostmanDir, 'BrewLite_Production.postman_environment.json'),
      JSON.stringify(prodEnv, null, 2),
      'utf-8',
    );
    console.log(`Saved Postman Environments to apps/api/postman/`);

    await app.close();
  }, 30000);
});

const FRONTEND_ROUTES = new Set([
  'POST /api/auth/login',
  'POST /api/auth/register',
  'GET /api/auth/me',
  'GET /api/products',
  'GET /api/products/{id}',
  'GET /api/products/{id}/recipe',
  'PUT /api/products/{id}/recipe',
  'GET /api/toppings',
  'GET /api/toppings/{id}/recipe',
  'PUT /api/toppings/{id}/recipe',
  'GET /api/ingredients',
  'POST /api/ingredients',
  'PATCH /api/ingredients/{id}',
  'POST /api/ingredients/{id}/stock',
  'POST /api/ingredients/{id}/adjust',
  'GET /api/ingredients/{id}/movements',
  'POST /api/promotions/validate',
  'POST /api/orders',
  'GET /api/orders',
  'GET /api/orders/me',
  'GET /api/orders/{id}',
  'POST /api/orders/{id}/cancel',
  'PATCH /api/orders/{id}/status',
  'PATCH /api/orders/{id}/confirm-refund',
  'PATCH /api/orders/{id}/refund-points',
  'PATCH /api/orders/{id}/fail-refund',
  'PATCH /api/orders/{id}/hold-refund',
  'PATCH /api/orders/{id}/retry-refund',
  'POST /api/payments',
  'POST /api/payments/vnpay/create-url',
  'POST /api/payments/vnpay/simulate-complete',
  'GET /api/payments/vnpay/verify',
]);

function generatePostmanCollection(openapi: any, frontendOnly = false) {
  const collection: any = {
    info: {
      name: frontendOnly
        ? 'BrewLite Frontend API - Postman Collection'
        : 'BrewLite Full API - Postman Collection',
      description: frontendOnly
        ? 'Bộ sưu tập các API thực tế được gọi bởi giao diện Frontend (apps/web). Đã sửa 100% Request Body khớp DTO.'
        : 'Bộ sưu tập đầy đủ 34 API theo Swagger UI BrewLite A2.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      {
        key: 'baseUrl',
        value: 'http://localhost:4001/api',
        type: 'string',
      },
      {
        key: 'customerToken',
        value: '',
        type: 'string',
      },
      {
        key: 'baristaToken',
        value: '',
        type: 'string',
      },
      {
        key: 'managerToken',
        value: '',
        type: 'string',
      },
      {
        key: 'accessToken',
        value: '',
        type: 'string',
      },
      {
        key: 'currentOrderId',
        value: '1',
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
      desc: 'Đặt hàng, xem danh sách, cập nhật trạng thái đơn và xử lý hoàn tiền',
    },
    Payments: {
      title: '6. Payments',
      desc: 'Thanh toán trực tiếp, cổng thanh toán điện tử VNPay và hoàn tất giả lập',
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
      const fullRouteKey = `${httpMethod.toUpperCase()} ${routePath}`;
      if (frontendOnly && !FRONTEND_ROUTES.has(fullRouteKey)) {
        continue;
      }

      const tag = op.tags?.[0] || 'App';
      if (!tagGroups[tag]) {
        tagGroups[tag] = [];
      }

      // Convert Swagger route `/api/products/{id}` to Postman `{{baseUrl}}/products/:id`
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

      // Path variables
      const pathParams = op.parameters?.filter((p: any) => p.in === 'path') || [];
      for (const p of pathParams) {
        const defaultVal =
          routePath.includes('/orders/') && p.name === 'id'
            ? '{{currentOrderId}}'
            : p.example
              ? String(p.example)
              : '1';
        urlObj.variable.push({
          key: p.name,
          value: defaultVal,
          description: p.description || '',
        });
      }

      // Query params
      const queryParams = op.parameters?.filter((p: any) => p.in === 'query') || [];
      if (queryParams.length > 0) {
        urlObj.query = queryParams.map((q: any) => ({
          key: q.name,
          value: q.example ? String(q.example) : '',
          description: q.description || '',
          disabled: !q.required,
        }));
      }

      // Headers
      const headers: any[] = [
        {
          key: 'Content-Type',
          value: 'application/json',
          type: 'text',
        },
      ];

      // Native Postman Auth (Bearer lock) — 3-role token support (managerToken vs baristaToken vs customerToken)
      const methodLower = httpMethod.toLowerCase();
      const isManagerOnlyRoute =
        (routePath.includes('/recipe') && methodLower === 'put') ||
        (routePath === '/api/ingredients' && methodLower === 'post') ||
        (routePath === '/api/ingredients/{id}' && methodLower === 'patch');

      const isBaristaRoute =
        routePath.includes('/recipe') ||
        routePath.includes('/ingredients') ||
        (routePath === '/api/orders' && methodLower === 'get') ||
        routePath.includes('/status') ||
        routePath.includes('-refund') ||
        routePath.includes('refund-points');

      const hasBearer = op.security && op.security.some((s: any) => 'bearer' in s);
      const authConfig: any = hasBearer
        ? {
            type: 'bearer',
            bearer: [
              {
                key: 'token',
                value: isManagerOnlyRoute
                  ? '{{managerToken}}'
                  : isBaristaRoute
                  ? '{{baristaToken}}'
                  : '{{customerToken}}',
                type: 'string',
              },
            ],
          }
        : {
            type: 'noauth',
          };

      // Idempotency-key header if required
      if (routePath.includes('payments') || routePath.includes('orders')) {
        headers.push({
          key: 'idempotency-key',
          value: '{{$guid}}',
          type: 'text',
          description: 'Tự động tạo UUID ngẫu nhiên chống trừ tiền / tạo trùng đơn',
          disabled: httpMethod.toLowerCase() === 'get',
        });
      }

      // Request Body
      let body: any = undefined;
      if (['post', 'put', 'patch'].includes(httpMethod.toLowerCase())) {
        let sampleBody: any = {};

        if (routePath.includes('auth/login')) {
          sampleBody = {
            email: 'barista@brewlite.com',
            password: 'Barista@123',
          };
        } else if (routePath.includes('auth/register')) {
          sampleBody = {
            email: 'customer.new@brewlite.com',
            password: 'Password@123',
            fullName: 'Nguyễn Văn A',
          };
        } else if (routePath.includes('orders') && httpMethod.toLowerCase() === 'post') {
          sampleBody = {
            items: [
              {
                productId: 1,
                size: 'M',
                quantity: 1,
                toppingIds: [1],
                note: 'Ít đường, nhiều đá',
              },
            ],
            promoCode: 'BREW10',
            usePoints: false,
          };
        } else if (routePath.includes('orders') && routePath.includes('status')) {
          sampleBody = { status: 'PREPARING' };
        } else if (routePath.includes('payments/vnpay/create-url')) {
          sampleBody = { orderId: 1 };
        } else if (routePath.includes('payments/vnpay/simulate-complete')) {
          sampleBody = { orderId: 1 };
        } else if (routePath === '/api/payments' || routePath === '/payments') {
          sampleBody = {
            orderId: 1,
            method: 'WALLET',
            mockResult: 'SUCCESS',
          };
        } else if (routePath.includes('promotions/validate')) {
          sampleBody = { code: 'BREW10', orderValue: 60000 };
        } else if (routePath.includes('recipe') && httpMethod.toLowerCase() === 'put') {
          sampleBody = {
            items: [
              {
                ingredientId: 1,
                quantity: 18,
              },
            ],
          };
        } else if (routePath.includes('ingredients') && httpMethod.toLowerCase() === 'post') {
          sampleBody = {
            name: 'Sữa đặc Phương Nam',
            unit: 'G',
            stock: 1000,
            lowThreshold: 200,
          };
        } else if (routePath.includes('ingredients') && httpMethod.toLowerCase() === 'patch') {
          sampleBody = {
            name: 'Sữa đặc Phương Nam Cao Cấp',
            lowThreshold: 250,
          };
        } else if (routePath.includes('stock')) {
          sampleBody = { quantity: 500, note: 'Nhập thêm nguyên liệu tại quầy Barista' };
        } else if (routePath.includes('adjust')) {
          sampleBody = { actualStock: 1200, reason: 'Kiểm kê định kỳ cuối ngày' };
        } else if (routePath.includes('cancel')) {
          sampleBody = {
            reason: 'Khách đổi ý không muốn uống nữa',
            refundBank: 'MB',
            refundAccount: '0987654321',
          };
        } else if (routePath.includes('confirm-refund')) {
          sampleBody = { refundRef: 'FT2401928374' };
        } else if (routePath.includes('fail-refund')) {
          sampleBody = { reason: 'Tài khoản người nhận không tồn tại hoặc bị đóng' };
        } else if (routePath.includes('hold-refund')) {
          sampleBody = { note: 'Lệnh chuyển khoản đang xử lý tại Napas, chờ đối soát' };
        } else if (routePath.includes('retry-refund')) {
          sampleBody = { refundBank: 'VCB', refundAccount: '0123456789' };
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

      // Test Script for Auto-save JWT Token or Order ID
      const events: any[] = [];
      if (routePath === '/api/orders' && httpMethod.toLowerCase() === 'post') {
        events.push({
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
              'const response = pm.response.json();',
              'if (response && response.id) {',
              '    pm.collectionVariables.set("currentOrderId", String(response.id));',
              '    pm.environment.set("currentOrderId", String(response.id));',
              '    console.log("Đã tự động lưu currentOrderId =", response.id);',
              '}',
            ],
          },
        });
      }

      // Format request name matching Swagger UI: [Route Path] - [Summary]
      const fullDisplayRoute = routePath.startsWith('/') ? routePath : `/${routePath}`;
      const requestName = op.summary
        ? `${fullDisplayRoute} ${op.summary}`
        : fullDisplayRoute;

      if (routePath.includes('auth/login')) {
        // 1. Customer Login
        tagGroups[tag].push({
          name: `${fullDisplayRoute} (1. Đăng nhập Khách - Lưu customerToken)`,
          request: {
            method: 'POST',
            auth: { type: 'noauth' },
            header: headers,
            url: urlObj,
            body: {
              mode: 'raw',
              raw: JSON.stringify({ email: 'demo@brewlite.com', password: 'Demo@1234' }, null, 2),
              options: { raw: { language: 'json' } },
            },
            description: 'Đăng nhập bằng tài khoản Khách hàng và tự động lưu vào biến {{customerToken}}',
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'const response = pm.response.json();',
                  'const token = response.access_token || response.accessToken;',
                  'if (token) {',
                  '    pm.collectionVariables.set("customerToken", token);',
                  '    pm.environment.set("customerToken", token);',
                  '    console.log("Đã lưu customerToken thành công!");',
                  '}',
                ],
              },
            },
          ],
          response: [],
        });

        // 2. Barista Login
        tagGroups[tag].push({
          name: `${fullDisplayRoute} (2. Đăng nhập Barista - Lưu baristaToken)`,
          request: {
            method: 'POST',
            auth: { type: 'noauth' },
            header: headers,
            url: urlObj,
            body: {
              mode: 'raw',
              raw: JSON.stringify({ email: 'barista@brewlite.com', password: 'Barista@123' }, null, 2),
              options: { raw: { language: 'json' } },
            },
            description: 'Đăng nhập bằng tài khoản Barista và tự động lưu vào biến {{baristaToken}}',
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'const response = pm.response.json();',
                  'const token = response.access_token || response.accessToken;',
                  'if (token) {',
                  '    pm.collectionVariables.set("baristaToken", token);',
                  '    pm.environment.set("baristaToken", token);',
                  '    console.log("Đã lưu baristaToken thành công!");',
                  '}',
                ],
              },
            },
          ],
          response: [],
        });

        // 3. Manager Login
        tagGroups[tag].push({
          name: `${fullDisplayRoute} (3. Đăng nhập Manager - Lưu managerToken)`,
          request: {
            method: 'POST',
            auth: { type: 'noauth' },
            header: headers,
            url: urlObj,
            body: {
              mode: 'raw',
              raw: JSON.stringify({ email: 'manager@brewlite.com', password: 'Manager@123' }, null, 2),
              options: { raw: { language: 'json' } },
            },
            description: 'Đăng nhập bằng tài khoản Manager và tự động lưu vào biến {{managerToken}}',
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'const response = pm.response.json();',
                  'const token = response.access_token || response.accessToken;',
                  'if (token) {',
                  '    pm.collectionVariables.set("managerToken", token);',
                  '    pm.environment.set("managerToken", token);',
                  '    console.log("Đã lưu managerToken thành công!");',
                  '}',
                ],
              },
            },
          ],
          response: [],
        });
        continue;
      }

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

  // Convert tag groups into Postman folders with exact metadata
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
