import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ValidatePromotionDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã khuyến mãi' })
  code: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Vui lòng truyền lên giá trị đơn hàng' })
  orderValue: number;
}