import { discoveryRepository } from '../repositories/discovery.repository';

export const leadDeduplicationService = {
  async existsByNormalizedUsername(tenantId: string, normalizedUsername: string): Promise<boolean> {
    const profile = await discoveryRepository.findInstagramProfileByNormalizedUsername(tenantId, normalizedUsername);
    return Boolean(profile?.leadId);
  },
};
