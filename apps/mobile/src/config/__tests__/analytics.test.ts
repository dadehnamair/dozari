import { describe, expect, it } from 'vitest';
import { analyticsFrom } from '../analytics';

describe('analytics settings', () => {
  it('needs an https script and a plain site id', () => {
    expect(analyticsFrom({ 'analytics.script_url': 'https://stats.example.ir/script.js', 'analytics.site_id': 'abcd-1234' })).toEqual({ scriptUrl: 'https://stats.example.ir/script.js', siteId: 'abcd-1234' });
    expect(analyticsFrom({})).toBeNull();
    expect(analyticsFrom({ 'analytics.script_url': 'http://x/script.js', 'analytics.site_id': 'abcd' })).toBeNull();
    expect(analyticsFrom({ 'analytics.script_url': 'https://x/s.js', 'analytics.site_id': '"><script>' })).toBeNull();
  });
});
