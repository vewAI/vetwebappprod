-- Strip owner names from owner_background field in all cases
-- Persona names should come from case_personas table, not from case record fields

-- This script removes:
-- 1. "Role: <Name>" lines
-- 2. "Name: <Name>" lines  
-- 3. Common name patterns like "I am <Name>", "My name is <Name>"

-- Preview what will be changed (run this first to verify)
-- SELECT id, title, 
--   owner_background,
--   regexp_replace(
--     regexp_replace(
--       regexp_replace(
--         regexp_replace(owner_background, E'^Role:\\s*.+$', '', 'gim'),
--         E'^Name:\\s*.+$', '', 'gim'
--       ),
--       E'\\m(I am|I''m|My name is|Call me)\\s+[A-Z][a-z]+(\\s+[A-Z][a-z]+)*', 'I am the owner', 'gi'
--     ),
--     E'\n{3,}', E'\n\n', 'g'
--   ) as cleaned_background
-- FROM cases
-- WHERE owner_background IS NOT NULL AND owner_background != '';

-- Actually update the records
UPDATE cases
SET owner_background = trim(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(owner_background, E'^Role:\\s*.+$', '', 'gim'),
        E'^Name:\\s*.+$', '', 'gim'
      ),
      E'\\m(I am|I''m|My name is|Call me)\\s+[A-Z][a-z]+(\\s+[A-Z][a-z]+)*', 'I am the owner', 'gi'
    ),
    E'\n{3,}', E'\n\n', 'g'
  )
)
WHERE owner_background IS NOT NULL AND owner_background != '';

-- Report how many rows were updated
-- SELECT COUNT(*) as cases_updated FROM cases WHERE owner_background IS NOT NULL;
