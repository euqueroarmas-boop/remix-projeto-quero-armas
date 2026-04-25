-- Liberar registros travados em 'gerando' para nova tentativa
UPDATE qa_armamentos_catalogo SET imagem_status = 'pendente' WHERE imagem_status = 'gerando' AND imagem IS NULL;