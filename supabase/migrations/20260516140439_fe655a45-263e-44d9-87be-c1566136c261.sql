-- Rename old enum type
ALTER TYPE neighborhood RENAME TO neighborhood_old;

-- Create new enum with Berlin neighborhood values
CREATE TYPE neighborhood AS ENUM (
  'Mitte',
  'Prenzlauer Berg',
  'Friedrichshain',
  'Kreuzberg',
  'Neukölln',
  'Tempelhof',
  'Schöneberg',
  'Charlottenburg',
  'Marzahn',
  'Spandau',
  'Pankow',
  'Lichtenberg'
);

-- Update events table column to use the new enum
ALTER TABLE events ALTER COLUMN neighborhood TYPE neighborhood USING neighborhood::text::neighborhood;

-- Drop the old enum type
DROP TYPE neighborhood_old;