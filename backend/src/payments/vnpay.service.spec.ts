import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { VnpayService } from './vnpay.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';

describe('VnpayService (P0 VNPay Security & Verification)', () => {
  let service: VnpayService;
  let prisma: any;
  let loyaltyService: any;

  const TEST_TMN = 'TESTTMN01';
  const TEST_SECRET = 'TESTSECRET1234567890ABCDEF12345';
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      VNPAY_TMN_CODE: TEST_TMN,
      VNPAY_HASH_SECRET: TEST_SECRET,
      VNPAY_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      VNPAY_RETURN_URL: 'http://localhost:3001/payment/vnpay-return',
    };

    prisma = {
      order: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      payment: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };

    loyaltyService = {
      award: vi.fn().mockResolvedValue({ success: true, points: 50 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VnpayService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoyaltyService, useValue: loyaltyService },
      ],
    }).compile();

    service = module.get<VnpayService>(VnpayService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Cấu hình và biến môi trường (P0.1 Secret Sanitization)', () => {
    it('ném BadRequestException nếu thiếu VNPAY_HASH_SECRET', async () => {
      delete process.env.VNPAY_HASH_SECRET;
      (service as any).config.hashSecret = '';

      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        total: 50000,
        status: 'PENDING',
      });

      await expect(service.createPaymentUrl(1)).rejects.toThrow(BadRequestException);
    });

    it('ném BadRequestException nếu thiếu VNPAY_TMN_CODE', async () => {
      delete process.env.VNPAY_TMN_CODE;
      (service as any).config.tmnCode = '';

      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        total: 50000,
        status: 'PENDING',
      });

      await expect(service.createPaymentUrl(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createPaymentUrl', () => {
    it('ném BadRequestException nếu đơn hàng không tồn tại', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.createPaymentUrl(999)).rejects.toThrow(BadRequestException);
    });

    it('ném BadRequestException nếu đơn hàng không ở trạng thái PENDING hoặc PAYMENT_FAILED', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        total: 50000,
        status: 'PAID',
      });

      await expect(service.createPaymentUrl(1)).rejects.toThrow(BadRequestException);
    });

    it('tạo URL thanh toán VNPay chuẩn có chữ ký HMAC-SHA512', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 10,
        total: 65000,
        status: 'PENDING',
      });

      const url = await service.createPaymentUrl(10, '192.168.1.1', 'http://localhost:3000');

      expect(url).toContain('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?');
      expect(url).toContain('vnp_TmnCode=TESTTMN01');
      expect(url).toContain('vnp_Amount=6500000'); // 65,000 * 100
      expect(url).toContain('vnp_SecureHash=');
      expect(url).toContain('vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A3000%2Fpayment%2Fvnpay-return');
    });

    it('cho phép tạo URL thanh toán cho đơn đang ở trạng thái PAYMENT_FAILED (thử lại thanh toán)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 11,
        total: 80000,
        status: 'PAYMENT_FAILED',
      });

      const url = await service.createPaymentUrl(11);
      expect(url).toContain('vnp_Amount=8000000');
    });
  });

  describe('createSimulatorUrl & generateSignedCallback (Simulator Kiểm thử)', () => {
    it('tạo Simulator URL trỏ đến route giả lập mock', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 12,
        total: 45000,
        status: 'PENDING',
      });

      const simUrl = await service.createSimulatorUrl(12);
      expect(simUrl).toContain('/payment/vnpay-sandbox-mock?');
      expect(simUrl).toContain('vnp_Amount=4500000');
      expect(simUrl).toContain('vnp_SecureHash=');
    });

    it('sinh chuỗi callback có ký HMAC-SHA512 hợp lệ', () => {
      const queryString = service.generateSignedCallback(15, '15_12345678', 5000000, '00');
      expect(queryString).toContain('vnp_ResponseCode=00');
      expect(queryString).toContain('vnp_SecureHash=');
      expect(queryString).toContain('vnp_SecureHashType=SHA512');
    });
  });

  describe('verifyReturnUrl (P0.2 Xác thực giao dịch và bảo mật toàn vẹn)', () => {
    function signParams(params: Record<string, string>, secret: string = TEST_SECRET): Record<string, string> {
      const sortedKeys = Object.keys(params).sort();
      const signData = sortedKeys
        .filter((k) => params[k] !== undefined && params[k] !== '')
        .map((k) => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
        .join('&');

      const secureHash = createHmac('sha512', secret).update(Buffer.from(signData, 'utf-8')).digest('hex');
      return { ...params, vnp_SecureHash: secureHash };
    }

    it('từ chối khi thiếu chữ ký bảo mật vnp_SecureHash (mã 99)', async () => {
      const res = await service.verifyReturnUrl({ vnp_Amount: '5000000' });
      expect(res.isSuccess).toBe(false);
      expect(res.responseCode).toBe('99');
      expect(res.message).toMatch(/Thiếu chữ ký/i);
    });

    it('từ chối khi sai mã Merchant vnp_TmnCode (mã 97)', async () => {
      const params = signParams({
        vnp_TmnCode: 'WRONG_TMN',
        vnp_TxnRef: '10_123456',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '00',
      });

      const res = await service.verifyReturnUrl(params);
      expect(res.isSuccess).toBe(false);
      expect(res.responseCode).toBe('97');
      expect(res.message).toMatch(/Mã đối tác/i);
    });

    it('từ chối khi chữ ký HMAC không hợp lệ hoặc dữ liệu bị giả mạo (mã 97)', async () => {
      const params = signParams(
        {
          vnp_TmnCode: TEST_TMN,
          vnp_TxnRef: '10_123456',
          vnp_Amount: '5000000',
          vnp_ResponseCode: '00',
        },
        'FORGED_SECRET_KEY',
      );

      const res = await service.verifyReturnUrl(params);
      expect(res.isSuccess).toBe(false);
      expect(res.responseCode).toBe('97');
      expect(res.message).toMatch(/Sai checksum/i);
    });

    it('từ chối khi đơn hàng không tồn tại trên hệ thống (mã 01)', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '9999_123456',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '00',
      });
      prisma.order.findUnique.mockResolvedValue(null);

      const res = await service.verifyReturnUrl(params);
      expect(res.isSuccess).toBe(false);
      expect(res.responseCode).toBe('01');
      expect(res.message).toMatch(/không tồn tại/i);
    });

    it('từ chối khi số tiền callback bị sai lệch so với đơn hàng (mã 04 - Chống Tampering)', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '10_123456',
        vnp_Amount: '2000000', // Khách cố ý callback 20.000đ
        vnp_ResponseCode: '00',
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 10,
        total: 50000, // Giá trị thực tế 50.000đ
        status: 'PENDING',
      });

      const res = await service.verifyReturnUrl(params);
      expect(res.isSuccess).toBe(false);
      expect(res.responseCode).toBe('04');
      expect(res.message).toMatch(/không khớp với giá trị đơn hàng/i);
    });

    it('từ chối khi đơn hàng đã bị hủy CANCELLED trước đó (mã 02)', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '10_123456',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '00',
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 10,
        total: 50000,
        status: 'CANCELLED',
      });

      const res = await service.verifyReturnUrl(params);
      expect(res.isSuccess).toBe(false);
      expect(res.responseCode).toBe('02');
      expect(res.message).toMatch(/đã bị hủy/i);
    });

    it('xử lý Idempotency: trả thành công nếu đơn đã thanh toán PAID trước đó mà không trừ tiền 2 lần', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '10_123456',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: '140001',
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 10,
        total: 50000,
        status: 'PAID',
      });

      const res = await service.verifyReturnUrl(params);
      expect(res.isSuccess).toBe(true);
      expect(res.responseCode).toBe('00');
      expect(res.message).toMatch(/đã được thanh toán thành công trước đó/i);
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(loyaltyService.award).not.toHaveBeenCalled();
    });

    it('xác thực thành công (00 + 00): chỉ xác minh và hiển thị kết quả, không ghi đè DB (DB do IPN phụ trách)', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '10_123456',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_TransactionNo: 'VNP_TRANS_999',
      });

      const mockOrder = {
        id: 10,
        userId: 1,
        total: 50000,
        status: 'PENDING',
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const res = await service.verifyReturnUrl(params);

      expect(res.isSuccess).toBe(true);
      expect(res.responseCode).toBe('00');
      expect(res.message).toMatch(/thành công/i);
      // verifyReturnUrl tách rời hoàn toàn khỏi DB mutations:
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(loyaltyService.award).not.toHaveBeenCalled();
    });

    it('từ chối khi vnp_ResponseCode là 00 nhưng vnp_TransactionStatus khác 00', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '10_123456',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '02', // Giao dịch chưa hoàn tất hoặc nghi vấn
        vnp_TransactionNo: 'VNP_TRANS_999',
      });

      const mockOrder = {
        id: 10,
        userId: 1,
        total: 50000,
        status: 'PENDING',
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const res = await service.verifyReturnUrl(params);

      expect(res.isSuccess).toBe(false);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('xử lý khi khách hàng hủy giao dịch tại cổng VNPay (ResponseCode khác 00)', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '10_123456',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '24', // Người dùng hủy giao dịch
        vnp_TransactionStatus: '24',
      });

      const mockOrder = {
        id: 10,
        userId: 1,
        total: 50000,
        status: 'PENDING',
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const res = await service.verifyReturnUrl(params);

      expect(res.isSuccess).toBe(false);
      expect(res.responseCode).toBe('24');
      // Không update DB trong verifyReturnUrl
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyIpn (IPN Webhook Server-to-Server Settlement)', () => {
    function signParams(params: Record<string, string>, secret: string = TEST_SECRET): Record<string, string> {
      const sortedKeys = Object.keys(params).sort();
      const signData = sortedKeys
        .filter((k) => params[k] !== undefined && params[k] !== '')
        .map((k) => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
        .join('&');

      const secureHash = createHmac('sha512', secret).update(Buffer.from(signData, 'utf-8')).digest('hex');
      return { ...params, vnp_SecureHash: secureHash };
    }

    it('cập nhật đơn sang PAID, tạo Payment và tích lũy điểm khi IPN hợp lệ (00 + 00)', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '10_123456',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_TransactionNo: 'VNP_IPN_999',
      });

      const mockOrder = {
        id: 10,
        userId: 1,
        total: 50000,
        status: 'PENDING',
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.update.mockResolvedValue({ ...mockOrder, status: 'PAID' });
      prisma.payment.create.mockResolvedValue({ id: 101, status: 'SUCCESS' });

      const res = await service.verifyIpn(params);

      expect(res).toEqual({ RspCode: '00', Message: 'Confirm Success' });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'PAID' },
      });
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 10,
            amount: 50000,
            method: 'CARD',
            status: 'SUCCESS',
            idempotencyKey: 'vnpay-10_123456',
            requestHash: 'vnpay-VNP_IPN_999',
          }),
        }),
      );
      expect(loyaltyService.award).toHaveBeenCalledWith(expect.anything(), mockOrder);
    });

    it('từ chối khi ResponseCode là 00 nhưng TransactionStatus khác 00 trong IPN', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '10_123456',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '02',
        vnp_TransactionNo: 'VNP_IPN_999',
      });

      const mockOrder = {
        id: 10,
        userId: 1,
        total: 50000,
        status: 'PENDING',
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const res = await service.verifyIpn(params);

      expect(res).toEqual({ RspCode: '00', Message: 'Confirm Success' });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'PAYMENT_FAILED' },
      });
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('trả về RspCode 97 khi sai chữ ký HMAC trong IPN', async () => {
      const params = signParams(
        {
          vnp_TmnCode: TEST_TMN,
          vnp_TxnRef: '10_123456',
          vnp_Amount: '5000000',
          vnp_ResponseCode: '00',
          vnp_TransactionStatus: '00',
        },
        'FORGED_SECRET',
      );

      const res = await service.verifyIpn(params);
      expect(res).toEqual({ RspCode: '97', Message: 'Invalid Checksum' });
    });

    it('trả về RspCode 04 khi sai số tiền trong IPN', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '10_123456',
        vnp_Amount: '3000000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
      });

      prisma.order.findUnique.mockResolvedValue({
        id: 10,
        total: 50000,
        status: 'PENDING',
      });

      const res = await service.verifyIpn(params);
      expect(res).toEqual({ RspCode: '04', Message: 'Invalid amount' });
    });

    it('trả về RspCode 02 khi đơn đã được xác nhận PAID trước đó (Idempotency)', async () => {
      const params = signParams({
        vnp_TmnCode: TEST_TMN,
        vnp_TxnRef: '10_123456',
        vnp_Amount: '5000000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
      });

      prisma.order.findUnique.mockResolvedValue({
        id: 10,
        total: 50000,
        status: 'PAID',
      });

      const res = await service.verifyIpn(params);
      expect(res).toEqual({ RspCode: '02', Message: 'Order already confirmed' });
    });
  });
});
