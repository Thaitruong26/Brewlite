/**
 * Lỗi API theo định dạng thống nhất (api.md mục 2.1):
 * { statusCode, code, message, details?, path, timestamp }
 * Frontend dựa vào `code` để hiển thị thông báo phù hợp.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** NestJS trả 404 "Cannot GET /api/..." khi route chưa được khai báo ở backend. */
  get isMissingRoute() {
    return this.status === 404 && /^Cannot (GET|POST|PATCH|PUT|DELETE) /.test(this.message);
  }
}

