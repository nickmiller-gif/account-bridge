/** Demo-only consumer identity — never use when `demoMode` is false. */
export function resolveDemoConsumerUser(req: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const auth = String(req.headers.authorization ?? '');
  if (auth.startsWith('Bearer ') && !auth.startsWith('Bearer ab_sk_') && !auth.startsWith('Bearer ab_host_')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token.length >= 8 && token.length <= 512) return token;
  }
  const demo = req.headers['x-demo-user'];
  if (typeof demo === 'string') {
    const trimmed = demo.trim();
    if (trimmed.length >= 1 && trimmed.length <= 128) return trimmed;
  }
  return null;
}
