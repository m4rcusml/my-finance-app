import { formatFullDate } from '@/features/dashboard/utils';

type TopBarProps = {
  userName?: string | null;
};

export function TopBar({ userName }: TopBarProps) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Bem vindo{userName ? ',' : ''}
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          {userName ?? 'Seu painel'}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="rounded-full border border-foreground/10 bg-layer01 px-4 py-2 text-xs text-muted-foreground">
          {formatFullDate(new Date())}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 bg-layer01 text-sm text-muted-foreground">
          <i className="lni lni-user" aria-hidden />
        </div>
      </div>
    </div>
  );
}
