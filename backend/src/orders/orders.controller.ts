import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrdersService, CreateOrderDto } from './orders.service.js';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateOrderDto) {
    // Nhờ JwtAuthGuard, hệ thống tự động giải mã token và lấy được thông tin user đang đăng nhập
    const userId = req.user.id; 
    return this.ordersService.createOrder(userId, dto);
  }
}