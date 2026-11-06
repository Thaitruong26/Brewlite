import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/client.js';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Trạng thái chuyển tiếp tiếp theo (PAID, PREPARING, READY, COMPLETED)',
    enum: [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED],
    example: OrderStatus.PAID,
  })
  @IsIn([OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED], {
    message: 'Trạng thái chỉ có thể là PAID, PREPARING, READY hoặc COMPLETED',
  })
  status: OrderStatus;
}
