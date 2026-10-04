// Optional local decision label. Not a Jev schema and not wired to JevGPT or SelfJev.
export function localDecision(state) {
  return { source: "local-audit", jev: false, schema: null, state: state || null };
}
