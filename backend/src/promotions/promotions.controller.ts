import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service.js';
import { ValidatePromotionDto } from './dto/validate-promotion.dto.js';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Kiểm tra mã khuyến mãi và tính tiền giảm' })
  validate(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validate(dto);
  }
}