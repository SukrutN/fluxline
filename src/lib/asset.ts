/**
 * Prefixes a committed-asset path with the deployment base path.
 * Local dev serves from the root, GitHub Pages serves under /fluxline,
 * and this keeps one component code path correct in both.
 */
export function asset(path: string): string {
  return (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + path;
}
