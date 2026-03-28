GRANT EXECUTE ON FUNCTION get_damaged_products() TO authenticated, service_role, anon;
NOTIFY pgrst, 'reload schema';
