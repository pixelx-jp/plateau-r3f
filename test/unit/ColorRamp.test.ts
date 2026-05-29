import { describe, it, expect } from 'vitest';
import { compileRamp, parseColor } from '../../src/style/ColorRamp';

describe('ColorRamp', () => {
  it('linear interpolates between stops', () => {
    const r = compileRamp({
      type: 'linear',
      stops: [
        { value: 0, color: '#000000' },
        { value: 10, color: '#ffffff' },
      ],
      missing: '#ff0000',
    });
    const at5 = r.evaluate(5);
    expect(at5[0]).toBeGreaterThan(100);
    expect(at5[0]).toBeLessThan(155);
  });

  it('linear clamps to endpoints', () => {
    const r = compileRamp({
      type: 'linear',
      stops: [
        { value: 0, color: '#000000' },
        { value: 1, color: '#ffffff' },
      ],
    });
    expect(r.evaluate(-5)).toEqual([0, 0, 0, 255]);
    expect(r.evaluate(2)[0]).toBe(255);
  });

  it('linear returns missing for null/non-number', () => {
    const r = compileRamp({
      type: 'linear',
      stops: [{ value: 0, color: '#000000' }],
      missing: '#ff0000',
    });
    expect(r.evaluate(null)).toEqual([255, 0, 0, 0]);
  });

  it('categorical maps known keys', () => {
    const r = compileRamp({
      type: 'categorical',
      categories: { RC: '#000000', W: '#ffffff' },
      missing: '#888888',
    });
    expect(r.evaluate('RC')).toEqual([0, 0, 0, 255]);
    expect(r.evaluate('W')).toEqual([255, 255, 255, 255]);
    // missing entries get the missing color (alpha=0)
    expect(r.evaluate('unknown')[3]).toBe(0);
  });

  it('parseColor maps endpoints', () => {
    expect(parseColor('#ff0000')).toEqual([255, 0, 0, 255]);
    expect(parseColor('#000000')).toEqual([0, 0, 0, 255]);
    expect(parseColor('#ffffff')).toEqual([255, 255, 255, 255]);
  });
});
