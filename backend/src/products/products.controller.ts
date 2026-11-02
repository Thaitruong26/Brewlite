import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProductsService } from './products.service.js';
import { GetProductsDto } from './dto/get-products.dto.js';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** GET /api/products */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách sản phẩm (menu), hỗ trợ tìm kiếm, lọc theo danh mục và phân trang' })
  @ApiResponse({ status: 200, description: 'Danh sách sản phẩm kèm thông tin phân trang' })
  @ApiResponse({ status: 400, description: 'Tham số truy vấn không hợp lệ' })
  findAll(@Query() query: GetProductsDto) {
    return this.productsService.findAll(query);
  }

  /** GET /api/products/:id */
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một sản phẩm kèm danh sách kích thước (sizes) và toppings' })
  @ApiParam({ name: 'id', description: 'ID của sản phẩm', type: Number, example: 3 })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết sản phẩm' })
  @ApiResponse({ status: 400, description: 'ID không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sản phẩm hoặc sản phẩm đã ngừng bán' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }
}
