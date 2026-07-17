type AlertFields = Record<string, string | number | boolean | null | undefined>;

/** Emits only operational metadata. Secrets, identifiers and credential material stay out of logs. */
export function logOperationalAlert(event: string, fields: AlertFields = {}): void {
  const safeFields = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  console.warn(JSON.stringify({ level: "warn", service: "agentid-service", event, at: new Date().toISOString(), ...safeFields }));
}
