/** Shared by every UI that creates a password and by the API validators. */
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

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
