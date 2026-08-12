# Correção definitiva da falsa validade do CCMEI

## Diagnóstico confirmado

O CCMEI do Fábio está sendo reconhecido corretamente pelo parser local e atende à regra de aprovação por nome, CPF e situação cadastral ATIVA.

A reprovação atual não vem da classificação nem do banco. Ela ocorre no formulário, antes de salvar:

- ao trocar/anexar um arquivo, o estado anterior de `data_emissao` e `data_validade` não é zerado;
- o bloco específico do CCMEI atualiza tipo, CNPJ e dados empresariais, mas mantém os demais valores anteriores com `...prev`;
- a trava genérica `docExpirado` considera qualquer `form.data_validade`, mesmo quando o tipo é um documento constitutivo sem vencimento;
- por isso a data residual **09/08/2026** produz o carimbo “REPROVADO — VENCIDO”, embora CCMEI não tenha validade;
- nenhum CCMEI foi gravado para o Fábio, confirmando que a rejeição ocorreu antes da persistência.

## Correção

1. **Limpar estado residual ao anexar outro documento**
   - Zerar datas e demais campos específicos do arquivo anterior no início de uma nova leitura.
   - Preservar apenas o contexto necessário do slot/checklist aberto.

2. **Blindagem explícita do CCMEI**
   - No resultado do parser CCMEI, definir `data_emissao` e `data_validade` como vazias, sem herdar `prev`.
   - Tratar CCMEI, contrato social e requerimento/ficha da Junta como sem datas em qualquer caminho de leitura, inclusive fallback de IA.

3. **Corrigir a trava de vencimento**
   - `docExpirado` só poderá ser verdadeiro para tipos que realmente exigem validade.
   - Documentos constitutivos nunca exibirão alerta/carimbo de vencimento, mesmo se algum estado ou dado legado trouxer uma data.

4. **Persistência segura**
   - Ao salvar documento constitutivo, enviar `data_emissao = null` e `data_validade = null`.
   - Manter a gravação já preparada de nome, CPF, situação, CNPJ, razão social, CNAE e ocupação principal.

5. **Regressão e validação**
   - Testar troca de um documento vencido para um CCMEI dentro do mesmo modal.
   - Confirmar que o CCMEI do Fábio recebe aprovação por nome + CPF + ATIVA e é salvo sem datas.
   - Confirmar que Cartão CNPJ e QSA continuam com 30 dias e que documentos realmente vencidos continuam sendo rejeitados.
   - Validar no fluxo móvel do Hub Documental e conferir o registro persistido no banco.

## Escopo técnico

Ajuste focado no estado, cálculo de vencimento e payload de `ClienteDocsHubModal.tsx`, com testes de regressão das regras de ocupação lícita. Nenhuma tabela nova e nenhuma alteração nas regras estáveis de outros documentos.
