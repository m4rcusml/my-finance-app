'use client';

import type { CreateGoalRequest, Goal, UpdateGoalRequest } from '@finance/contracts';
import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';
import { useToast } from '@/shared/ui/toast';

/**
 * Goal mutations.
 *
 * Goals are self-contained in V1 — the dashboard does not read them and no
 * balance depends on them — so invalidating the `goals` subtree is the whole
 * blast radius. Errors propagate to the caller on purpose: the form awaits the
 * promise, stays open and renders the message inline.
 */

export function useCreateGoalMutation(): UseMutationResult<Goal, unknown, CreateGoalRequest> {
  const s = useSessionKey();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (body: CreateGoalRequest) => goalsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all(s) });
      toast.success('Meta criada.');
    },
  });
}

export function useUpdateGoalMutation(): UseMutationResult<Goal, unknown, { id: string; body: UpdateGoalRequest }> {
  const s = useSessionKey();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateGoalRequest }) => goalsApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all(s) });
      toast.success('Meta atualizada.');
    },
  });
}

/**
 * The "atualizar valor atual" shortcut. It is a distinct hook from the general
 * update only so it can carry its own, more specific success message.
 */
export function useUpdateGoalAmountMutation(): UseMutationResult<Goal, unknown, { id: string; currentAmount: number }> {
  const s = useSessionKey();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, currentAmount }: { id: string; currentAmount: number }) =>
      goalsApi.update(id, { currentAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all(s) });
      toast.success('Valor atual atualizado.');
    },
  });
}

export function useDeleteGoalMutation(): UseMutationResult<void, unknown, string> {
  const s = useSessionKey();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => goalsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all(s) });
      toast.success('Meta excluída.');
    },
  });
}
