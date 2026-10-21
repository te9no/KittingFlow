import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { X509Certificate, createHash } from 'node:crypto';

export function tlsFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'kittingflow-tls-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'psmodulepath'));
  execFileSync('powershell.exe', ['-NoProfile', '-File', resolve('scripts/setup-public-bridge.ps1'), '-SiteOrigin', 'https://kittingflow-test.example', '-OutputDirectory', directory], { stdio: 'pipe', env });
  const cert = new X509Certificate(readFileSync(join(directory, 'loopback.cer')));
  return {
    tls: { pfx: readFileSync(join(directory, 'loopback.pfx')), passphrase: '' },
    ca: cert.toString(),
    spki: createHash('sha256').update(cert.publicKey.export({ type: 'spki', format: 'der' })).digest('base64')
  };
}
