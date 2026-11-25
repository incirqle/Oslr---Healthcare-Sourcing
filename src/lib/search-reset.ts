export const SEARCH_RESET_EVENT = "oslr:reset-talent-search";

/** Same-URL navigation does not remount a route, so explicitly announce a fresh search. */
export function requestSearchReset(): void {
  window.dispatchEvent(new CustomEvent(SEARCH_RESET_EVENT));
}
