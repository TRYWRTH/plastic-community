-- Backfill events.neighborhood using nearest-Bezirk-centroid matching on
-- lat/lng. The previous client-side detection guessed the district from
-- street-name keywords in the address text and silently defaulted to
-- 'Mitte' whenever nothing matched, which mislabeled most events. This
-- recomputes the district from real coordinates instead.
--
-- Only touches rows that already have coordinates and are currently
-- tagged with one of the 12 Berlin Bezirke — German state values (e.g.
-- Brandenburg) are left untouched, since this only corrects *which*
-- Berlin district, not whether an event is in Berlin at all.
UPDATE public.events e
SET neighborhood = (
  SELECT d.name::public.neighborhood
  FROM (
    VALUES
      ('Mitte', 52.52, 13.405),
      ('Friedrichshain-Kreuzberg', 52.505, 13.454),
      ('Pankow', 52.569, 13.401),
      ('Charlottenburg-Wilmersdorf', 52.507, 13.291),
      ('Spandau', 52.535, 13.198),
      ('Steglitz-Zehlendorf', 52.434, 13.263),
      ('Tempelhof-Schöneberg', 52.468, 13.385),
      ('Neukölln', 52.481, 13.435),
      ('Treptow-Köpenick', 52.457, 13.573),
      ('Marzahn-Hellersdorf', 52.537, 13.573),
      ('Lichtenberg', 52.535, 13.5),
      ('Reinickendorf', 52.566, 13.3)
  ) AS d(name, lat, lng)
  ORDER BY power(e.lat - d.lat, 2) + power((e.lng - d.lng) * cos(radians(52.5)), 2)
  LIMIT 1
)
WHERE e.lat IS NOT NULL
  AND e.lng IS NOT NULL
  AND e.neighborhood IN (
    'Mitte', 'Friedrichshain-Kreuzberg', 'Pankow', 'Charlottenburg-Wilmersdorf',
    'Spandau', 'Steglitz-Zehlendorf', 'Tempelhof-Schöneberg', 'Neukölln',
    'Treptow-Köpenick', 'Marzahn-Hellersdorf', 'Lichtenberg', 'Reinickendorf'
  );
