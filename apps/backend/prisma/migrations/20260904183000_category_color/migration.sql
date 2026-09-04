ALTER TABLE "categories" ADD COLUMN "color" VARCHAR(7);
ALTER TABLE "categories" ADD CONSTRAINT "categories_color_hex_check"
  CHECK ("color" IS NULL OR "color" ~ '^#[0-9a-fA-F]{6}$');
