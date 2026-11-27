import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({
    description: 'Mã ngân hàng nhận hoàn tiền (VietQR)',
    example: 'MB',
  })
  @IsOptional()
  @IsString()
  refundBank?: string;

  @ApiPropertyOptional({
    description: 'Số tài khoản ngân hàng nhận hoàn tiền',
    example: '0987654321',
  })
  @IsOptional()
  @IsString()
  refundAccount?: string;

  @ApiPropertyOptional({
    description: 'Lý do hủy đơn hàng',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ConfirmRefundDto {
  @ApiPropertyOptional({
    description: 'Mã tham chiếu giao dịch hoặc mã FT VietQR từ Barista',
    example: 'FT2401928374',
  })
  @IsOptional()
  @IsString()
  refundRef?: string;
}

export class FailRefundDto {
  @ApiProperty({
    description: 'Lý do chuyển khoản hoàn tiền thất bại (vd: Sai số tài khoản, tài khoản bị khóa)',
    example: 'Tài khoản người nhận không tồn tại hoặc bị đóng',
  })
  @IsNotEmpty({ message: 'Vui lòng cung cấp lý do chuyển tiền thất bại' })
  @IsString()
  reason: string;
}

export class HoldRefundDto {
  @ApiPropertyOptional({
    description: 'Ghi chú nghi ngờ giao dịch / đối soát ngân hàng (UNKNOWN)',
    example: 'Lệnh chuyển khoản đang xử lý tại Napas, chờ đối soát ngân hàng',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RetryRefundDto {
  @ApiPropertyOptional({
    description: 'Mã ngân hàng mới nếu khách hàng muốn cập nhật lại',
    example: 'VCB',
  })
  @IsOptional()
  @IsString()
  refundBank?: string;

  @ApiPropertyOptional({
    description: 'Số tài khoản mới nếu khách hàng muốn cập nhật lại',
    example: '0123456789',
  })
  @IsOptional()
  @IsString()
  refundAccount?: string;
}

