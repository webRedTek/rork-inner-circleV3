-- Check if the function exists
SELECT routine_name, routine_type, routine_definition 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'fetch_potential_matches';

-- Check function parameters
SELECT 
    p.parameter_name,
    p.parameter_mode,
    p.data_type,
    p.parameter_default
FROM information_schema.parameters p
JOIN information_schema.routines r ON p.specific_name = r.specific_name
WHERE r.routine_schema = 'public' 
AND r.routine_name = 'fetch_potential_matches'
ORDER BY p.ordinal_position;

-- List all functions in public schema
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name; 