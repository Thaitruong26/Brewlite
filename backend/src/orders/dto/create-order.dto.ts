import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

enum OrderItemSize {
  S = 'S',
  M = 'M',
  L = 'L',
}

export class CreateOrderItemDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsEnum(OrderItemSize)
  size!: OrderItemSize;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  @Min(1, { each: true })
  toppingIds?: number[];

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}


export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  promoCode?: string;
}
