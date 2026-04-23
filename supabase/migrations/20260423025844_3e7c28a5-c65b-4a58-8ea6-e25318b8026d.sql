INSERT INTO public.qa_usuarios_perfis (user_id, nome, email, perfil, ativo)
VALUES ('41ccd8dc-0c72-4cb9-8430-61c441fb6d28','Admin Quero Armas','eu@queroarmas.com.br','administrador',true)
ON CONFLICT (user_id) DO UPDATE SET ativo=true, perfil='administrador', nome=EXCLUDED.nome;