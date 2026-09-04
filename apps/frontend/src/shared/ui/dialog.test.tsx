import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog, Dialog } from './dialog';

const originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement;
    },
  });
});

afterAll(() => {
  if (originalOffsetParent) {
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', originalOffsetParent);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'offsetParent');
  }
});

function DialogHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir detalhes
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Detalhes da transação"
        description="Revise os dados antes de salvar."
        footer={<button type="button">Salvar</button>}
      >
        <button type="button">Editar valor</button>
      </Dialog>
    </>
  );
}

function ConfirmationInputHarness({ onClose }: { onClose: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Restaurar backup
      </button>
      <Dialog
        open={open}
        title="Confirmar substituição"
        onClose={() => {
          onClose(confirmation);
          setOpen(false);
        }}
      >
        <label htmlFor="backup-confirmation">Digite SUBSTITUIR</label>
        <input
          id="backup-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('preserva foco durante a digitação com callback inline e fecha usando o valor atualizado', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<ConfirmationInputHarness onClose={onClose} />);

    const trigger = screen.getByRole('button', { name: 'Restaurar backup' });
    await user.click(trigger);
    const input = screen.getByRole('textbox', { name: 'Digite SUBSTITUIR' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus());
    await user.click(input);
    expect(input).toHaveFocus();

    for (const letter of 'SUBSTITUIR') {
      await user.keyboard(letter);
      // Let the browser paint between keystrokes, as it does during real typing.
      await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      expect(input).toHaveFocus();
    }

    expect(input).toHaveValue('SUBSTITUIR');
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('SUBSTITUIR');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('anuncia título e descrição, fecha com Escape e devolve o foco ao gatilho', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    const trigger = screen.getByRole('button', { name: 'Abrir detalhes' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Detalhes da transação' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Revise os dados antes de salvar.');
    expect(document.body).toHaveStyle({ overflow: 'hidden' });

    const closeButton = screen.getByRole('button', { name: 'Fechar' });
    await waitFor(() => expect(closeButton).toHaveFocus());

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('mantém Tab e Shift+Tab dentro do diálogo', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(screen.getByRole('button', { name: 'Abrir detalhes' }));

    const firstButton = screen.getByRole('button', { name: 'Fechar' });
    const lastButton = screen.getByRole('button', { name: 'Salvar' });
    await waitFor(() => expect(firstButton).toHaveFocus());

    lastButton.focus();
    await user.tab();
    expect(firstButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(lastButton).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('inicia o foco em cancelar para proteger ações destrutivas', async () => {
    render(
      <ConfirmDialog
        open
        title="Excluir conta"
        message="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Excluir conta' })).toHaveTextContent('Esta ação não pode ser desfeita.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus());
  });
});
