import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { extractPageContentFromFile } from '../src/transform/page-static-extractor.ts';

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(currentDir, 'fixtures/page-static-sample.html');

describe('extractPageContentFromFile', () => {
  it('pulls text, styles and images from local html', () => {
    const extracted = extractPageContentFromFile(fixturePath, {
      resourceDir: resolve(currentDir, 'fixtures'),
    });

    expect(extracted.title).toBe('Prototype Demo Page');
    expect(extracted.pageText).toMatch(/\[Page Title\]\nPrototype Demo Page/);
    expect(extracted.pageText).toMatch(/Main Heading/);
    expect(extracted.pageText).toMatch(/Body copy & helper text/);

    expect(extracted.designInfo.textColors[0]).toEqual(['#112233', 1]);
    expect(extracted.designInfo.bgColors[0]).toEqual(['rgb(250, 250, 250)', 1]);
    expect(extracted.designInfo.fontSpecs.some(([value]) => value === '20px|700|#112233')).toBe(true);
    expect(extracted.designInfo.images.some((image) => image.src === '/images/banner.png' && image.type === 'bg')).toBe(
      true,
    );
    expect(
      extracted.designInfo.images.some(
        (image) =>
          image.src === 'images/avatar.png' &&
          image.type === 'img' &&
          image.w === '48' &&
          image.h === '48',
      ),
    ).toBe(true);
  });
});
