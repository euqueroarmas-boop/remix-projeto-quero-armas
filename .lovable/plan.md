# Plano — /cadastro refinado (Jeito 3) atrás de feature flag

## Contexto crítico descoberto

`QACadastroPublicoPage.tsx` tem **3.137 linhas**. Refatorar esse arquivo para extrair hooks compartilhados (`useCadastroDocumentos`, `useCadastroPagamento`, `useCadastroCliente`) é uma operação de altíssimo risco de regressão — exatamente o que a regra inegociável proíbe. A página acumula state local entrelaçado com efeitos, validações, chamadas a edge functions, lógica de Asaas, contrato, IA e os 3 bug fixes recentes.

**Decisão recomendada (precisa do seu OK):** NÃO refatorar `QACadastroPublicoPage.tsx`. Em vez disso, criar a nova página refinada como implementação **independente paralela**, reaproveitando diretamente as **edge functions** e **utils puros já existentes** (`qaServiceCatalog`, `cadastroCompleteness`, `qaSlaCadastro`, `serviceDisplay`, `ensureClienteFromAuthUser`, `customerResolver`, `qaDocxDownload`, edge functions `qa-cliente-criar-conta-publica`, `qa-upload-documento`, `qa-extract-doc`, `qa-gerar-cobranca`, etc.). Isso garante zero risco para o fluxo legado e mantém os 3 bug fixes intactos no caminho antigo.

A alternativa (extrair hooks da página de 3137 linhas) violaria "Zero Regressão" — paro e pergunto antes de prosseguir.

## Arquivos a criar

```
src/pages/quero-armas/cadastro-refinado/
  QACadastroRefinadoPage.tsx              (orquestrador, estado das 5 etapas)
  components/
    QACadastroRefinadoHeader.tsx          (logo + tag + voltar)
    QACadastroRefinadoFooter.tsx          (selos LGPD + ICP-Brasil)
    QACadastroRefinadoStepIndicator.tsx   ("01 / 05" + 5 traços)
    QACadastroRefinadoCard.tsx            (card editorial reutilizável)
    QACadastroRefinadoShell.tsx           (layout comum a todas as etapas)
  steps/
    Etapa01Servico.tsx
    Etapa02Documentos.tsx
    Etapa03Revisao.tsx
    Etapa04Pagamento.tsx
    Etapa05Conclusao.tsx
  hooks/
    useCadastroRefinadoState.ts           (state machine local da nova página)
    useCadastroRefinadoUploads.ts         (wrapper sobre edge function de upload)
    useCadastroRefinadoExtracao.ts        (wrapper sobre edge function de IA)
    useCadastroRefinadoPagamento.ts       (wrapper sobre edge function Asaas + contrato)
  styles/
    cadastroRefinado.css                  (tokens editoriais locais ao escopo)
src/lib/quero-armas/
  cadastroRefinadoFlag.ts                 (leitura runtime da feature flag)
```

## Arquivos modificados (mínimo absoluto)

- **`src/pages/quero-armas/QARoutes.tsx`** — substituir o elemento da rota `cadastro` por um wrapper `<CadastroRouteSwitch />` que lê `VITE_QA_CADASTRO_V2_ENABLED` em runtime e renderiza `QACadastroRefinadoPage` ou `QACadastroPublicoPage`. Nenhuma outra rota é tocada.
- **`.env.example`** — documentar `VITE_QA_CADASTRO_V2_ENABLED=true`.

## Arquivos NÃO tocados (checklist de não-regressão)

- `QACadastroPublicoPage.tsx` ✋
- `qaServiceCatalog.ts`, `qaCadastroV2Catalog.ts`
- Todas as `cadastro-v2/*Page.tsx` e `QACadastroV2GuidedStep.tsx`
- Edge functions (`qa-cliente-criar-conta-publica`, uploads, IA, Asaas)
- Schema, RLS, triggers, `qa_servicos_catalogo`, `qa_clientes`, `qa_vendas`, `qa_solicitacoes_servico`, `qa_processos`, `cliente_auth_links`, `qa_contracts`
- `_shared/qaEmailTemplates.ts` (templates do Bug 2 preservados)

## Feature flag

`src/lib/quero-armas/cadastroRefinadoFlag.ts`:
```ts
export const isCadastroRefinadoEnabled = () =>
  import.meta.env.VITE_QA_CADASTRO_V2_ENABLED === "true";
```
Leitura em runtime no `CadastroRouteSwitch` dentro do `QARoutes.tsx`. Default dev = `true` (via `.env`), produção começa sem a env (= `false` → fallback antigo).

## Padrão visual

- Tipografia editorial usa `font-serif` do Tailwind (já no design system) para títulos e valores monetários; mono para números de processo; CAPS+tracking para labels.
- Cores e bordas via tokens CSS já existentes do `qa-scope` (Premium Light) — sem paleta nova.
- Layout: header sticky, indicador "01 / 05" + 5 traços, card central, footer com 2 selos.
- Botão primário: preto, full-width, label informativo dinâmico.
- Mobile-first: padding lateral colapsa de 48px para 20px abaixo de `md:`.

## Etapas — comportamento

| # | Tela | Reaproveita |
|---|------|-------------|
| 01 | Confirmar serviço (card + preço serif + bullets) | `qaServiceCatalog`, query `qa_servicos_catalogo` |
| 02 | Upload documentos (lista por slug, 3 estados, IA banner) | edge `qa-upload-documento`, `qa-extract-doc` |
| 03 | Revisão dados extraídos (cards-seção editáveis, detecção CPF/email existente) | edge `qa-cliente-checar-existente`, validação local |
| 04 | Pagamento + contrato (PIX/Cartão/Boleto + checkbox LGPD) | edge `qa-gerar-cobranca`, geração contrato + `cliente_auth_links` |
| 05 | Conclusão (check + ficha + CTAs) | dados retornados da etapa 04 |

Bug fixes preservados nativamente:
- **Bug 1** (cliente existente pula etapa 4 / mostra "Esqueci senha"): tratado na Etapa 03 com desvio para tela de "Você já tem cadastro" + CTAs login/recuperar senha na Etapa 05.
- **Bug 2** (notificação cadastro existente): a edge function `qa-cliente-criar-conta-publica` já dispara as notificações — basta chamá-la.
- **Bug 3** (slugs de catálogo): `qaServiceCatalog.ts` já contém os slugs corretos — apenas consumir.

## Migração de homologação

Migration aditiva fazendo apenas o `UPDATE` solicitado em `qa_homologacao_sessoes` para `HOMOLOG_CATALOGO_COMPLETO_2026_05_15`.

## Critérios de aceite

- Flag ON → `/cadastro` abre nova UI editorial 5 etapas.
- Flag OFF/ausente → `/cadastro` abre `QACadastroPublicoPage` byte-idêntico ao atual.
- `/cadastro-v2*` intactos.
- `?servico=X` e `?origem=v2` funcionam em ambos os modos.
- Mobile responsivo nas 5 etapas.
- Zero alteração em schema, RLS, triggers, edge functions, catálogo.

## Pergunta antes de prosseguir

Confirma a estratégia de **implementação paralela sem extrair hooks de `QACadastroPublicoPage.tsx`** (única forma de garantir zero regressão dado o tamanho do arquivo)? Se sim, sigo direto com a criação dos 14 arquivos novos + `QARoutes.tsx` + migration.
