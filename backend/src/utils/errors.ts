// Domen xatolari: service'lar shularni (yoki ulardan meros olgan modul xatolarini) tashlaydi,
// errorHandler esa ularni D-22 formatidagi javobga aylantiradi.

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'
  | (string & {});

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "So'rov ma'lumotlari noto'g'ri", details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Autentifikatsiya talab qilinadi') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Bu amal uchun ruxsat yo'q") {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Topilmadi') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Ziddiyat: yozuv allaqachon mavjud yoki bog'langan", details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}
