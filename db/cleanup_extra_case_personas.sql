-- Cleanup script: Remove extra case_personas rows
-- Each case should only have ONE owner and ONE veterinary-nurse persona
-- This removes rows with role_key values that shouldn't exist

-- Preview what will be deleted (run this first to check)
SELECT id, case_id, role_key, display_name 
FROM case_personas 
WHERE role_key NOT IN ('owner', 'veterinary-nurse');

-- Delete the extra personas (lab-technician, producer, professor, veterinary-assistant, veterinarian)
-- Uncomment the following to execute:

-- DELETE FROM case_personas 
-- WHERE role_key NOT IN ('owner', 'veterinary-nurse');

-- After cleanup, verify each case has at most 2 personas:
-- SELECT case_id, COUNT(*) as persona_count 
-- FROM case_personas 
-- GROUP BY case_id 
-- ORDER BY persona_count DESC;
