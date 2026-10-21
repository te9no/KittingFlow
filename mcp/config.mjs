import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function bridgeOptions(env = process.env) {
  const configPath = env.KITTINGFLOW_CONFIG || join(env.LOCALAPPDATA || join(homedir(), '.config'), 'KittingFlow', 'bridge.json');
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '')) : {};
  const port = Number(env.KITTINGFLOW_BRIDGE_PORT || config.port || 17321);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid bridge port');
  const options = { port };
  const origins = env.KITTINGFLOW_ALLOWED_ORIGINS ? env.KITTINGFLOW_ALLOWED_ORIGINS.split(',') : config.origins;
  if (origins) {
    if (!Array.isArray(origins) || !origins.length) throw Error('Origins must be a nonempty array');
    options.origins = origins.map(value => {
      const url = new URL(value.trim());
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.origin !== value.trim()) throw Error('Use an exact HTTP(S) origin');
      return url.origin;
    });
  }
  const pfxPath = env.KITTINGFLOW_TLS_PFX || config.pfxPath;
  if (pfxPath) options.tls = { pfx: readFileSync(pfxPath), passphrase: env.KITTINGFLOW_TLS_PASSPHRASE || '' };
  if (options.origins?.some(origin => origin.startsWith('https:')) && !options.tls) throw Error('HTTPS origins require a TLS certificate. Run scripts/setup-public-bridge.ps1.');
  return options;
}
