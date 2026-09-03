'use client';

import { IconButton } from '@/shared/ui/form';

/**
 * The four row actions shared by every account row (table cell and mobile card).
 *
 * Every control is an `<IconButton>` with a real accessible name that includes
 * the account name, so a screen-reader user hearing "Arquivar" out of context
 * still knows *which* account is about to be archived.
 */

const ICON_CLASS = 'size-4';

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={ICON_CLASS}>
      <path d="M4 20h4l10-10a2.8 2.8 0 1 0-4-4L4 16v4Z" strokeLinejoin="round" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={ICON_CLASS}>
      <path d="M3 6.5h18v3H3z" strokeLinejoin="round" />
      <path d="M5 9.5v9h14v-9" strokeLinejoin="round" />
      <path d="M10 13h4" strokeLinecap="round" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={ICON_CLASS}>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" strokeLinecap="round" />
      <path d="M4 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={ICON_CLASS}>
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M9 7V5h6v2" strokeLinejoin="round" />
      <path d="M6 7l1 12h10l1-12" strokeLinejoin="round" />
    </svg>
  );
}

export interface AccountRowActionsProps {
  name: string;
  isActive: boolean;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

export function AccountRowActions({
  name,
  isActive,
  busy,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: AccountRowActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <IconButton label={`Editar a conta ${name}`} variant="secondary" disabled={busy} onClick={onEdit}>
        <PencilIcon />
      </IconButton>

      {isActive ? (
        <IconButton label={`Arquivar a conta ${name}`} variant="secondary" disabled={busy} onClick={onArchive}>
          <ArchiveIcon />
        </IconButton>
      ) : (
        <IconButton label={`Reativar a conta ${name}`} variant="secondary" disabled={busy} onClick={onRestore}>
          <RestoreIcon />
        </IconButton>
      )}

      <IconButton label={`Excluir a conta ${name}`} variant="secondary" disabled={busy} onClick={onDelete}>
        <TrashIcon />
      </IconButton>
    </div>
  );
}
