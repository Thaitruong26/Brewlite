import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentMethodInput {
  WALLET = 'WALLET',
  CARD = 'CARD',
}

export enum MockPaymentResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export class CreatePaymentDto {
  @ApiProperty({ example: 1, description: 'ID của đơn hàng cần thanh toán' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId!: number;

  @ApiProperty({
    enum: PaymentMethodInput,
    example: PaymentMethodInput.WALLET,
    description: 'Phương thức thanh toán: WALLET hoặc CARD',
  })
  @IsEnum(PaymentMethodInput)
  method!: PaymentMethodInput;

  @ApiPropertyOptional({
    enum: MockPaymentResult,
    example: MockPaymentResult.SUCCESS,
    description: 'Mô phỏng kết quả thanh toán: SUCCESS hoặc FAILED (dùng khi demo/test)',
  })
  @IsOptional()
  @IsEnum(MockPaymentResult)
  mockResult?: MockPaymentResult;
}