
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
import {
  ApiBearerAuth,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(
    @Req() req: Request & { user: { id: number } },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(req.user.id, dto);
  }

  @Get('me')
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    enum: [
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'COMPLETED',
      'CANCELLED',
    ],
  })
  getMyOrders(
    @Req() req: Request & { user: { id: number } },
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: string,
  ) {
    return this.ordersService.getMyOrders(
      req.user.id,
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
