import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

/**
 * Password policy for V1.
 *
 * Deliberately two rules and no more: a length floor that actually matters, and
 * a denylist of the handful of strings people reach for first. Composition
 * rules ("one uppercase, one symbol") push users towards `Senha@123`, which is
 * on the denylist below precisely because everybody picks it.
 */
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

/**
 * Obvious passwords, compared case-insensitively after trimming. Small on
 * purpose — this is a guard rail, not a breach corpus. Anything bigger belongs
 * behind a real k-anonymity lookup, which V1 does not have.
 */
const WEAK_PASSWORDS: ReadonlySet<string> = new Set([
  '0123456789',
  '1234567890',
  '12345678910',
  'abcdefghij',
  'qwertyuiop',
  'password',
  'password1',
  'password123',
  'passw0rd123',
  'senha123456',
  'senhasegura',
  'minhasenha',
  'minhasenha1',
  'iloveyou123',
  'letmein123',
  'welcome123',
  'admin12345',
  'administrador',
  'brasil12345',
  'flamengo123',
  'corinthians',
  'saopaulo123',
  'palmeiras1',
  'gremio1234',
  'sistema123',
  'financas123',
  'financeiro1',
  'teste12345',
  'usuario123',
  'qwerty12345',
  'senha@123',
  'senha@1234',
]);

export function isWeakPassword(password: string): boolean {
  return WEAK_PASSWORDS.has(password.trim().toLowerCase());
}

export function passwordPolicyViolation(password: unknown): string | null {
  if (typeof password !== 'string') return 'A senha deve ser um texto.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`;
  }
  if (isWeakPassword(password)) {
    return 'Esta senha é muito comum. Escolha uma senha menos previsível.';
  }
  return null;
}

/**
 * `@IsStrongPassword()` — applies `passwordPolicyViolation` at the DTO
 * boundary so a weak password is a 400 with a pt-BR reason, never a 500 and
 * never an account that exists with a guessable secret.
 */
export function IsStrongPassword(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => passwordPolicyViolation(value) === null,
        defaultMessage: (args?: ValidationArguments) => passwordPolicyViolation(args?.value) ?? 'Senha inválida.',
      },
    });
  };
}
