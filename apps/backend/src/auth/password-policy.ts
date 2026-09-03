import { passwordPolicyViolation as validatePassword } from '@finance/contracts';
import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

export {
  isWeakPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordPolicyViolation,
} from '@finance/contracts';

/**
 * Password policy for V1.
 *
 * Deliberately two rules and no more: a length floor that actually matters, and
 * a denylist of the handful of strings people reach for first. Composition
 * rules ("one uppercase, one symbol") push users towards `Senha@123`, which is
 * rejected by the shared policy precisely because everybody picks it.
 */
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
        validate: (value: unknown) => validatePassword(value) === null,
        defaultMessage: (args?: ValidationArguments) => validatePassword(args?.value) ?? 'Senha inválida.',
      },
    });
  };
}
