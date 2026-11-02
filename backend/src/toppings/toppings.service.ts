import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ToppingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lấy danh sách topping đang kích hoạt (isActive: true), sắp xếp theo id */
  async findAll() {
    return this.prisma.topping.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
      },
      orderBy: { id: 'asc' },
    });
  }
}
