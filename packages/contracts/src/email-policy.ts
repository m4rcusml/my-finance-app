import isEmail from 'validator/lib/isEmail';

export function isValidEmailAddress(value: unknown): value is string {
  return typeof value === 'string' && isEmail(value);
}
