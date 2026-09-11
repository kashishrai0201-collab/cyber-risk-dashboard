import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  apiHealth,
  apiAssets,
  apiEnterprise,
  apiLossExceedance,
  apiDataLineageFlows,
  apiOptimizeBudget,
  apiCompliance,
  apiHistory,
  apiSeed,
} from '../client'
import type { BudgetOptimizationRequest } from '../types'

// Query key constants
export const QK = {
  health: ['health'] as const,
  assets: ['assets'] as const,
  enterprise: ['enterprise'] as const,
  lossExceedance: ['lossExceedance'] as const,
  lineage: ['lineage'] as const,
  compliance: ['compliance'] as const,
  history: ['history'] as const,
  optimize: (budget: number) => ['optimize', budget] as const,
}

export function useHealth() {
  return useQuery({
    queryKey: QK.health,
    queryFn: apiHealth,
    retry: 1,
    refetchInterval: 30_000, // re-check every 30s
  })
}

export function useAssets() {
  return useQuery({
    queryKey: QK.assets,
    queryFn: apiAssets,
    staleTime: 3 * 60 * 1000,
  })
}

export function useEnterprise() {
  return useQuery({
    queryKey: QK.enterprise,
    queryFn: apiEnterprise,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLossExceedance() {
  return useQuery({
    queryKey: QK.lossExceedance,
    queryFn: apiLossExceedance,
    staleTime: 5 * 60 * 1000,
  })
}

export function useDataLineage() {
  return useQuery({
    queryKey: QK.lineage,
    queryFn: apiDataLineageFlows,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCompliance() {
  return useQuery({
    queryKey: QK.compliance,
    queryFn: apiCompliance,
    staleTime: 5 * 60 * 1000,
  })
}

export function useHistory() {
  return useQuery({
    queryKey: QK.history,
    queryFn: apiHistory,
    staleTime: 2 * 60 * 1000,
  })
}

export function useOptimize(budget: number, enabled: boolean) {
  return useQuery({
    queryKey: QK.optimize(budget),
    queryFn: () => apiOptimizeBudget({ budget_inr: budget }),
    enabled,
    staleTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

export function useSeedMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: apiSeed,
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}
