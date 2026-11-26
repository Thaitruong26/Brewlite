import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  vnpUrl: string;
  returnUrl: string;
}

@Injectable()
export class VnpayService {
  private readonly logger = new Logger(VnpayService.name);

  // Cấu hình VNPay Sandbox chính thức - nạp hoàn toàn từ Environment Variables (P0.1)
  private readonly config: VnpayConfig = {
    tmnCode: process.env.VNPAY_TMN_CODE || '',
    hashSecret: process.env.VNPAY_HASH_SECRET || '',
    vnpUrl: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:3000/payment/vnpay-return',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  private getHashSecret(): string {
    const secret = this.config.hashSecret || process.env.VNPAY_HASH_SECRET;
    if (!secret) {
      throw new BadRequestException('VNPAY_HASH_SECRET chưa được thiết lập trong biến môi trường hệ thống');
    }
    return secret;
  }

  private getTmnCode(): string {
    const code = this.config.tmnCode || process.env.VNPAY_TMN_CODE;
    if (!code) {
      throw new BadRequestException('VNPAY_TMN_CODE chưa được thiết lập trong biến môi trường hệ thống');
    }
    return code;
  }

  private getVnpayDateFormat(d: Date = new Date()): string {
    const vnTime = new Date(d.getTime() + 7 * 3600 * 1000);
    const year = vnTime.getUTCFullYear();
    const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(vnTime.getUTCDate()).padStart(2, '0');
    const hours = String(vnTime.getUTCHours()).padStart(2, '0');
    const minutes = String(vnTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(vnTime.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private sortObject(obj: Record<string, any>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
        sorted[key] = encodeURIComponent(String(obj[key])).replace(/%20/g, '+');
      }
    }
    return sorted;
  }

  /**
   * Sinh URL chuyển hướng sang cổng thanh toán VNPay Sandbox
   */
  async createPaymentUrl(orderId: number, ipAddr: string = '127.0.0.1', baseUrl?: string): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException('Đơn hàng không tồn tại');
    }

    if (order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED') {
      throw new BadRequestException('Đơn hàng không ở trạng thái chờ thanh toán');
    }

    const tmnCode = this.getTmnCode();
    const hashSecret = this.getHashSecret();

    const createDate = this.getVnpayDateFormat();
    const txnRef = `${order.id}_${Date.now()}`;
    const amount = order.total * 100; // VNPay tính theo đơn vị hào (nhân 100)
    const returnUrl = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/payment/vnpay-return` : this.config.returnUrl;

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toan don hang ${order.id} BrewLite`,
      vnp_OrderType: 'other',
      vnp_Amount: String(amount),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: (ipAddr.split(',')[0] || '127.0.0.1').trim().includes(':') ? '127.0.0.1' : (ipAddr.split(',')[0] || '127.0.0.1').trim(),
      vnp_CreateDate: createDate,
    };

    const sortedParams = this.sortObject(vnpParams);
    const signData = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const hmac = createHmac('sha512', hashSecret);
    const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const paymentUrl = `${this.config.vnpUrl}?${signData}&vnp_SecureHash=${secureHash}`;
    this.logger.log(`Tạo URL thanh toán VNPay cho đơn #${order.id}: ${paymentUrl}`);

    return paymentUrl;
  }

  /**
   * Sinh URL cho cổng giả lập VNPay Sandbox Mock Simulator
   * Dùng cho demo hoặc kiểm thử khi chưa kết nối cổng ngân hàng ngoài
   */
  async createSimulatorUrl(orderId: number): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException('Đơn hàng không tồn tại');
    }

    const tmnCode = this.getTmnCode();
    const hashSecret = this.getHashSecret();

    const createDate = this.getVnpayDateFormat();
    const txnRef = `${order.id}_${Date.now()}`;
    const amount = order.total * 100;

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toan don hang ${order.id} BrewLite`,
      vnp_OrderType: 'other',
      vnp_Amount: String(amount),
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_CreateDate: createDate,
    };

    const sortedParams = this.sortObject(vnpParams);
    const signData = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const hmac = createHmac('sha512', hashSecret);
    const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return `/payment/vnpay-sandbox-mock?${signData}&vnp_SecureHash=${secureHash}`;
  }

  /**
   * Tạo query callback thành công có ký HMAC-SHA512 hợp lệ từ Simulator
   */
  generateSignedCallback(
    orderId: number,
    txnRef: string,
    amount: number,
    responseCode: string = '00',
  ): string {
    const tmnCode = this.getTmnCode();
    const hashSecret = this.getHashSecret();

    const payDate = this.getVnpayDateFormat();
    const transactionNo = `SIM_${Date.now()}`;
    const vnpParams: Record<string, string> = {
      vnp_Amount: String(amount),
      vnp_BankCode: 'NCB',
      vnp_BankTranNo: `VNP${Date.now()}`,
      vnp_CardType: 'ATM',
      vnp_OrderInfo: `Thanh toan don hang ${orderId} BrewLite`,
      vnp_PayDate: payDate,
      vnp_ResponseCode: responseCode,
      vnp_TmnCode: tmnCode,
      vnp_TransactionNo: transactionNo,
      vnp_TransactionStatus: responseCode,
      vnp_TxnRef: txnRef,
    };

    const sortedParams = this.sortObject(vnpParams);
    const signData = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const hmac = createHmac('sha512', hashSecret);
    const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return `${signData}&vnp_SecureHashType=SHA512&vnp_SecureHash=${secureHash}`;
  }

  /**
   * Xác thực kết quả trả về từ VNPay (Return URL / IPN)
   * Tuân thủ P0.1 & P0.2: kiểm tra chữ ký HMAC, so sánh số tiền callback với đơn,
   * kiểm tra mã đối tác tmnCode, và chỉ cho phép chuyển từ PENDING/PAYMENT_FAILED sang PAID.
   */
  async verifyReturnUrl(query: Record<string, string>): Promise<{
    isSuccess: boolean;
    orderId: number;
    amount: number;
    responseCode: string;
    message: string;
    transactionNo?: string;
  }> {
    const secureHash = query['vnp_SecureHash'];
    if (!secureHash) {
      return {
        isSuccess: false,
        orderId: 0,
        amount: 0,
        responseCode: '99',
        message: 'Thiếu chữ ký bảo mật VNPay (vnp_SecureHash)',
      };
    }

    const tmnCode = this.getTmnCode();
    const hashSecret = this.getHashSecret();

    // 1. Kiểm tra đối tác (Merchant TMN Code)
    if (query['vnp_TmnCode'] && query['vnp_TmnCode'] !== tmnCode) {
      this.logger.error(`Sai mã merchant VNPay: nhận được ${query['vnp_TmnCode']}, cấu hình là ${tmnCode}`);
      return {
        isSuccess: false,
        orderId: 0,
        amount: 0,
        responseCode: '97',
        message: 'Mã đối tác (vnp_TmnCode) không hợp lệ',
      };
    }

    // 2. Kiểm tra chữ ký HMAC-SHA512
    const cleanQuery: Record<string, string> = { ...query };
    delete cleanQuery['vnp_SecureHash'];
    delete cleanQuery['vnp_SecureHashType'];

    const sortedParams = this.sortObject(cleanQuery);
    const signData = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const hmac = createHmac('sha512', hashSecret);
    const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (calculatedHash.toLowerCase() !== secureHash.toLowerCase()) {
      this.logger.error('Chữ ký VNPay không khớp!');
      return {
        isSuccess: false,
        orderId: 0,
        amount: 0,
        responseCode: '97',
        message: 'Chữ ký VNPay không hợp lệ (Sai checksum)',
      };
    }

    const txnRef = query['vnp_TxnRef'] || '';
    const orderId = parseInt(txnRef.split('_')[0], 10);
    const responseCode = query['vnp_ResponseCode'] || '';
    const amount = parseInt(query['vnp_Amount'] || '0', 10) / 100;
    const transactionNo = query['vnp_TransactionNo'];

    if (isNaN(orderId) || orderId <= 0) {
      return {
        isSuccess: false,
        orderId: 0,
        amount,
        responseCode,
        message: 'Mã đơn hàng không hợp lệ',
      };
    }

    // 3. Tìm đơn hàng trên hệ thống
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order) {
      return {
        isSuccess: false,
        orderId,
        amount,
        responseCode: '01',
        message: 'Đơn hàng không tồn tại trên hệ thống',
      };
    }

    // 4. Kiểm tra số tiền callback so với giá trị đơn (Chống Tampering số tiền)
    if (Math.round(amount) !== Math.round(order.total)) {
      this.logger.error(`Số tiền thanh toán ${amount} không khớp với đơn hàng #${order.id} (${order.total})`);
      return {
        isSuccess: false,
        orderId,
        amount,
        responseCode: '04',
        message: 'Số tiền thanh toán không khớp với giá trị đơn hàng',
      };
    }

    // 5. Kiểm tra trạng thái đơn: Nếu đã bị hủy thì từ chối nhận tiền
    if (order.status === 'CANCELLED') {
      this.logger.warn(`Đơn hàng #${order.id} đã bị hủy trước đó, từ chối cập nhật thanh toán`);
      return {
        isSuccess: false,
        orderId,
        amount,
        responseCode: '02',
        message: 'Đơn hàng đã bị hủy trước đó',
      };
    }

    // Nếu đơn hàng đã hoàn tất thanh toán trước đó (Xử lý Idempotency)
    if (order.status === 'PAID' || order.status === 'PREPARING' || order.status === 'READY' || order.status === 'COMPLETED') {
      return {
        isSuccess: true,
        orderId,
        amount,
        responseCode: '00',
        transactionNo,
        message: 'Đơn hàng đã được thanh toán thành công trước đó',
      };
    }

    // Chỉ cho phép chuyển trạng thái sang PAID nếu đang ở PENDING hoặc PAYMENT_FAILED
    if (order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED') {
      return {
        isSuccess: false,
        orderId,
        amount,
        responseCode: '02',
        message: `Trạng thái đơn hàng không hợp lệ để thanh toán (${String(order.status)})`,
      };
    }

    const isSuccess =
      query['vnp_ResponseCode'] === '00' &&
      query['vnp_TransactionStatus'] === '00';

    if (isSuccess) {
      return {
        isSuccess: true,
        orderId,
        amount,
        responseCode,
        transactionNo,
        message: 'Thanh toán VNPay thành công',
      };
    }

    return {
      isSuccess: false,
      orderId,
      amount,
      responseCode,
      transactionNo,
      message:
        responseCode === '24'
          ? 'Khách hàng đã hủy giao dịch trên cổng VNPay'
          : 'Thanh toán VNPay không thành công',
    };
  }

  /**
   * Xử lý IPN từ Server VNPay theo chuẩn tài liệu chính thức của VNPay
   * Trả về JSON: { RspCode: '00', Message: 'Confirm Success' }
   * Mã RspCode chuẩn:
   *  - 00: Giao dịch thành công
   *  - 01: Đơn hàng không tìm thấy (Order not found)
   *  - 02: Đơn hàng đã được xác nhận trước đó (Order already confirmed)
   *  - 04: Số tiền không hợp lệ (Invalid amount)
   *  - 97: Chữ ký không hợp lệ (Invalid Checksum)
   *  - 99: Lỗi không xác định
   */
  async verifyIpn(query: Record<string, string>): Promise<{ RspCode: string; Message: string }> {
    const secureHash = query['vnp_SecureHash'];
    if (!secureHash) {
      return { RspCode: '99', Message: 'Missing Checksum' };
    }

    const tmnCode = this.getTmnCode();
    const hashSecret = this.getHashSecret();

    // 1. Kiểm tra đối tác
    if (query['vnp_TmnCode'] && query['vnp_TmnCode'] !== tmnCode) {
      this.logger.error(`Sai mã merchant VNPay trong IPN: ${query['vnp_TmnCode']}`);
      return { RspCode: '97', Message: 'Invalid Merchant' };
    }

    // 2. Kiểm tra chữ ký HMAC
    const cleanQuery: Record<string, string> = { ...query };
    delete cleanQuery['vnp_SecureHash'];
    delete cleanQuery['vnp_SecureHashType'];

    const sortedParams = this.sortObject(cleanQuery);
    const signData = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const hmac = createHmac('sha512', hashSecret);
    const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (calculatedHash.toLowerCase() !== secureHash.toLowerCase()) {
      this.logger.error('Chữ ký IPN VNPay không khớp!');
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    const txnRef = query['vnp_TxnRef'] || '';
    const orderId = parseInt(txnRef.split('_')[0], 10);
    const responseCode = query['vnp_ResponseCode'] || '';
    const amount = parseInt(query['vnp_Amount'] || '0', 10) / 100;
    const transactionNo = query['vnp_TransactionNo'];

    if (isNaN(orderId) || orderId <= 0) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    // 3. Tìm đơn hàng
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });

    if (!order) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    // 4. Kiểm tra số tiền
    if (Math.round(amount) !== Math.round(order.total)) {
      this.logger.error(`Số tiền IPN ${amount} không khớp đơn #${order.id} (${order.total})`);
      return { RspCode: '04', Message: 'Invalid amount' };
    }

    // 5. Kiểm tra trạng thái đơn (Idempotency)
    if (
      order.status === 'PAID' ||
      order.status === 'PREPARING' ||
      order.status === 'READY' ||
      order.status === 'COMPLETED'
    ) {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    if (order.status === 'CANCELLED') {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    const isSuccess =
      query['vnp_ResponseCode'] === '00' &&
      query['vnp_TransactionStatus'] === '00';

    if (isSuccess) {
      await this.prisma.$transaction(async (tx) => {
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!currentOrder || currentOrder.status === 'CANCELLED') {
          return;
        }

        if (currentOrder.status === 'PENDING' || currentOrder.status === 'PAYMENT_FAILED') {
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'PAID' },
          });

          await tx.payment.create({
            data: {
              orderId,
              amount: currentOrder.total,
              method: 'CARD',
              status: 'SUCCESS',
              idempotencyKey: `vnpay-${txnRef}`,
              requestHash: `vnpay-${transactionNo || txnRef}`,
              responseSnapshot: {
                provider: 'VNPAY',
                transactionNo,
                bankCode: query['vnp_BankCode'],
                cardType: query['vnp_CardType'],
                payDate: query['vnp_PayDate'],
              },
            },
          });

          try {
            await this.loyaltyService.award(tx, currentOrder);
          } catch {}
        }
      });

      return { RspCode: '00', Message: 'Confirm Success' };
    }

    // Nếu thanh toán thất bại
    if (order.status === 'PENDING') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAYMENT_FAILED' },
      }).catch(() => {});
    }

    return { RspCode: '00', Message: 'Confirm Success' };
  }
}
