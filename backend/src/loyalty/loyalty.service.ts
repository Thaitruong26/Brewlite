import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class LoyaltyService {
  
  /**
   * Hàm cộng điểm thưởng cho khách hàng khi đơn hàng chuyển sang PAID
   * @param tx Prisma Transaction client (do bạn BE4 truyền vào lúc gọi hàm)
   * @param order Thông tin đơn hàng (phải chứa id, userId, và total)
   */
  async award(tx: any, order: any) {
    // 1. Tính toán số điểm (Cứ 1.000đ = 1 điểm, làm tròn xuống)
    const points = Math.floor(order.total / 1000);

    // Nếu đơn hàng giá trị quá nhỏ (dưới 1000đ) thì không có điểm để cộng
    if (points <= 0) return;

    // 2. Kiểm tra xem đơn hàng này đã từng được cộng điểm chưa 
    // (Đảm bảo mỗi đơn chỉ cộng 1 lần theo đúng yêu cầu của nhóm trưởng)
    const existingTransaction = await tx.loyaltyTransaction.findUnique({
      where: { orderId: order.id },
    });

    if (existingTransaction) {
      throw new BadRequestException('Đơn hàng này đã được cộng điểm thưởng rồi!');
    }

    // 3. Ghi lại lịch sử cộng điểm vào bảng LoyaltyTransaction
    await tx.loyaltyTransaction.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        points: points,
      },
    });

    // 4. Tăng tổng điểm tích lũy (loyaltyPoints) của User lên
    await tx.user.update({
      where: { id: order.userId },
      data: {
        loyaltyPoints: { increment: points },
      },
    });

    // 5. Lưu vết số điểm kiếm được vào chính đơn hàng đó (cột pointsEarned)
    await tx.order.update({
      where: { id: order.id },
      data: { pointsEarned: points },
    });

    return {
      success: true,
      message: `Đã cộng thành công ${points} điểm cho khách hàng!`,
    };
  }
}