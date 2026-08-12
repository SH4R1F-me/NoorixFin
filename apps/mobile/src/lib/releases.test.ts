import { compareVersions } from './releases';

describe('mobile version floor', () => {
  it('compares semantic version segments numerically', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.1.9', '1.2.0')).toBeLessThan(0);
  });

  it('ignores prerelease labels when enforcing the numeric safety floor', () => {
    expect(compareVersions('2.0.0-beta.1', '2.0.0')).toBe(0);
  });
});
