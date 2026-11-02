import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ToppingsService } from './toppings.service.js';

@ApiTags('toppings')
@Controller('toppings')
export class ToppingsController {
  constructor(private readonly toppingsService: ToppingsService) {}

  /** GET /api/toppings */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách topping đang kích hoạt' })
  @ApiResponse({ status: 200, description: 'Danh sách topping thành công' })
  findAll() {
    return this.toppingsService.findAll();
  }
}
