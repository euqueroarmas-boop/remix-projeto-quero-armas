# Arsenal Inteligente — API pública de contratação e checkout

Documento de trabalho para a integração da **página de vendas**.
Especificação formal: `openapi-checkout-publico.yaml`.

> **Confidencial.** Sujeito ao Acordo de Confidencialidade firmado entre as
> partes. Não redistribuir, não publicar, não submeter a ferramentas de
> terceiros sem autorização escrita.

---

## O que está aqui e o que não está

Estão documentados **quatro endpoints públicos**, que são os que a página de
vendas precisa. O sistema tem outros — administração, processos, documentos,
financeiro, painel da equipe. Eles não fazem parte desta entrega e não serão
necessários para esta tarefa.

Se durante o trabalho aparecer necessidade real de algo fora desta lista,
peça — a gente avalia e documenta o que fizer sentido.

---

## Ambiente

| Item | Valor |
|---|---|
| Ambiente | **Teste** — nunca produção |
| URL base | `https://<projeto>.supabase.co/functions/v1` (enviada em separado) |
| Chave | `anon` de teste (enviada em separado) |

**Regras do ambiente:**

- Não usar dados reais de pessoas. CPF, e-mail e telefone de teste.
- A chave não vai para o repositório, nem para o bundle publicado, sem
  aprovação prévia por escrito.
- Não colocar endereço `supabase.co` visível na navegação do usuário final —
  há uma regra do projeto sobre isso, e ela vale para a página de vendas
  também. Toda navegação permanece no domínio próprio.

---

## Cabeçalhos de toda chamada

```
POST  <url-base>/<funcao>
Content-Type:  application/json
apikey:        <chave-anon-de-teste>
Authorization: Bearer <chave-anon-de-teste>
```

Todas as funções respondem a `OPTIONS` (CORS liberado) e aceitam apenas
`POST`. Outro método devolve `405 method_not_allowed`.

---

## Os dois caminhos

### Caminho curto — um serviço só

Para uma página que vende um serviço isolado, com o pagamento tratado depois
pela equipe:

```
qa-contratar-publico
```

Uma chamada. Registra a intenção de contratação, identifica ou cria o cliente
pelo CPF, avisa a equipe. **Não gera cobrança.**

### Caminho completo — carrinho e pagamento no ato

```
1. qa-cliente-criar-conta-publica     (opcional — se o visitante for criar acesso)
2. qa-checkout-criar-venda            → devolve venda_id + checkout_token
3. qa-checkout-iniciar-pagamento      → devolve PIX / boleto / link de fatura
```

O `checkout_token` do passo 2 é o que autoriza o passo 3. Ele tem validade
curta.

---

## Cinco regras que evitam retrabalho

**1. Verifique sempre o campo `ok` — status 200 não significa sucesso.**

Os endpoints de cadastro devolvem `200` com `ok: false` para casos tratados,
como "este CPF já tem acesso". Isso é resposta esperada, não erro. Trate pelo
campo `reason` e mostre a mensagem que vem pronta em `message`.

```js
const r = await res.json();
if (!r.ok && r.reason === 'cpf_ja_possui_login') {
  // direcionar ao login, não repetir o cadastro
}
```

**2. Preço quem decide é o servidor.**

O que o frontend mandar como valor é conferido — e, no checkout, recalculado —
contra o catálogo. Os encargos de parcelamento também são calculados no
servidor. Exiba o valor que **voltou** na resposta, nunca o que você calculou
na tela.

**3. O `checkout_token` é segredo.**

Não registrar em log, não passar por parâmetro de URL, não guardar além da
sessão do visitante.

**4. Use o código de erro, não o texto.**

O campo `error` traz um código estável (`cart_empty`, `venda_ja_paga`,
`checkout_token_expirado`). O texto pode mudar; o código, não.

**5. Guarde o `traceId`.**

Quando vier, registre. É por ele que a gente localiza a chamada para dar
suporte.

---

## Campos que não são desta tarefa

`qa-checkout-criar-venda` aceita alguns campos de operação assistida — preço
negociado, modo de exibição do contrato, vínculo a outro cliente. Eles exigem
perfil de equipe ativo, são validados no servidor e **rejeitados** para quem
não tem esse perfil.

Não envie esses campos a partir da página de vendas. Se você recebeu
`staff_required_for_negotiated_price` ou `target_qa_cliente_requires_staff`,
é sinal de que algum deles vazou para o corpo da requisição.

---

## Idempotência — o que acontece se repetir a chamada

| Endpoint | Chamada repetida |
|---|---|
| `qa-cliente-criar-conta-publica` | Não duplica. Devolve `ok: false` com o motivo |
| `qa-contratar-publico` | Reaproveita o cliente existente pelo CPF |
| `qa-checkout-criar-venda` | Cria nova venda — **não** chame duas vezes para o mesmo carrinho |
| `qa-checkout-iniciar-pagamento` | Devolve a cobrança existente, com `reused: true` |

O único que exige cuidado no frontend é o `qa-checkout-criar-venda`: bloqueie
o botão enquanto a resposta não voltar.

---

## Dúvidas

Traga a dúvida com o `traceId` da chamada e o código de erro recebido.
