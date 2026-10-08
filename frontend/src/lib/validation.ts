export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** D-66: kamida 8 belgi, kamida bitta harf va bitta raqam. */
export function isPasswordValid(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /\p{L}/u.test(password) &&
    /\d/.test(password)
  );
}
