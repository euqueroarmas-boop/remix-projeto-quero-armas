# Por que o checklist do Pedro pede de novo a rotina de risco

## O que a verificação mostrou

No banco, o registro de efetiva necessidade do Pedro (processo `b86f3f43…`) está assim:

```text
relato_cliente ....... 1.204 caracteres  (salvo)
narrativa_gerada ..... 3.289 caracteres  (gerada)
contexto_risco ....... 0 caracteres      (VAZIO)
```

Por isso a tela do admin mostra "CONTEXTO DE RISCO (PROFISSÃO / ROTINA) — —" e o passo
"Rotina de risco" volta para a fila: ele só é considerado concluído quando
`contexto_risco` tem conteúdo. Ou seja, ele digitou, mas o texto não permaneceu no banco.

## O furo

O componente da efetiva necessidade é montado **mais de uma vez ao mesmo tempo** e é
**remontado** toda vez que a fila do pop-up guiado é recalculada:

- cada passo pendente vira um item da fila e renderiza a sua própria instância do
  componente, além de uma instância genérica para o documento;
- cada instância carrega o registro do banco e guarda o texto em estado local;
- logo após carregar, o autosave dispara e grava o valor do **estado local** na coluna,
  sem comparar com o que já existe no banco.

Consequência: uma instância que carregou `contexto_risco` vazio grava `""` por cima do
texto recém-salvo por outra instância. O relato não sofreu o mesmo destino porque já
estava preenchido quando as instâncias carregaram — o vazio só sobrescreve o que foi
digitado depois da carga. E, quando o cliente avança antes dos 800 ms do autosave, a
desmontagem cancela o timer e o texto se perde de vez.

## Correção proposta

1. **Autosave que nunca apaga**: guardar o valor carregado do banco e só gravar quando o
   texto realmente mudou em relação a ele. Bloquear gravação de string vazia sobre
   conteúdo existente.
2. **Flush antes de sair**: gravar o texto pendente no `unmount` e ao avançar de passo,
   sem depender apenas do debounce de 800 ms e do `onBlur`.
3. **Uma instância por processo**: manter montada apenas a instância do passo ativo,
   eliminando as gravações concorrentes.
4. **Mesma blindagem para os outros campos** do registro (`relato_cliente`, `texto_bo`,
   `narrativa_final`), hoje sujeitos ao mesmo risco.

## Sobre o dado do Pedro

O texto antigo não é recuperável — foi sobrescrito por vazio e não há histórico dessa
coluna. Depois da correção, ele digita uma vez e o passo fecha. Posso incluir também um
log de alterações da efetiva necessidade para tornar sobrescritas assim rastreáveis.

## Detalhes técnicos

- `src/components/quero-armas/portal/EfetivaNecessidadeModal.tsx` — `salvarTexto`,
  efeitos de debounce de `relato`/`contexto`, carga inicial.
- `src/lib/quero-armas/efetivaNecessidadePassos.ts` — `concluido("contexto")` depende de
  `contexto_risco.length > 0`; a regra permanece.
- `src/pages/quero-armas/QAClientePortalPage.tsx` — montagem por passo (~linha 2095) e
  montagem genérica (~linha 2142).