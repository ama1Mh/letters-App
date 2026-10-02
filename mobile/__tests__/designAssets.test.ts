import { DESIGN_CATALOG, ELEMENT_TYPES } from '@/domain/design';
import { ELEMENT_IMAGES, PAPER_TEXTURES } from '@/features/designs/designAssets';

describe('design assets', () => {
  it('has a texture for every paper and an image for every element in the catalog', () => {
    for (const paper of DESIGN_CATALOG.papers) expect(PAPER_TEXTURES[paper.key]).toBeDefined();
    for (const type of ELEMENT_TYPES) {
      for (const entry of DESIGN_CATALOG.elements[type]) {
        expect(ELEMENT_IMAGES[entry.key]).toBeDefined();
      }
    }
  });

  it('has no artwork for keys the catalog does not know', () => {
    const known = new Set([
      ...DESIGN_CATALOG.papers.map((p) => p.key),
      ...ELEMENT_TYPES.flatMap((t) => DESIGN_CATALOG.elements[t].map((e) => e.key)),
    ]);
    for (const key of [...Object.keys(PAPER_TEXTURES), ...Object.keys(ELEMENT_IMAGES)]) {
      expect(known.has(key)).toBe(true);
    }
  });
});
