import { formatFullDate } from '@/features/dashboard/utils';
import { Icon } from '@/components/ui/icon';

type TopBarProps = {
  userName?: string | null;
  referenceDate?: string;
};

export function TopBar({ userName, referenceDate }: TopBarProps) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <h1 className="text-4xl font-semibold text-foreground">Bem vindo{userName ? `, ${userName}!` : '!'}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="rounded-full border border-foreground/10 bg-layer01 px-4 py-2 text-muted-foreground">
          {formatFullDate(referenceDate ? new Date(referenceDate) : new Date())}
        </div>
        <div className="flex p-2 items-center justify-center rounded-full border border-foreground/10 bg-layer01 text-sm text-muted-foreground">
          <Icon name="User4Outlined" />
        </div>
      </div>
    </div>
  );
}
