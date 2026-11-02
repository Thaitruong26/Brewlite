import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { OrderStatus } from '../src/generated/prisma/client.js';
import { assertTransition } from '../src/orders/order-state.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PaymentMethodInput } from '../src/payments/dto/create-payment.dto.js';

describe('BrewLite E2E Integration Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let customerToken: string;

  // In-memory mock DB store to guarantee deterministic E2E test runs
  const mockPayments = new Map<string, any>();
  const mockPromoCodes = new Map<string, any>([
    [
      'BREW10',
      {
        id: 1,
        code: 'BREW10',
        type: 'PERCENT',
        value: 10,
        minOrderValue: 50000,
        maxDiscount: 30000,
        startsAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() + 86400000),
        usageLimit: 100,
        usedCount: 0,
        isActive: true,
      },
    ],
  ]);

  const mockPrisma = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        email: 'customer@brewlite.vn',
        role: 'CUSTOMER',
      }),
      update: vi.fn().mockResolvedValue({ id: 1 }),
    },
    payment: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.idempotencyKey) {
          return mockPayments.get(where.idempotencyKey) || null;
        }
        if (where.id) {
          return Array.from(mockPayments.values()).find((p) => p.id === where.id) || null;
        }
        return null;
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => {
        const id = mockPayments.size + 1;
        const record = { ...data, id, createdAt: new Date() };
        if (data.idempotencyKey) {
          mockPayments.set(data.idempotencyKey, record);
        }
        return record;
      }),
      update: vi.fn().mockImplementation(({ data, where }) => {
        const existing =
          (where.id ? Array.from(mockPayments.values()).find((p) => p.id === where.id) : null) ||
          (where.idempotencyKey ? mockPayments.get(where.idempotencyKey) : null) ||
          {};
        const updated = { ...existing, ...data };
        if (existing.idempotencyKey) {
          mockPayments.set(existing.idempotencyKey, updated);
        }
        return updated;
      }),
    },
    order: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === 999) return null;
        return {
          id: where.id,
          userId: 1,
          status: 'PENDING',
          total: 50000,
          finalAmount: 50000,
          createdAt: new Date(),
        };
      }),
      update: vi.fn().mockResolvedValue({ id: 1, status: 'PAID' }),
    },
    promoCode: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return mockPromoCodes.get(where.code) || null;
      }),
      update: vi.fn(),
    },
    loyaltyTransaction: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      return callback(mockPrisma);
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    jwtService = app.get(JwtService);
    customerToken = jwtService.sign({ sub: 1, email: 'customer@brewlite.vn', role: 'CUSTOMER' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. API Health & Gateway Prefix', () => {
    it('GET /api/health returns 200 OK', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });

    it('GET / without prefix returns 404 (enforces /api prefix)', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.status).toBe(404);
    });
  });

  describe('2. Criteria (a): State Machine (Sơ đồ 9.1 Compliance)', () => {
    it('Blocks direct transition PAID -> READY (must go through PREPARING first)', () => {
      expect(() => assertTransition(OrderStatus.PAID, OrderStatus.READY)).toThrowError();
    });

    it('Allows valid lifecycle PAID -> PREPARING -> READY -> COMPLETED', () => {
      expect(() => assertTransition(OrderStatus.PAID, OrderStatus.PREPARING)).not.toThrow();
      expect(() => assertTransition(OrderStatus.PREPARING, OrderStatus.READY)).not.toThrow();
      expect(() => assertTransition(OrderStatus.READY, OrderStatus.COMPLETED)).not.toThrow();
    });

    it('Allows retry on PAYMENT_FAILED: PAYMENT_FAILED -> PAID & PAYMENT_FAILED -> CANCELLED', () => {
      expect(() => assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PAID)).not.toThrow();
      expect(() => assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED)).not.toThrow();
      expect(() => assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PENDING)).not.toThrow();
    });
  });

  describe('3. Criteria (b): Idempotency & Error Code Compliance (api.md)', () => {
    it('POST /api/payments requires Idempotency-Key header', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: 1, method: PaymentMethodInput.WALLET });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Idempotency-Key/i);
    });

    it('First payment succeeds and creates payment record', async () => {
      const idemKey = 'idem-order-1-' + Date.now();
      const res = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', idemKey)
        .send({ orderId: 1, method: PaymentMethodInput.WALLET });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('status', 'SUCCESS');
    });

    it('Reusing Idempotency-Key with identical body returns snapshot (Idempotent replay)', async () => {
      const idemKey = 'idem-replay-' + Date.now();
      const payload = { orderId: 1, method: PaymentMethodInput.WALLET };

      // Call 1
      const res1 = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', idemKey)
        .send(payload);
      expect(res1.status).toBe(201);

      // Call 2 with identical key and payload
      const res2 = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', idemKey)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.body).toEqual(res1.body);
    });

    it('Reusing Idempotency-Key with different body returns HTTP 422 IDEMPOTENCY_KEY_REUSED', async () => {
      const idemKey = 'idem-conflict-' + Date.now();

      // Call 1
      const res1 = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', idemKey)
        .send({ orderId: 1, method: PaymentMethodInput.WALLET });
      expect(res1.status).toBe(201);

      // Call 2 with same key but DIFFERENT method -> must reject with 422
      const res2 = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', idemKey)
        .send({ orderId: 1, method: PaymentMethodInput.CARD });

      expect(res2.status).toBe(422);
      expect(res2.body).toMatchObject({
        code: 'IDEMPOTENCY_KEY_REUSED',
      });
    });
  });

  describe('4. Criteria (c): Promotions & Business Errors (api.md 422 Codes)', () => {
    it('POST /api/promotions/validate with non-existent code returns HTTP 422 PROMO_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/promotions/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: 'INVALID_CODE_9999', orderValue: 100000 });

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({
        code: 'PROMO_NOT_FOUND',
      });
    });

    it('POST /api/promotions/validate with valid code returns 201 with discount calculation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/promotions/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: 'BREW10', orderValue: 100000 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('discountAmount', 10000);
    });
  });
});
