
-- Allow admins/advogados to DELETE documents
CREATE POLICY "qa_docs_auth_delete" ON public.qa_documentos_conhecimento
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM qa_usuarios_perfis p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.perfil IN ('administrador', 'advogado')
  )
);

-- Allow admins/advogados to DELETE chunks
CREATE POLICY "qa_chunks_auth_delete" ON public.qa_chunks_conhecimento
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM qa_usuarios_perfis p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.perfil IN ('administrador', 'advogado')
  )
);

-- Allow admins/advogados to DELETE embeddings
CREATE POLICY "qa_embeddings_auth_delete" ON public.qa_embeddings
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM qa_usuarios_perfis p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.perfil IN ('administrador', 'advogado')
  )
);

-- Allow admins/advogados to DELETE preferential references
CREATE POLICY "qa_refs_pref_delete" ON public.qa_referencias_preferenciais
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM qa_usuarios_perfis p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.perfil IN ('administrador', 'advogado')
  )
);
