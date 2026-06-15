import { sanitizeSurveyId, toHipsCacheBase } from '../tile-protocol-url';

describe('tile-protocol-url', () => {
  describe('sanitizeSurveyId', () => {
    it('leaves already-safe ids untouched', () => {
      expect(sanitizeSurveyId('dss')).toBe('dss');
      expect(sanitizeSurveyId('dss2-red')).toBe('dss2-red');
      expect(sanitizeSurveyId('gaia-density')).toBe('gaia-density');
    });

    it('replaces path separators and unsafe characters with underscores', () => {
      expect(sanitizeSurveyId('P/DSS2/color')).toBe('P_DSS2_color');
      expect(sanitizeSurveyId('a b!c')).toBe('a_b_c');
      expect(sanitizeSurveyId('CDS/P/2MASS/J')).toBe('CDS_P_2MASS_J');
    });

    it('keeps dots, dashes and underscores', () => {
      expect(sanitizeSurveyId('survey_1.2-beta')).toBe('survey_1.2-beta');
    });
  });

  describe('toHipsCacheBase', () => {
    it('produces a base ending in the sanitized /h/{id}/ path (trailing slash)', () => {
      expect(toHipsCacheBase('dss')).toMatch(/\/h\/dss\/$/);
      expect(toHipsCacheBase('P/DSS2/color')).toMatch(/\/h\/P_DSS2_color\/$/);
    });

    it('uses the hipscache scheme origin', () => {
      // Either the http.localhost (Windows/Android) or scheme://localhost form.
      expect(toHipsCacheBase('dss')).toMatch(
        /^(http:\/\/hipscache\.localhost|hipscache:\/\/localhost)\/h\/dss\/$/
      );
    });
  });
});
