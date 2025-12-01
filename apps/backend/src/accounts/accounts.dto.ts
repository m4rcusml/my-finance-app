export class CreateAccountDto {
  name: string;
  institution: string;
  type: string;
  initialBalance: number;
}

export class UpdateAccountDto {
  name?: string;
  institution?: string;
  type?: string;
  initialBalance?: number;
}
