-- Force schema cache reload
NOTIFY pgrst, 'reload schema';

-- Verify function existence (just to be sure)
SELECT proname, proargnames 
FROM pg_proc 
WHERE proname = 'get_damaged_products';
