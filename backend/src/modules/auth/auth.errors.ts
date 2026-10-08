import { AppError } from '../../utils/errors.js';

// Noma'lum email va noto'g'ri parol uchun bitta xato — foydalanuvchi mavjudligi oshkor bo'lmasin (D-91)
export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, 'INVALID_CREDENTIALS', "Email yoki parol noto'g'ri");
  }
}

export class AccountInactiveError extends AppError {
  constructor() {
    super(403, 'ACCOUNT_INACTIVE', 'Hisob yoki kompaniya faol emas');
  }
}

export class SessionExpiredError extends AppError {
  constructor() {
    super(401, 'SESSION_EXPIRED', 'Sessiya tugagan, qaytadan kiring');
  }
}

export class TokenReusedError extends AppError {
  constructor() {
    super(401, 'TOKEN_REUSED', 'Sessiya bekor qilindi, qaytadan kiring');
  }
}

export class CompanyRequiredError extends AppError {
  constructor() {
    super(403, 'COMPANY_REQUIRED', 'Bu amal faqat kompaniya foydalanuvchilari uchun');
  }
}
