import path from 'path';
import { isUuid } from './id';

export function resolveTenantPdfPath(baseDir: string, tenantId: string, fileId: string): string | null {
  if (!isUuid(tenantId) || !isUuid(fileId)) {
    return null;
  }

  const tenantRoot = path.resolve(baseDir, tenantId);
  const resolved = path.resolve(tenantRoot, `${fileId}.pdf`);
  return resolved.startsWith(`${tenantRoot}${path.sep}`) ? resolved : null;
}