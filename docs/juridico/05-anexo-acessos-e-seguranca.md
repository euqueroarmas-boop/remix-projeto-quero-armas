# ANEXO III — POLÍTICA DE ACESSOS E SEGURANÇA

> Integra o Contrato de Prestação de Serviços. Assinar junto. É a parte que
> mais protege na prática — contrato bom com acesso mal dado não segura nada.

---

## Princípio

**Acesso mínimo, nominal, auditado e progressivo.** Ele recebe o que precisa
para a tarefa da vez, no ambiente da vez, e nada além. Cada degrau novo exige
o degrau anterior cumprido sem incidente.

---

## As quatro fases

### Fase 0 — hoje, sem assinatura: NADA

Nem swagger, nem repositório, nem schema, nem print de painel, nem acesso de
leitura. Conversa de arquitetura em alto nível é permitida; artefato, não.

**É exatamente onde vocês estão agora.**

### Fase 1 — após assinar NDA + Declaração de Não Conflito

| Libera | Não libera |
|---|---|
| Documentação de API **de ambiente de desenvolvimento**, com dados fictícios | Swagger de produção |
| Diagrama de arquitetura | Credenciais de qualquer natureza |
| Leitura de um repositório de exemplo ou de um módulo isolado | Repositório principal completo |
| Descrição do modelo de dados, sem dados | Acesso ao banco |

### Fase 2 — após assinar o contrato de serviços + esta política

| Libera | Regras |
|---|---|
| GitHub: convite como **member** da organização | Nunca owner. Nunca admin do repositório |
| Repositório principal, branch `main` protegida | Sem force-push, sem push direto, PR obrigatório com revisão sua |
| Supabase: projeto **de desenvolvimento** separado | Base com dados anonimizados ou sintéticos |
| Chave `anon` do ambiente de desenvolvimento | **Nunca** a chave `service_role`, nem de dev nem de produção |
| Ambiente de testes com usuários fictícios | Nenhum dado de cliente real |
| Ferramentas de build e CI | Sem permissão de criar secret novo |

### Fase 3 — após 12 meses sem incidente (ou marco definido)

| Libera | Regras |
|---|---|
| Leitura de logs de produção | Com mascaramento de dados pessoais |
| Deploy em produção | Com aprovação sua por PR, e registro de quem publicou |
| Painel administrativo de produção | Conta nominal, perfil restrito, 2FA obrigatório |
| Métricas financeiras | Somente agregadas. Extrato bancário e gateway de pagamento permanecem exclusivamente com você |

---

## O que NUNCA é compartilhado, em nenhuma fase

- Propriedade (owner/root) das contas: GitHub, Supabase, Lovable, Cloudflare,
  registrador de domínio, provedor de e-mail, gateway de pagamento, conta
  bancária, contas de loja de aplicativos.
- Chave `service_role` do Supabase de produção e credencial direta do banco.
- Meio de pagamento das contas — quem paga é quem manda.
- Acesso de administrador ao provedor de DNS.
- Chaves privadas de assinatura de documentos e certificados.
- Segundo fator (2FA) das contas raiz, e os códigos de recuperação.

**Regra de ouro:** se a conta puder ser usada para te expulsar do seu próprio
sistema, você é o único titular. Sem exceção, em nenhuma fase, nem depois de
ele virar sócio.

---

## Obrigações permanentes dele

1. **2FA obrigatório** em todas as contas usadas no projeto.
2. **Contas nominais**: proibido compartilhar login com quem quer que seja.
3. **Sem cópia local persistente**: clone de trabalho é permitido; arquivo
   morto pessoal, backup em nuvem particular e espelho em conta própria, não.
4. **Sem ferramenta de IA não aprovada**: nada de colar código proprietário ou
   dado de cliente em serviço de terceiro sem autorização escrita. Lista de
   ferramentas aprovadas mantida por você, por escrito.
5. **Sem exportar base de dados**, em nenhum formato, por nenhum canal.
6. **Sem código oculto**: nenhuma rotina de acesso remoto, credencial embutida,
   coleta não documentada ou funcionalidade não aprovada.
7. **Equipamento**: sistema atualizado, disco criptografado, tela com bloqueio
   automático, antivírus ativo. Proibido usar equipamento do empregador atual.
8. **Incidente comunicado em até 24 horas.**

---

## Controles que você implanta do seu lado

| Controle | Por quê |
|---|---|
| Branch `main` protegida, PR obrigatório, revisão sua | Nada entra sem você ver |
| Logs de auditoria ligados no Supabase e no GitHub | Prova de quem fez o quê |
| Alerta de download em massa e de consulta atípica ao banco | Detecta exfiltração |
| Alerta de criação/alteração de chave e de secret | Detecta porta dos fundos |
| Backup diário e cópia fora da conta principal | Sobrevive a exclusão dolosa |
| Revisão trimestral de quem tem acesso a quê | Acesso esquecido é acesso vazado |
| Registro do código no INPI com resumo digital (hash) | Prova de autoria com data |
| Inventário de acessos assinado, atualizado a cada mudança | Base para a devolução |

---

## Inventário de acessos

Preencher, imprimir e assinar a cada concessão e a cada revogação.

| Sistema | Nível | Concedido em | Concedido por | Revogado em | Assinatura |
|---|---|---|---|---|---|
| GitHub (org) | member | | | | |
| Repositório principal | write, sem admin | | | | |
| Supabase — dev | anon key | | | | |
| Supabase — produção | — | | | | |
| Lovable | | | | | |
| Cloudflare | | | | | |
| E-mail corporativo | | | | | |
| Painel administrativo | | | | | |
| Gateway de pagamento | **nunca** | — | — | — | — |
| Conta bancária | **nunca** | — | — | — | — |

---

## Encerramento — checklist de 24 horas

- [ ] Remover do GitHub (organização e todos os repositórios)
- [ ] Revogar tokens pessoais e chaves de acesso criadas por ele
- [ ] Remover do Supabase, Lovable, Cloudflare e demais provedores
- [ ] Encerrar sessões ativas e desconectar dispositivos
- [ ] Trocar **todos** os segredos que ele conheceu, ainda que não usados
- [ ] Encerrar e-mail corporativo, com redirecionamento
- [ ] Receber a declaração assinada de eliminação de cópias
- [ ] Auditar logs dos últimos 90 dias procurando download em massa
- [ ] Conferir se não restou fork, espelho ou repositório pessoal
- [ ] Atualizar o inventário acima com a data de revogação

<br>

____________________________      ____________________________
**CONTRATANTE**                    **CONTRATADO** — ciente e de acordo

Data: ____/____/________
