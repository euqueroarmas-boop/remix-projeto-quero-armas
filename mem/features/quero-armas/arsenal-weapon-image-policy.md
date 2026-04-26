---
name: arsenal-weapon-image-policy
description: Regra absoluta para fotos de armamento no módulo Quero Armas — fundo, formato e processamento obrigatórios.
type: constraint
---
Toda foto de armamento que entrar no Arsenal (tabela `qa_armamentos_catalogo`, bucket `qa-armamentos`) DEVE obrigatoriamente:

1. **Fundo 100% transparente real** (PNG RGBA com alpha=0). Em hipótese nenhuma:
   - fundo branco
   - fundo cinza
   - padrão xadrez impresso (pixels claros opacos espalhados pelo fundo do PNG)
   - qualquer cor sólida atrás da arma
2. **Pós-processamento obrigatório** após gerar/editar imagem com IA: rodar máscara que torna transparentes todos os pixels com `brightness > 170 && saturation < 25` (remove brancos e cinzas residuais que viram "xadrez" visual no navegador).
3. **Características de fábrica preservadas**: gravações originais (marca, modelo, MADE IN, serial plate, logos) são parte da arma — NÃO remover.
4. **Cores reais**: a cor da arma deve refletir o produto real (preto fosco para a maioria, tungsten/cinza apenas se for o acabamento original do modelo).
5. **Enquadramento**: armas longas (espingarda, fuzil, carabina, submetralhadora) preenchem ~98% da largura do card sem estourar; pistolas e revólveres usam enquadramento livre com `object-contain`.

Snippet Python para limpeza obrigatória:
```python
from PIL import Image; import numpy as np
arr = np.array(Image.open(p).convert('RGBA'))
r,g,b,a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
maxc, minc = np.maximum.reduce([r,g,b]), np.minimum.reduce([r,g,b])
bg = ((maxc.astype(int) > 170) & ((maxc-minc).astype(int) < 25)) | (a == 0)
arr[bg] = [0,0,0,0]
Image.fromarray(arr).save(p)
```
