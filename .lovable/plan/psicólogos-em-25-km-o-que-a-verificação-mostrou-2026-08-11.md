# Psicólogos em 25 km: o que a verificação mostrou

## Resultado da checagem (feita agora, sem alterar nada)

Confrontei a análise anterior com o código realmente publicado em `euqueroarmas.com.br` e com os dados do Anthony. Três fatos:

1. **O botão já está no ar.** Baixei o pacote publicado do pop-up guiado e ele contém tanto a detecção tolerante (rawTipo + tipo + nome + label, sem acentos, reconhecendo `laudo_psicologico` e `aptidao_psicologica`) quanto o botão "Escolher profissional credenciado". Ou seja: a correção foi publicada.
2. **Os dados do Anthony não caem na exceção institucional.** A pendência dele é `laudo_psicologico`, nome "Laudo Psicológico". No catálogo, nenhum registro de `laudo_psicologico` tem a palavra "instituição" no nome — a única com essa palavra é o tipo separado `atestado_aptidao_psicologica_instituicao`. Então a regra que esconde o botão não é acionada nessa etapa.
3. **O print corresponde à versão anterior do código.** No código atual, quando o botão aparece a observação "Se ainda não escolheu um credenciado, use o botão de busca…" fica *dentro* da mesma caixa do botão. No print ela aparece sozinha, numa caixa isolada — exatamente o comportamento da build antiga.

**Conclusão:** não há bug de raio, nem de dados, nem etapa "engolindo" outra. O print foi tirado de uma versão em cache no navegador (bundle antigo ainda servido pelo cache do Safari), anterior à publicação atual.

## O que fazer

### Passo 1 — Confirmar na tela real (sem código)
Abrir a etapa "Laudo psicológico" do Anthony com recarga forçada (Cmd+Shift+R no Safari, ou aba anônima). Esperado: caixa bordô com a frase e o botão "Escolher profissional credenciado" logo abaixo, abrindo o modal com raio de 25 km.

Se o botão aparecer: encerrado, era cache — nada a corrigir.

### Passo 2 — Só se ainda não aparecer após recarga forçada
Aí a causa passa a ser dado do item específico, e a investigação seria: registrar em tela quais valores de `rawTipo`, `tipo`, `fallbackNome` e `label` estão chegando nessa pendência do Anthony, e ajustar a detecção conforme o que aparecer. Não faz sentido mexer no código antes disso — hoje a regra está correta para os dados que existem no banco.

### Passo 3 — Reduzir a fragilidade da regra (opcional, recomendado)
A distinção "laudo particular x laudo da instituição" hoje depende de a palavra "instituição" aparecer num texto livre digitado no catálogo. Um rename inocente no admin quebra a regra sem aviso. A correção durável é usar um campo estruturado no catálogo (`qa_servicos_documentos.regra_validacao`, que já é JSONB, com uma chave tipo `origem_exigida: institucional | particular`) e o pop-up passar a ler esse campo em vez de procurar substring. Isso é uma mudança pequena e sem risco para o fluxo atual — mas só vale a pena se você quiser blindar agora.

## Detalhes técnicos
- Verificado no bundle publicado `assets/PendenciasGuiadasPopup-*.js`: a condição `D = ... be ? (Y ? null : "psicologo") : ...` está presente, ou seja é a versão nova.
- Arquivo de origem: `src/components/quero-armas/portal/PendenciasGuiadasPopup.tsx` (linhas 429-452 e 789-811).
- Consultas usadas: `qa_processo_documentos` (pendências do Anthony) e `qa_servicos_documentos` (nomes do catálogo por serviço).
- Nada foi alterado nesta análise.
