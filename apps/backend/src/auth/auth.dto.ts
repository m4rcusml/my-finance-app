import type { AuthSessionResponse, LoginRequest, RegisterRequest } from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserProfileDto } from '../users/users.dto';
import { normalizeEmail } from './constants';
import { IsStrongPassword, MAX_PASSWORD_LENGTH } from './password-policy';

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ format: 'email', example: 'maria@exemplo.com.br' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  email!: string;

  @ApiProperty({
    minLength: 10,
    description: 'Mínimo de 10 caracteres e fora da lista de senhas óbvias.',
    example: 'uma-senha-bem-longa',
  })
  @IsStrongPassword()
  password!: string;

  @ApiPropertyOptional({ example: 'Maria Silva' })
  @IsOptional()
  @IsString({ message: 'O nome deve ser um texto.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;
}

/**
 * Login intentionally does **not** apply the password policy.
 *
 * Rejecting a 6-character password with a 400 before authentication is even
 * attempted tells an attacker that the policy changed, and it locks legacy
 * users out with a validation error instead of an honest 401. The only rule
 * here is "a non-empty string", and a wrong password is answered by the same
 * generic 401 as an unknown e-mail.
 */
export class LoginDto implements LoginRequest {
  @ApiProperty({ format: 'email', example: 'maria@exemplo.com.br' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  email!: string;

  @ApiProperty({ example: 'uma-senha-bem-longa' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha.' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}

/** What `register`, `login` and `refresh` all return in the body. */
export class AuthSessionResponseDto implements AuthSessionResponse {
  @ApiProperty({
    description: 'JWT de curta duração. Guarde apenas em memória, nunca em localStorage.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({ description: 'Segundos até o `accessToken` expirar.', example: 900 })
  expiresIn!: number;

  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;
}
