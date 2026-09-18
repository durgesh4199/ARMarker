// Reads ?filterMinCF=&filterBeta= so MindAR's pose-smoothing filter (see
// ARStage's ARStageStartOptions doc comment) can be tuned live from a
// phone, without a redeploy per guess.
export function useFilterParams() {
  const params = new URLSearchParams(window.location.search)
  const minCF = params.get('filterMinCF')
  const beta = params.get('filterBeta')
  return {
    filterMinCF: minCF !== null ? Number(minCF) : undefined,
    filterBeta: beta !== null ? Number(beta) : undefined,
  }
}
