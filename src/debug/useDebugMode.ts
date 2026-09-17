export function useDebugMode(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1'
}
