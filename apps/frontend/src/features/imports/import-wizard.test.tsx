import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportWizard } from './import-wizard';

let mockSessionKey = 'user-a';
const batch = {
  batchId: 'batch-a',
  fileName: 'extrato.csv',
  totalRows: 2,
  status: 'pending',
  expiresAt: '2099-01-01T00:00:00Z',
};
jest.mock('@/shared/session/session-provider', () => ({ useSessionKey: () => mockSessionKey }));
jest.mock('./queries', () => ({
  useImportBatchQuery: (id: string | null) => ({ data: id ? batch : undefined, isPending: !id, isError: false }),
}));
jest.mock('./upload-step', () => ({
  UploadStep: ({ onAnalyzed }: { onAnalyzed: (value: unknown) => void }) => (
    <button type="button" onClick={() => onAnalyzed(batch)}>
      Analisar teste
    </button>
  ),
}));
jest.mock('./preview-step', () => ({
  PreviewStep: ({ onBack, onConfirmed }: { onBack: () => void; onConfirmed: (value: unknown) => void }) => (
    <div>
      <h2>Prévia teste</h2>
      <button type="button" onClick={onBack}>
        Trocar
      </button>
      <button type="button" onClick={() => onConfirmed({ imported: 2 })}>
        Confirmar teste
      </button>
    </div>
  ),
}));
jest.mock('./result-step', () => ({ ResultStep: () => <h2>Resultado teste</h2> }));

describe('retomada da importação', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockSessionKey = 'user-a';
  });

  it('retém apenas o batchId e permite retomar depois de recarregar', async () => {
    const user = userEvent.setup();
    const rendered = render(<ImportWizard />);
    await user.click(screen.getByRole('button', { name: 'Analisar teste' }));
    expect(sessionStorage.getItem('finance:import-preview:user-a')).toBe('batch-a');
    rendered.unmount();
    render(<ImportWizard />);
    await user.click(await screen.findByRole('button', { name: 'Retomar prévia' }));
    expect(screen.getByRole('heading', { name: 'Prévia teste' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar teste' }));
    expect(sessionStorage.getItem('finance:import-preview:user-a')).toBeNull();
  });

  it('não mostra a prévia de outro usuário ao trocar de sessão', async () => {
    sessionStorage.setItem('finance:import-preview:user-a', 'batch-a');
    const rendered = render(<ImportWizard />);
    expect(await screen.findByRole('button', { name: 'Retomar prévia' })).toBeInTheDocument();
    mockSessionKey = 'user-b';
    rendered.rerender(<ImportWizard />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retomar prévia' })).not.toBeInTheDocument());
  });
});
