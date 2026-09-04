export type TourPlacement = 'auto' | 'top' | 'right' | 'bottom' | 'left' | 'center';

export interface TourStep {
  /** Stable identifier used by analytics and tests. */
  id: string;
  /** CSS selector for the element highlighted by this step. */
  target: string;
  title: string;
  description: string;
  placement?: TourPlacement;
}

/**
 * Default V1 journey. Screens opt in by adding the matching `data-tour`
 * attributes; when a target is not mounted, the card stays usable in the
 * centre of the viewport instead of interrupting the tutorial.
 */
export const DEFAULT_TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'financial-overview',
    target: '[data-tour="financial-overview"]',
    title: 'Sua vida financeira em um só lugar',
    description: 'Comece pelo resumo: ele separa o saldo das contas, a carteira de investimentos e a fatura atual.',
    placement: 'bottom',
  },
  {
    id: 'period-filter',
    target: '[data-tour="period-filter"]',
    title: 'Escolha o período da análise',
    description: 'Alterne entre semana, mês, ano ou um intervalo personalizado para comparar receitas e despesas.',
    placement: 'bottom',
  },
  {
    id: 'movements',
    target: '[data-tour="nav-movements"]',
    title: 'Registre e organize movimentações',
    description: 'Aqui ficam suas transações, os lançamentos sem categoria e a organização por categorias.',
    placement: 'right',
  },
  {
    id: 'assets',
    target: '[data-tour="nav-assets"]',
    title: 'Acompanhe contas e cartões',
    description: 'Consulte saldos, limites e o ciclo atual dos cartões sem perder o contexto do seu patrimônio.',
    placement: 'right',
  },
  {
    id: 'recurring',
    target: '[data-tour="nav-recurring"]',
    title: 'Não esqueça os compromissos recorrentes',
    description: 'Confirme ou ignore ocorrências pendentes e mantenha seus modelos de receitas e despesas fixas.',
    placement: 'right',
  },
  {
    id: 'goals',
    target: '[data-tour="nav-goals"]',
    title: 'Transforme planos em metas',
    description: 'Defina objetivos e atualize o progresso manualmente sempre que reservar ou utilizar um valor.',
    placement: 'right',
  },
  {
    id: 'imports',
    target: '[data-tour="nav-imports"]',
    title: 'Ganhe tempo com importações',
    description: 'Envie um extrato, revise a prévia e confirme somente as linhas que deseja registrar.',
    placement: 'right',
  },
  {
    id: 'settings',
    target: '[data-tour="nav-settings"]',
    title: 'Seus dados continuam sob seu controle',
    description: 'Em Configurações você cuida do perfil, da segurança, do tutorial e dos backups locais.',
    placement: 'right',
  },
] as const;
