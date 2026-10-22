
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrdersService } from './orders.service.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(@Req() req: Request, @Body() dto: CreateOrderDto) {
    const userId = (req as Request & { user: { id: number } }).user.id;
    return this.ordersService.createOrder(userId, dto);
  }

  @Get('me')
  getMyOrders(
    @Req() req: Request & { user: { id: number } },
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: string,
  ) {
    const userId = req.user.id;
    return this.ordersService.getMyOrders(
      userId,
      Number(page),
      Number(limit),
      status,
    );
  }

  @Get(':id')
  getOrderById(
    @Param('id', ParseIntPipe) orderId: number,
    @Req() req: Request & { user: { id: number; role?: string } },
  ) {
    return this.ordersService.getOrderById(
      orderId,
      req.user.id,
      req.user.role ?? 'CUSTOMER',
    );
  }
}
