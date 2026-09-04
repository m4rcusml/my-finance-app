import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GUIDED_TOUR_RESTART_EVENT, getTourStorageKey, GuidedTour, restartTour } from './guided-tour';
import type { TourStep } from './tour-steps';

const STEPS: readonly TourStep[] = [
  {
    id: 'overview',
    target: '[data-tour="overview"]',
    title: 'Conheça seu resumo',
    description: 'Veja os números mais importantes.',
    placement: 'bottom',
  },
  {
    id: 'movements',
    target: '[data-tour="movements"]',
    title: 'Organize movimentações',
    description: 'Registre receitas e despesas.',
    placement: 'right',
  },
] as const;

const scrollIntoView = jest.fn();
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
const originalMatchMedia = window.matchMedia;

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
});

afterAll(() => {
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  }
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
});

beforeEach(() => {
  cleanup();
  localStorage.clear();
  scrollIntoView.mockClear();
  setReducedMotion(false);
});

function renderTour(userKey = 'pessoa@example.com', props: Partial<React.ComponentProps<typeof GuidedTour>> = {}) {
  return render(
    <div>
      <button type="button" data-tour="overview">
        Resumo financeiro
      </button>
      <button type="button" data-tour="movements">
        Movimentações
      </button>
      <GuidedTour userKey={userKey} steps={STEPS} {...props} />
    </div>,
  );
}

describe('GuidedTour', () => {
  it('limpa o progresso e solicita a reabertura sem recarregar a página', () => {
    const listener = jest.fn();
    localStorage.setItem(getTourStorageKey('user-123'), '{"status":"completed"}');
    window.addEventListener(GUIDED_TOUR_RESTART_EVENT, listener);

    restartTour('user-123');

    expect(localStorage.getItem(getTourStorageKey('user-123'))).toBeNull();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: 'user-123' }));
    window.removeEventListener(GUIDED_TOUR_RESTART_EVENT, listener);
  });

  it('ancora a etapa no alvo, anuncia o progresso e salva o andamento por usuário', async () => {
    const target = document.createElement('div');
    target.dataset.tour = 'overview';
    target.getBoundingClientRect = jest.fn(() => ({
      top: 80,
      right: 320,
      bottom: 140,
      left: 120,
      width: 200,
      height: 60,
      x: 120,
      y: 80,
      toJSON: () => ({}),
    }));
    document.body.append(target);

    renderTour();

    const dialog = await screen.findByRole('dialog', { name: 'Conheça seu resumo' });
    expect(dialog).toHaveAccessibleDescription('Veja os números mais importantes.');
    expect(screen.getByRole('progressbar', { name: 'Progresso do tutorial' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('Passo 1 de 2')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('tour-spotlight')).toBeInTheDocument());
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'center' });

    const saved = JSON.parse(localStorage.getItem(getTourStorageKey('pessoa@example.com')) ?? '{}');
    expect(saved).toMatchObject({ version: 1, status: 'in-progress', stepIndex: 0 });
    await act(async () => {
      target.remove();
      await Promise.resolve();
    });
  });

  it('navega entre as etapas e persiste a conclusão', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    renderTour('user-123', { onComplete });

    await user.click(await screen.findByRole('button', { name: 'Próximo' }));
    expect(screen.getByRole('dialog', { name: 'Organize movimentações' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progresso do tutorial' })).toHaveAttribute('aria-valuenow', '2');

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByRole('dialog', { name: 'Conheça seu resumo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    await user.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(getTourStorageKey('user-123')) ?? '{}')).toMatchObject({
      status: 'completed',
      stepIndex: 1,
    });
  });

  it('mantém a escolha de pular isolada entre usuários', async () => {
    const user = userEvent.setup();
    const first = renderTour('ana@example.com');
    await user.click(await screen.findByRole('button', { name: 'Pular tutorial' }));
    expect(JSON.parse(localStorage.getItem(getTourStorageKey('ana@example.com')) ?? '{}')).toMatchObject({
      status: 'skipped',
    });

    first.unmount();
    const sameUser = renderTour('ana@example.com');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    sameUser.unmount();

    renderTour('bia@example.com');
    expect(await screen.findByRole('dialog', { name: 'Conheça seu resumo' })).toBeInTheDocument();
  });

  it('usa um cartão central quando o alvo da etapa não está disponível', async () => {
    const missingStep: readonly TourStep[] = [
      {
        id: 'missing',
        target: '[data-tour="not-mounted"]',
        title: 'Etapa disponível',
        description: 'O conteúdo continua acessível.',
      },
    ];
    render(<GuidedTour userKey="missing-target" steps={missingStep} />);

    const dialog = await screen.findByRole('dialog', { name: 'Etapa disponível' });
    expect(dialog).toHaveAttribute('data-tour-position', 'center');
    expect(screen.getByTestId('tour-scrim')).toBeInTheDocument();
    expect(screen.queryByTestId('tour-spotlight')).not.toBeInTheDocument();
  });

  it('ancora e rola quando um alvo tardio aparece depois da consulta', async () => {
    const lateSteps: readonly TourStep[] = [
      {
        id: 'late',
        target: '[data-tour="late-overview"]',
        title: 'Resumo carregado',
        description: 'O alvo chega com os dados.',
      },
    ];
    render(<GuidedTour userKey="late-target" steps={lateSteps} />);
    await screen.findByRole('dialog', { name: 'Resumo carregado' });
    expect(screen.getByTestId('tour-scrim')).toBeInTheDocument();

    const target = document.createElement('section');
    target.dataset.tour = 'late-overview';
    target.getBoundingClientRect = jest.fn(() => ({
      top: 160,
      right: 340,
      bottom: 260,
      left: 80,
      width: 260,
      height: 100,
      x: 80,
      y: 160,
      toJSON: () => ({}),
    }));
    await act(async () => document.body.append(target));

    await waitFor(() => expect(screen.getByTestId('tour-spotlight')).toBeInTheDocument());
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'center' });
    await act(async () => {
      target.remove();
      await Promise.resolve();
    });
  });

  it('prende o foco, fecha com Escape e restaura o foco anterior', async () => {
    const user = userEvent.setup();
    const trigger = document.createElement('button');
    trigger.textContent = 'Iniciar ajuda';
    document.body.append(trigger);
    trigger.focus();
    const onSkip = jest.fn();

    renderTour('keyboard-user', { onSkip });
    const close = await screen.findByRole('button', { name: 'Fechar tutorial' });
    await waitFor(() => expect(close).toHaveFocus());

    const next = screen.getByRole('button', { name: 'Próximo' });
    next.focus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body.style.overflow).toBe('');
    trigger.remove();
  });

  it('desativa a rolagem animada quando o usuário prefere movimento reduzido', async () => {
    const target = document.createElement('div');
    target.dataset.tour = 'overview';
    target.getBoundingClientRect = jest.fn(() => ({
      top: 80,
      right: 320,
      bottom: 140,
      left: 120,
      width: 200,
      height: 60,
      x: 120,
      y: 80,
      toJSON: () => ({}),
    }));
    document.body.append(target);
    setReducedMotion(true);
    renderTour('reduced-motion');

    await screen.findByRole('dialog');
    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center', inline: 'center' }),
    );
    await act(async () => {
      target.remove();
      await Promise.resolve();
    });
  });
});
