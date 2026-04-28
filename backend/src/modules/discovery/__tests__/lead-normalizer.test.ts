import { describe, expect, it } from 'vitest';
import { leadNormalizer } from '../normalization/lead-normalizer';

describe('leadNormalizer', () => {
  it('normaliza username e urls do perfil do instagram', () => {
    const normalized = leadNormalizer.fromInstagramProfile({
      username: '@ClosrAgency',
      fullName: '  Closr   Agency ',
      biography: '  Leads  e  growth ',
      externalUrl: 'closr.dev',
      followers: 1200,
      profilePicUrl: 'https://cdn.example.com/pic.jpg',
      profileUrl: 'https://instagram.com/ClosrAgency/',
      source: 'instagram_public_profile',
    });

    expect(normalized.username).toBe('closragency');
    expect(normalized.normalizedUsername).toBe('closragency');
    expect(normalized.fullName).toBe('Closr Agency');
    expect(normalized.biography).toBe('Leads e growth');
    expect(normalized.externalUrl).toBe('https://closr.dev');
    expect(normalized.profileUrl).toBe('https://instagram.com/ClosrAgency');
  });
});
