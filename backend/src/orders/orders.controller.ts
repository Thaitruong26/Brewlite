import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { OrdersService } from './orders.service.js';
import type { UserContext } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { CancelOrderDto, ConfirmRefundDto, FailRefundDto, HoldRefundDto, RetryRefundDto } from './dto/cancel-order.dto.js';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Chức năng: Tạo đơn hàng mới. Cách hoạt động: Lấy user.id từ JWT, nhận CreateOrderDto và gọi OrdersService.createOrder().
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo đơn hàng mới (Task 6, 10)',
    description:
      'Tạo đơn ở trạng thái PENDING, server tự tính giá bằng PricingService, giữ hàng bằng optimistic locking (Product.version).',
  })
  @ApiResponse({ status: 201, description: 'Tạo đơn thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Sản phẩm không tồn tại' })
  @ApiResponse({ status: 409, description: 'Hết hàng (OUT_OF_STOCK) hoặc xung đột tồn kho (STOCK_CONFLICT)' })
  @ApiResponse({ status: 422, description: 'Lỗi mã khuyến mãi' })
  async createOrder(@CurrentUser() user: UserContext, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.id, dto);
  }

  // Chức năng: Lấy dữ liệu BaristaOrders. Cách hoạt động: Truy vấn dữ liệu và trả về kết quả đã định dạng.
  @Get()
  @ApiOperation({
    summary: 'Hàng đợi đơn của quán (Mở rộng Barista - Mục 6.15)',
    description: 'Chỉ nhân viên Barista mới có quyền xem hàng đợi đơn hàng của quán.',
  })
  @ApiResponse({ status: 200, description: 'Lấy hàng đợi đơn thành công' })
  @ApiResponse({ status: 403, description: 'Chỉ nhân viên Barista mới có quyền' })
  async getBaristaOrders(
    @CurrentUser() user: UserContext,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.getBaristaOrders({ status, page, limit }, user);
  }

  // Chức năng: Lấy dữ liệu OrdersMe. Cách hoạt động: Truy vấn dữ liệu và trả về kết quả đã định dạng.
  @Get('me')
  @ApiOperation({
    summary: 'Lịch sử đơn hàng của tôi (Task 9)',
    description: 'Chỉ trả danh sách đơn của người dùng hiện tại, sắp xếp mới nhất trước, có phân trang.',
  })
  @ApiResponse({ status: 200, description: 'Lấy lịch sử đơn thành công' })
  async getOrdersMe(
    @CurrentUser() user: UserContext,
    @Query() query: GetOrdersQueryDto,
  ) {
    return this.ordersService.getOrdersMe(user.id, query);
  }

  // Chức năng: Xem chi tiết 1 đơn hàng. Cách hoạt động: Kiểm tra quyền sở hữu (chủ đơn hoặc Barista) và trả về chi tiết món, thanh toán, hoàn tiền.
  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết đơn hàng (Task 9)',
    description: 'Chi tiết đơn hàng kèm danh sách món, lịch sử thanh toán và điểm thưởng tích lũy.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết đơn thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xem đơn hàng của người khác' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn hàng' })
  async getOrderById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.getOrderById(id, user);
  }

  // Chức năng: Hủy đơn hàng (và yêu cầu hoàn tiền VietQR nếu đã PAID). Cách hoạt động: Gọi OrdersService.cancelOrder() kèm thông tin ngân hàng nhận hoàn tiền.
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hủy đơn hàng (Task 10 & Quy trình hoàn tiền VietQR)',
    description: 'Chủ đơn hoặc barista hủy đơn: hoàn lại tồn kho, hoàn usedCount mã giảm giá, thu hồi điểm thưởng. Ghi nhận tài khoản ngân hàng để Barista hoàn tiền VietQR.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({ status: 200, description: 'Hủy đơn thành công' })
  @ApiResponse({ status: 409, description: 'Chuyển trạng thái sai (INVALID_TRANSITION) hoặc đang thanh toán (PAYMENT_IN_PROGRESS)' })
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.cancelOrder(id, user, dto);
  }

  // Chức năng: Barista xác nhận đã chuyển khoản hoàn tiền VietQR thành công. Cách hoạt động: Lưu mã tham chiếu refundRef, đánh dấu refundStatus = COMPLETED.
  @Patch(':id/confirm-refund')
  @ApiOperation({
    summary: 'Barista xác nhận đã chuyển khoản hoàn tiền VietQR cho khách',
    description: 'Chỉ nhân viên Barista mới có quyền xác nhận đã hoàn tất giao dịch chuyển tiền VietQR cho đơn hủy.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({ status: 200, description: 'Xác nhận hoàn tiền thành công' })
  @ApiResponse({ status: 403, description: 'Chỉ nhân viên Barista mới có quyền' })
  async confirmRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmRefundDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.confirmRefund(id, user, dto);
  }

  // Chức năng: Barista/Manager hoàn tiền cho đơn hủy bằng cách cộng điểm thưởng (1 điểm = 10đ). Cách hoạt động: Gọi OrdersService.refundPoints(id, user).
  @Patch(':id/refund-points')
  @ApiOperation({
    summary: 'Hoàn tiền đơn hủy bằng điểm thưởng cho khách hàng (Barista/Manager)',
    description: 'Quy đổi tổng tiền đơn đã thanh toán thành điểm thưởng (1 điểm = 10đ) và cộng trực tiếp vào tài khoản khách.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({ status: 200, description: 'Hoàn điểm thành công' })
  @ApiResponse({ status: 403, description: 'Chỉ Barista hoặc Manager có quyền' })
  async refundPoints(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.refundPoints(id, user);
  }

  // Chức năng: Barista báo chuyển khoản hoàn tiền thất bại. Cách hoạt động: Lưu lý do lỗi và chuyển refundStatus = FAILED.
  @Patch(':id/fail-refund')
  @ApiOperation({
    summary: 'Barista báo chuyển khoản hoàn tiền thất bại (lỗi STK, tài khoản khóa)',
    description: 'Đánh dấu quy trình hoàn tiền thất bại với lý do cụ thể, chuyển sang FAILED để xử lý lại.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({ status: 200, description: 'Cập nhật thất bại thành công' })
  @ApiResponse({ status: 403, description: 'Chỉ nhân viên Barista mới có quyền' })
  async failRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FailRefundDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.failRefund(id, user, dto);
  }

  // Chức năng: Đưa giao dịch hoàn tiền vào trạng thái đối soát nghi ngờ. Cách hoạt động: Chuyển refundStatus = UNKNOWN, tạm khóa chuyển lại để tránh mất tiền 2 lần.
  @Patch(':id/hold-refund')
  @ApiOperation({
    summary: 'Chuyển hoàn tiền sang trạng thái đối soát nghi ngờ (UNKNOWN)',
    description: 'Treo giao dịch hoàn tiền khi trạng thái ngân hàng chưa rõ ràng để đối soát trước khi hoàn tất.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({ status: 200, description: 'Chuyển sang đối soát thành công' })
  @ApiResponse({ status: 403, description: 'Chỉ nhân viên Barista mới có quyền' })
  async holdRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HoldRefundDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.holdRefund(id, user, dto);
  }

  // Chức năng: Cho phép thử chuyển khoản hoàn tiền lại. Cách hoạt động: Cập nhật lại STK mới (nếu có) và đưa refundStatus về PENDING (chặn retry nếu đang UNKNOWN).
  @Patch(':id/retry-refund')
  @ApiOperation({
    summary: 'Thử lại hoàn tiền VietQR (chuyển về PENDING)',
    description: 'Cho phép Barista thử lại giao dịch hoàn tiền, có thể cập nhật thông tin tài khoản/ngân hàng nếu khách cung cấp lại.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({ status: 200, description: 'Đặt lại trạng thái PENDING thành công' })
  @ApiResponse({ status: 403, description: 'Chỉ nhân viên Barista mới có quyền' })
  async retryRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RetryRefundDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.retryRefund(id, user, dto);
  }

  // Chức năng: Cập nhật dữ liệu (updateStatus). Cách hoạt động: Xác thực dữ liệu thay đổi và cập nhật trạng thái vào hệ thống/state.
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Barista cập nhật trạng thái đơn (Task 10 & Mở rộng Barista)',
    description: 'Chỉ barista có quyền chuyển bước đơn hàng (PAID → PREPARING → READY → COMPLETED).',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng', example: 1042 })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
  @ApiResponse({ status: 403, description: 'Chỉ nhân viên Barista mới có quyền' })
  @ApiResponse({ status: 409, description: 'Bước chuyển trạng thái không hợp lệ (INVALID_TRANSITION)' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.ordersService.updateOrderStatus(id, dto.status, user);
  }
}