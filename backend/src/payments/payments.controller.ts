import {
  Body,
  Controller,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
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
  ) {
    return this.paymentsService.createPayment(dto, idempotencyKey, user);
  }
}