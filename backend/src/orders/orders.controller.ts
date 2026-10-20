import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(
    @Body() dto: CreateOrderDto,
    @Query('userId', ParseIntPipe) userId: number,
  ) {
    return this.ordersService.createOrder(userId, dto);
  }

  @Get('me')
  getMyOrders(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: string,
  ) {
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
    @Query('userId', ParseIntPipe) userId: number,
    @Query('role') role = 'CUSTOMER',
  ) {
    return this.ordersService.getOrderById(orderId, userId, role);
  }
}