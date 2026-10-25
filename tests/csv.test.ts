import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../src/lib/csv';
import { slugify } from '../src/lib/format';

describe('csv export', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
  });
  it('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=HYPERLINK("http://evil")').startsWith('"\'=')).toBe(true);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
  it('handles null and numbers', () => {
    expect(toCsv([[null, 5, 'ok']])).toBe(',5,ok');
  });
});

describe('slugify', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('Neon Garage — Night #2!')).toBe('neon-garage-night-2');
    expect(slugify('!!!')).toBe('wallpaper');
  });
});
