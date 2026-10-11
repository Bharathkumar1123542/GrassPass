export const CURRENT_SCHEMA_VERSION = 1;

export function migrate(raw: Record<string, unknown>, fromVersion: number, toVersion: number = CURRENT_SCHEMA_VERSION): Record<string, unknown> {
  if (fromVersion === toVersion) {
    return raw;
  }

  if (fromVersion < 0 || toVersion < 0) {
    throw new Error('Schema version must be non-negative.');
  }

  if (fromVersion === 1 && toVersion === 1) {
    return raw;
  }

  if (fromVersion !== 1 && toVersion === 1) {
    throw new Error(`Unsupported migration from v${fromVersion} to v${toVersion}.`);
  }

  throw new Error(`Unsupported schema migration from v${fromVersion} to v${toVersion}.`);
}
