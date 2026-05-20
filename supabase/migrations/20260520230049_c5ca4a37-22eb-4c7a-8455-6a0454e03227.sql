
-- Create new enum
CREATE TYPE public.neighborhood_new AS ENUM (
  'Mitte',
  'Friedrichshain-Kreuzberg',
  'Pankow',
  'Charlottenburg-Wilmersdorf',
  'Spandau',
  'Steglitz-Zehlendorf',
  'Tempelhof-Schöneberg',
  'Neukölln',
  'Treptow-Köpenick',
  'Marzahn-Hellersdorf',
  'Lichtenberg',
  'Reinickendorf'
);

-- Alter events.neighborhood column to use new enum with mapping
ALTER TABLE public.events
  ALTER COLUMN neighborhood TYPE public.neighborhood_new
  USING (
    CASE neighborhood::text
      WHEN 'Mitte' THEN 'Mitte'
      WHEN 'Prenzlauer Berg' THEN 'Pankow'
      WHEN 'Friedrichshain' THEN 'Friedrichshain-Kreuzberg'
      WHEN 'Kreuzberg' THEN 'Friedrichshain-Kreuzberg'
      WHEN 'Neukölln' THEN 'Neukölln'
      WHEN 'Tempelhof' THEN 'Tempelhof-Schöneberg'
      WHEN 'Schöneberg' THEN 'Tempelhof-Schöneberg'
      WHEN 'Charlottenburg' THEN 'Charlottenburg-Wilmersdorf'
      WHEN 'Marzahn' THEN 'Marzahn-Hellersdorf'
      WHEN 'Spandau' THEN 'Spandau'
      WHEN 'Pankow' THEN 'Pankow'
      WHEN 'Lichtenberg' THEN 'Lichtenberg'
      ELSE 'Mitte'
    END
  )::public.neighborhood_new;

-- Drop the old enum and rename the new one
DROP TYPE public.neighborhood;
ALTER TYPE public.neighborhood_new RENAME TO neighborhood;
