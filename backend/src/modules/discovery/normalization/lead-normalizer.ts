import { InstagramProfileExtracted, NormalizedLeadInput } from '../types';
import { normalizeUrl } from '../discovery.utils';

function normalizeUsername(raw: string): string {
  return String(raw || '').trim().replace(/^@/, '').toLowerCase();
}

function normalizeText(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

export const leadNormalizer = {
  normalizeUsername,

  fromInstagramProfile(profile: InstagramProfileExtracted): NormalizedLeadInput {
    const normalizedUsername = normalizeUsername(profile.username);

    return {
      username: normalizedUsername,
      normalizedUsername,
      fullName: normalizeText(profile.fullName) || normalizedUsername,
      biography: normalizeText(profile.biography),
      externalUrl: normalizeUrl(profile.externalUrl),
      followers: profile.followers,
      profilePicUrl: normalizeUrl(profile.profilePicUrl),
      profileUrl: normalizeUrl(profile.profileUrl),
      source: profile.source,
    };
  },
};
