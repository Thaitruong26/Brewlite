import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PaymentsService } from './payments.service.js';
import { VnpayService } from './vnpay.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly vnpayService: VnpayService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Thanh toán đơn hàng (hỗ trợ Idempotency)' })
  @ApiHeader({
    name: 'idempotency-key',
    description: 'UUID v4 do client sinh để chống trừ tiền 2 lần',
    required: true,
  })
  createPayment(
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.paymentsService.createPayment(dto, idempotencyKey, user, res);
  }

  @Post('vnpay/create-url')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tạo URL thanh toán VNPay Sandbox (ADR-004)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orderId: { type: 'number', example: 10, description: 'ID của đơn hàng cần thanh toán' },
      },
      required: ['orderId'],
    },
  })
  async createVnpayUrl(
    @Body('orderId') orderId: number,
    @Req() req: Request,
  ) {
    const ipAddr =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    let origin = (req.headers['origin'] as string) || undefined;
    if (!origin && req.headers['referer']) {
      try {
        origin = new URL(req.headers['referer'] as string).origin;
      } catch {}
    }
    const paymentUrl = await this.vnpayService.createPaymentUrl(orderId, ipAddr, origin);
    const simulatorUrl = await this.vnpayService.createSimulatorUrl(orderId);
    return { paymentUrl, simulatorUrl };
  }

  @Post('vnpay/simulate-complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tạo query callback ký HMAC-SHA512 từ Simulator (Chỉ dành cho môi trường thử nghiệm)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orderId: { type: 'number', example: 10 },
        txnRef: { type: 'string', example: '10_1700000000' },
        amount: { type: 'number', example: 5000000 },
        responseCode: { type: 'string', example: '00', default: '00' },
      },
      required: ['orderId', 'txnRef', 'amount'],
    },
  })
  simulateComplete(
    @Body('orderId') orderId: number,
    @Body('txnRef') txnRef: string,
    @Body('amount') amount: number,
    @Body('responseCode') responseCode: string = '00',
  ) {
    const isExplicitlyDisabled = process.env.ALLOW_VNPAY_SIMULATOR === 'false';
    const isProdWithoutExplicitAllow =
      process.env.NODE_ENV === 'production' && process.env.ALLOW_VNPAY_SIMULATOR !== 'true';

    if (isExplicitlyDisabled || isProdWithoutExplicitAllow) {
      throw new ForbiddenException('VNPay Simulator chỉ khả dụng trong môi trường thử nghiệm/demo');
    }
    const query = this.vnpayService.generateSignedCallback(
      orderId,
      txnRef,
      amount,
      responseCode,
    );
    return { query };
  }

  @Get('vnpay/verify')
  @ApiOperation({ summary: 'Xác thực kết quả thanh toán từ VNPay (Return URL hiển thị kết quả cho khách)' })
  async verifyVnpay(@Query() query: Record<string, string>) {
    return this.vnpayService.verifyReturnUrl(query);
  }

  @Get('vnpay/ipn')
  @ApiOperation({ summary: 'Xử lý IPN từ server VNPay (Server-to-Server webhook)' })
  async vnpayIpn(@Query() query: Record<string, string>) {
    return this.vnpayService.verifyIpn(query);
  }
}
