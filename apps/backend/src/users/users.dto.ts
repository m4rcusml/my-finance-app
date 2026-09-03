import type {
  ChangePasswordRequest,
  DeleteAccountRequest,
  IsoTimestamp,
  UpdateProfileRequest,
  UserProfile,
} from '@finance/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ACCOUNT_DELETION_CONFIRMATION, normalizeEmail } from '../auth/constants';
import { IsStrongPassword, MAX_PASSWORD_LENGTH } from '../auth/password-policy';

/**
 * The public shape of a user. `implements UserProfile` is load-bearing: if the
 * contract gains a field, this class stops compiling until it is added here.
 * `passwordHash` is not on it and must never be.
 */
export class UserProfileDto implements UserProfile {
  @ApiProperty({ format: 'uuid', example: '3f0c2c1e-6a2e-4a1f-9c1a-9e1b2f3d4c5b' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'maria@exemplo.com.br' })
  email!: string;

  @ApiProperty({ nullable: true, type: String, example: 'Maria Silva' })
  name!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-01-15T12:00:00.000Z' })
  createdAt!: IsoTimestamp;

  @ApiProperty({ format: 'date-time', example: '2026-01-15T12:00:00.000Z' })
  updatedAt!: IsoTimestamp;
}

/**
 * `PATCH /users/me`.
 *
 * PATCH semantics: a key that is absent is left untouched; `name: null` clears
 * the name. `currentPassword` is not part of `UpdateProfileRequest` in the
 * contract — it is an extra field this endpoint requires **only** when the
 * e-mail actually changes, because an e-mail change is an account-takeover
 * primitive (it moves where password resets land).
 */
export class UpdateProfileDto implements UpdateProfileRequest {
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Nome de exibição. Envie `null` para remover.',
    example: 'Maria Silva',
  })
  @IsOptional()
  // `null` means "clear it", so only run the string checks when it is not null.
  @ValidateIf((dto: UpdateProfileDto) => dto.name !== null)
  @IsString({ message: 'O nome deve ser um texto.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string | null;

  @ApiPropertyOptional({ format: 'email', example: 'maria.nova@exemplo.com.br' })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  email?: string;

  @ApiPropertyOptional({
    description: 'Obrigatório apenas quando o e-mail está sendo alterado.',
    example: 'minha-senha-atual',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword?: string;
}

/** `PATCH /users/me/password`. Revokes every session on success. */
export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiProperty({ example: 'minha-senha-atual' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword!: string;

  @ApiProperty({ minLength: 10, example: 'uma-senha-bem-longa' })
  @IsStrongPassword()
  newPassword!: string;
}

/** `DELETE /users/me`. Irreversible, so it asks for two independent proofs. */
export class DeleteAccountDto implements DeleteAccountRequest {
  @ApiProperty({ example: 'minha-senha-atual' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha da conta.' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;

  @ApiProperty({
    enum: [ACCOUNT_DELETION_CONFIRMATION],
    description: `Deve ser exatamente "${ACCOUNT_DELETION_CONFIRMATION}".`,
    example: ACCOUNT_DELETION_CONFIRMATION,
  })
  @IsString()
  @Equals(ACCOUNT_DELETION_CONFIRMATION, {
    message: `Digite exatamente "${ACCOUNT_DELETION_CONFIRMATION}" para confirmar.`,
  })
  confirmation!: string;
}
