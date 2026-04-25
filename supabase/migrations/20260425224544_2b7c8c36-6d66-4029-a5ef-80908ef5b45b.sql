UPDATE public.qa_armamentos_catalogo
SET imagem = 'https://ogkltfqvzweeqkfmrzts.supabase.co/storage/v1/object/public/qa-armamentos/a99d2d28-0225-4b62-b5b0-2385ce2c71de.png?v=' || extract(epoch from now())::bigint
WHERE id = 'a99d2d28-0225-4b62-b5b0-2385ce2c71de';