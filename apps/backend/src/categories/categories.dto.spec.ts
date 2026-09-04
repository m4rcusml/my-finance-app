import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoryDto, ListCategoriesQueryDto, UpdateCategoryDto } from './categories.dto';

describe('Category presentation fields', () => {
  it.each(['#a78bfa', '#FF00AA', null, undefined])('accepts a hex color or cleared value: %s', async (color) => {
    expect(
      await validate(plainToInstance(CreateCategoryDto, { name: 'Moradia', type: 'expense', color })),
    ).toHaveLength(0);
  });
  it.each(['red', '#abc', 'url(https://example.com)', '#0000000', 12])('rejects invalid colors: %s', async (color) => {
    expect(await validate(plainToInstance(UpdateCategoryDto, { color }))).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'color' })]),
    );
  });
  it('validates status and bounds search length', async () => {
    const errors = await validate(
      plainToInstance(ListCategoriesQueryDto, { status: 'deleted', search: 'a'.repeat(81) }),
    );
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['status', 'search']));
  });
});
