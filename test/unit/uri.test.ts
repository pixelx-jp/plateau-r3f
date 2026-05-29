import { describe, it, expect } from 'vitest';
import { joinUrl, normalizeTileContentUri } from '../../src/utils/uri';

describe('uri utils', () => {
  it('joinUrl combines paths', () => {
    expect(joinUrl('https://h/a/', 'b/c')).toBe('https://h/a/b/c');
    expect(joinUrl('https://h/a', '/b/c')).toBe('https://h/a/b/c');
  });

  it('joinUrl passes through absolute', () => {
    expect(joinUrl('https://h/a/', 'https://x/y')).toBe('https://x/y');
  });

  it('normalizeTileContentUri strips tileset base', () => {
    const got = normalizeTileContentUri(
      '15/29102/4943_bldg_Building.glb',
      'https://cdn/out_chiyoda/3dtiles/tileset.json',
    );
    expect(got).toBe('15/29102/4943_bldg_Building.glb');
  });

  it('normalizeTileContentUri strips query and fragment', () => {
    const got = normalizeTileContentUri(
      '15/29102/x.glb?v=1#hash',
      'https://cdn/out_chiyoda/3dtiles/tileset.json',
    );
    expect(got).toBe('15/29102/x.glb');
  });
});
