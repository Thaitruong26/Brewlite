import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SIZE_SURCHARGE,
  type SizeKey,
} from '../common/pricing/pricing.constants.js';
import type { GetProductsDto } from './dto/get-products.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: GetProductsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: {
      isActive: boolean;
      name?: { contains: string; mode: 'insensitive' };
      category?: { equals: string; mode?: 'insensitive' };
    } = {
      isActive: true,
    };

    if (dto.search?.trim()) {
      where.name = {
        contains: dto.search.trim(),
        mode: 'insensitive',
      };
    }

    if (dto.category?.trim()) {
      where.category = {
        equals: dto.category.trim(),
        mode: 'insensitive',
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: items.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl,
        category: p.category,
        stock: p.stock,
        inStock: p.stock > 0,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true },
    });

    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: `Không tìm thấy sản phẩm #${id}`,
        details: [{ productId: id }],
      });
    }

    const toppings = await this.prisma.topping.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
      },
      orderBy: { id: 'asc' },
    });

    const sizes = (Object.keys(SIZE_SURCHARGE) as SizeKey[]).map((size) => ({
      size,
      surcharge: SIZE_SURCHARGE[size],
    }));

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category,
      stock: product.stock,
      inStock: product.stock > 0,
      sizes,
      toppings,
    };
  }

  async addStock(id: number, quantity: number, user: { role?: string }) {
    if (user.role !== 'BARISTA') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista mới có quyền nhập kho',
      });
    }

    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: `Không tìm thấy sản phẩm #${id}`,
      });
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        stock: { increment: quantity },
        version: { increment: 1 },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      stock: updated.stock,
      inStock: updated.stock > 0,
    };
  }
}

