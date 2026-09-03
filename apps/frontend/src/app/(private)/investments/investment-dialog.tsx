'use client';

import {
  type CreateInvestmentRequest,
  INVESTMENT_TYPES,
  type InvestmentType,
  type InvestmentWithAsset,
  MARKET_ASSET_TYPES,
  type MarketAssetType,
  isCivilDate,
  roundMoney,
} from '@finance/contracts';
import { useEffect, useId, useState } from 'react';
import { parseDecimal, toDecimalInput } from '@/features/investments/decimal';
import {
  useCreateInvestmentMutation,
  useCreateMarketAssetMutation,
  useUpdateInvestmentMutation,
} from '@/features/investments/mutations';
import { useMarketAssetsQuery } from '@/features/investments/queries';
import { errorDetails, errorMessage } from '@/shared/lib/api';
import { INVESTMENT_TYPE_LABELS, formatMoney, todayCivil } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select, TextInput } from '@/shared/ui/form';
import { useToast } from '@/shared/ui/toast';

/**
 * Create / edit an investment.
 *
 * `investedAmount` is derived from `quantidade × preço de compra` and shown
 * read-only, because that is what the API computes by default; the user has to
 * opt in explicitly to override it, so a typo in one of the two factors cannot
 * silently disagree with a stale manual total.
 *
 * The "novo ativo" flow is an inline panel rather than a second modal on top of
 * this one: stacked dialogs share a single document-level Escape listener, so
 * one Escape would close both and throw away the half-filled investment form.
 */

interface FormState {
  marketAssetId: string;
  broker: string;
  type: InvestmentType;
  quantity: string;
  buyPrice: string;
  buyDate: string;
  manualAmount: boolean;
  investedAmount: string;
}

type FieldErrors = Partial<Record<'broker' | 'quantity' | 'buyPrice' | 'buyDate' | 'investedAmount', string>>;

function blankForm(): FormState {
  return {
    marketAssetId: '',
    broker: '',
    type: 'stock',
    quantity: '',
    buyPrice: '',
    buyDate: todayCivil(),
    manualAmount: false,
    investedAmount: '',
  };
}

function formFor(investment: InvestmentWithAsset): FormState {
  const computed = roundMoney(investment.quantity * investment.buyPrice);
  return {
    marketAssetId: investment.marketAssetId ?? '',
    broker: investment.broker,
    type: investment.type,
    quantity: toDecimalInput(investment.quantity),
    buyPrice: toDecimalInput(investment.buyPrice),
    buyDate: investment.buyDate,
    // Only pre-tick the override when the stored total genuinely differs.
    manualAmount: roundMoney(investment.investedAmount) !== computed,
    investedAmount: toDecimalInput(investment.investedAmount),
  };
}

export function InvestmentDialog({
  open,
  onClose,
  investment,
}: {
  open: boolean;
  onClose: () => void;
  investment: InvestmentWithAsset | null;
}) {
  const toast = useToast();
  const formId = useId();
  const [form, setForm] = useState<FormState>(blankForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDetails, setSubmitDetails] = useState<string[]>([]);

  const assetsQuery = useMarketAssetsQuery();
  const createInvestment = useCreateInvestmentMutation();
  const updateInvestment = useUpdateInvestmentMutation();

  const pending = createInvestment.isPending || updateInvestment.isPending;

  // Reset whenever the dialog opens, or the row being edited changes.
  useEffect(() => {
    if (!open) return;
    setForm(investment ? formFor(investment) : blankForm());
    setFieldErrors({});
    setSubmitError(null);
    setSubmitDetails([]);
  }, [open, investment]);

  const quantity = parseDecimal(form.quantity);
  const buyPrice = parseDecimal(form.buyPrice);
  const computedAmount = roundMoney((quantity ?? 0) * (buyPrice ?? 0));

  function patch(changes: Partial<FormState>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};

    if (!form.broker.trim()) errors.broker = 'Informe a corretora.';
    if (quantity === null) errors.quantity = 'Informe a quantidade.';
    else if (quantity <= 0) errors.quantity = 'A quantidade precisa ser maior que zero.';

    if (buyPrice === null) errors.buyPrice = 'Informe o preço de compra.';
    else if (buyPrice < 0) errors.buyPrice = 'O preço de compra não pode ser negativo.';

    if (!isCivilDate(form.buyDate)) errors.buyDate = 'Informe uma data de compra válida.';

    if (form.manualAmount) {
      const manual = parseDecimal(form.investedAmount);
      if (manual === null) errors.investedAmount = 'Informe o valor investido.';
      else if (manual < 0) errors.investedAmount = 'O valor investido não pode ser negativo.';
    }

    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitDetails([]);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const manual = parseDecimal(form.investedAmount);
    const payload: CreateInvestmentRequest = {
      // An explicit `null` is what clears the relation; `undefined` would leave it.
      marketAssetId: form.marketAssetId ? form.marketAssetId : null,
      broker: form.broker.trim(),
      type: form.type,
      quantity: quantity ?? 0,
      buyPrice: buyPrice ?? 0,
      buyDate: form.buyDate,
      investedAmount: form.manualAmount && manual !== null ? roundMoney(manual) : computedAmount,
    };

    try {
      if (investment) await updateInvestment.mutateAsync({ id: investment.id, body: payload });
      else await createInvestment.mutateAsync(payload);
      onClose();
    } catch (error) {
      // The form stays open with the message in view; the toast is the echo.
      setSubmitError(errorMessage(error));
      setSubmitDetails(errorDetails(error));
      toast.error(errorMessage(error));
    }
  }

  const assets = assetsQuery.data?.data ?? [];

  return (
    <Dialog
      open={open}
      onClose={pending ? () => undefined : onClose}
      title={investment ? 'Editar investimento' : 'Novo investimento'}
      description="Registro manual de custo de aquisição. O app não busca cotações, então nada aqui é valor de mercado."
      size="lg"
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" form={formId} loading={pending} disabled={pending}>
            {investment ? 'Salvar alterações' : 'Registrar investimento'}
          </ActionButton>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError ? (
          <div role="alert" className="rounded-lg border border-danger/60 bg-layer02 p-3">
            <p className="text-sm font-medium text-danger-text">{submitError}</p>
            {submitDetails.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {submitDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <AssetPicker
          value={form.marketAssetId}
          onChange={(value) => patch({ marketAssetId: value })}
          assets={assets}
          loading={assetsQuery.isPending}
          loadFailed={assetsQuery.isError}
          disabled={pending}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Corretora" required error={fieldErrors.broker}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={form.broker}
                onChange={(e) => patch({ broker: e.target.value })}
                disabled={pending}
                autoComplete="off"
                placeholder="Ex.: XP, Rico, Binance"
              />
            )}
          </Field>

          <Field label="Tipo" required>
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={form.type}
                onChange={(e) => patch({ type: e.target.value as InvestmentType })}
                disabled={pending}
              >
                {INVESTMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {INVESTMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Quantidade"
            required
            hint="Aceita até 8 casas decimais. Use vírgula ou ponto."
            error={fieldErrors.quantity}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => patch({ quantity: e.target.value })}
                disabled={pending}
                autoComplete="off"
                placeholder="0"
              />
            )}
          </Field>

          <Field label="Preço de compra (R$)" required error={fieldErrors.buyPrice}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                value={form.buyPrice}
                onChange={(e) => patch({ buyPrice: e.target.value })}
                disabled={pending}
                autoComplete="off"
                placeholder="0,00"
              />
            )}
          </Field>

          <Field label="Data da compra" required error={fieldErrors.buyDate}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="date"
                value={form.buyDate}
                onChange={(e) => patch({ buyDate: e.target.value })}
                disabled={pending}
              />
            )}
          </Field>

          <Field label="Informar valor investido manualmente" hint="Por padrão o valor é quantidade × preço de compra.">
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                type="checkbox"
                checked={form.manualAmount}
                onChange={(e) =>
                  patch({
                    manualAmount: e.target.checked,
                    investedAmount: e.target.checked ? toDecimalInput(computedAmount) : '',
                  })
                }
                disabled={pending}
                className="size-5 self-start accent-primary"
              />
            )}
          </Field>
        </div>

        {form.manualAmount ? (
          <Field label="Valor investido (R$)" required error={fieldErrors.investedAmount}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                value={form.investedAmount}
                onChange={(e) => patch({ investedAmount: e.target.value })}
                disabled={pending}
                autoComplete="off"
                placeholder="0,00"
              />
            )}
          </Field>
        ) : (
          <Field label="Valor investido (calculado)" hint="Quantidade × preço de compra, arredondado para 2 casas.">
            {({ id, describedBy }) => (
              <TextInput id={id} aria-describedby={describedBy} readOnly value={formatMoney(computedAmount)} />
            )}
          </Field>
        )}
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Asset picker + inline "novo ativo"
// ---------------------------------------------------------------------------

function AssetPicker({
  value,
  onChange,
  assets,
  loading,
  loadFailed,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  assets: { id: string; symbol: string; name: string | null }[];
  loading: boolean;
  loadFailed: boolean;
  disabled: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-layer02/50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field
            label="Ativo"
            hint={
              loadFailed
                ? 'Não foi possível carregar a lista de ativos. Você ainda pode salvar sem vincular um ativo.'
                : 'Opcional. Deixe em "Sem ativo vinculado" para não associar nenhum.'
            }
          >
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled || loading}
              >
                <option value="">Sem ativo vinculado</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name ? `${asset.symbol} — ${asset.name}` : asset.symbol}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <ActionButton
          variant="secondary"
          onClick={() => setCreating((open) => !open)}
          aria-expanded={creating}
          disabled={disabled}
          className="shrink-0"
        >
          {creating ? 'Cancelar novo ativo' : 'Novo ativo'}
        </ActionButton>
      </div>

      {creating ? (
        <NewAssetPanel
          disabled={disabled}
          onCreated={(id) => {
            onChange(id);
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}

interface AssetForm {
  symbol: string;
  type: MarketAssetType;
  exchange: string;
  name: string;
}

function NewAssetPanel({ onCreated, disabled }: { onCreated: (id: string) => void; disabled: boolean }) {
  const toast = useToast();
  const createAsset = useCreateMarketAssetMutation();
  const [form, setForm] = useState<AssetForm>({ symbol: '', type: 'stock', exchange: '', name: '' });
  const [errors, setErrors] = useState<Partial<Record<'symbol' | 'exchange', string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const busy = createAsset.isPending || disabled;

  async function handleCreate() {
    setSubmitError(null);
    const nextErrors: Partial<Record<'symbol' | 'exchange', string>> = {};
    if (!form.symbol.trim()) nextErrors.symbol = 'Informe o código do ativo.';
    if (!form.exchange.trim()) nextErrors.exchange = 'Informe a bolsa ou corretora do ativo.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const asset = await createAsset.mutateAsync({
        symbol: form.symbol.trim().toUpperCase(),
        type: form.type,
        exchange: form.exchange.trim(),
        name: form.name.trim() ? form.name.trim() : null,
      });
      onCreated(asset.id);
    } catch (error) {
      setSubmitError(errorMessage(error));
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-layer01 p-3">
      <p className="text-sm font-semibold text-foreground">Cadastrar um ativo</p>
      {submitError ? (
        <p role="alert" className="text-sm font-medium text-danger-text">
          {submitError}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código" required error={errors.symbol}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={form.symbol}
              onChange={(e) => setForm((c) => ({ ...c, symbol: e.target.value }))}
              disabled={busy}
              autoComplete="off"
              placeholder="Ex.: PETR4"
            />
          )}
        </Field>

        <Field label="Tipo do ativo" required>
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={form.type}
              onChange={(e) => setForm((c) => ({ ...c, type: e.target.value as MarketAssetType }))}
              disabled={busy}
            >
              {MARKET_ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {INVESTMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Bolsa" required error={errors.exchange}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={form.exchange}
              onChange={(e) => setForm((c) => ({ ...c, exchange: e.target.value }))}
              disabled={busy}
              autoComplete="off"
              placeholder="Ex.: B3"
            />
          )}
        </Field>

        <Field label="Nome" hint="Opcional.">
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              disabled={busy}
              autoComplete="off"
              placeholder="Ex.: Petrobras PN"
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end">
        <ActionButton onClick={handleCreate} loading={createAsset.isPending} disabled={busy}>
          Cadastrar ativo
        </ActionButton>
      </div>
    </div>
  );
}
