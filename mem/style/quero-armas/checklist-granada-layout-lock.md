---
name: Checklist guiado (menu granada) — layout travado
description: Layout congelado da página do checklist guiado no mobile (ícone granada) — sem kicker, sem "você", sem fundo branco, H1 alinhado à página
type: constraint
---
Modo página (`asPage`) do `PendenciasGuiadasPopup` — acessado pelo ícone da granada no mobile:

- Sem o kicker "CHECKLIST GUIADO".
- H1 sem a palavra "VOCÊ": `NOME, ESTÁ NOS DEVENDO ENVIAR ESSES DOCUMENTOS!`
- Sem fundo branco / card / borda (bg-transparent) — não pode parecer pop-up.
- H1 alinhado à esquerda com o restante da página (px-0), Oswald 700 / 22px / uppercase / tracking .04em, primeiro nome em #7A1F2B.

**Why:** aprovado pelo usuário em 03/08/2026 após várias iterações.
**How to apply:** NUNCA alterar esse layout sem perguntar ao usuário DUAS vezes se ele tem certeza. O layout dos pop-ups (modo modal) permanece inalterado.
