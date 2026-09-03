import { isWeakPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, passwordPolicyViolation } from '@finance/contracts';

describe('política compartilhada de senha', () => {
  it('aceita exatamente os limites mínimo e máximo', () => {
    expect(passwordPolicyViolation(`A${'b'.repeat(MIN_PASSWORD_LENGTH - 1)}`)).toBeNull();
    expect(passwordPolicyViolation(`A${'b'.repeat(MAX_PASSWORD_LENGTH - 1)}`)).toBeNull();
  });

  it('rejeita valores imediatamente fora dos limites', () => {
    expect(passwordPolicyViolation('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(
      `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
    expect(passwordPolicyViolation('a'.repeat(MAX_PASSWORD_LENGTH + 1))).toBe(
      `A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`,
    );
  });

  it('normaliza espaços e caixa ao detectar senhas comuns', () => {
    expect(isWeakPassword('  SeNhA@1234  ')).toBe(true);
    expect(passwordPolicyViolation('  SeNhA@1234  ')).toBe(
      'Esta senha é muito comum. Escolha uma senha menos previsível.',
    );
  });

  it('rejeita entradas que não são texto', () => {
    expect(passwordPolicyViolation(null)).toBe('A senha deve ser um texto.');
    expect(passwordPolicyViolation(1234567890)).toBe('A senha deve ser um texto.');
  });
});
