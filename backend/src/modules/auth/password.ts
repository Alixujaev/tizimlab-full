import bcrypt from 'bcryptjs';
import { ValidationError } from '../../utils/errors.js';

/** Spec §15, D-86: bcryptjs, 10 round (`$2a$`/`$2b$` — eski tizim xeshlari bilan mos). */
export const BCRYPT_ROUNDS = 10;
/** bcrypt 72 baytdan keyingisini e'tiborsiz qoldiradi — uzun parolni chegaralaymiz. */
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_MIN_LENGTH = 8;

/** D-66: kamida 8 belgi, kamida bitta harf va bitta raqam. */
export function isPasswordValid(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    /\p{L}/u.test(password) &&
    /\d/.test(password)
  );
}

export const PASSWORD_POLICY_MESSAGE =
  "Parol kamida 8 belgidan iborat bo'lishi va kamida bitta harf hamda bitta raqamni o'z ichiga olishi kerak";

export function assertPasswordPolicy(password: string): void {
  if (!isPasswordValid(password)) {
    throw new ValidationError(PASSWORD_POLICY_MESSAGE, [
      { path: 'body.password', message: PASSWORD_POLICY_MESSAGE },
    ]);
  }
}

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

let dummyHash: Promise<string> | null = null;
/** Noma'lum email'da ham bcrypt.compare bajariladi — javob vaqti mavjud foydalanuvchinikidan farqlanmasin (D-91). */
export function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash('dummy-password-for-timing-1', BCRYPT_ROUNDS);
  return dummyHash;
}
