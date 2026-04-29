import { describe, expect, it } from 'vitest';
import { extractInstagramProfileUrl } from '../providers/instagram-url.extractor';

describe('extractInstagramProfileUrl', () => {
  it('normaliza url de perfil para formato canonico sem barra final', () => {
    const extracted = extractInstagramProfileUrl('https://instagram.com/Closr.Agency/');

    expect(extracted).toEqual({
      username: 'closr.agency',
      profileUrl: 'https://www.instagram.com/closr.agency',
    });
  });

  it('ignora rotas nao relacionadas a perfil', () => {
    expect(extractInstagramProfileUrl('https://www.instagram.com/reel/ABC123')).toBeNull();
    expect(extractInstagramProfileUrl('https://www.instagram.com/p/ABC123')).toBeNull();
    expect(extractInstagramProfileUrl('https://www.instagram.com/stories/user/1')).toBeNull();
    expect(extractInstagramProfileUrl('https://www.instagram.com/explore/tags/marketing')).toBeNull();
    expect(extractInstagramProfileUrl('https://www.instagram.com/tv/ABC123')).toBeNull();
  });
});
