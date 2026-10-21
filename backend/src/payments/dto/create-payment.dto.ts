import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export enum PaymentMethodInput {
  WALLET = 'WALLET',
  CARD = 'CARD',
}

export enum MockPaymentResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export class CreatePaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId!: number;

  @IsEnum(PaymentMethodInput)
  method!: PaymentMethodInput;

  @IsOptional()
  @IsEnum(MockPaymentResult)
  mockResult?: MockPaymentResult;
}