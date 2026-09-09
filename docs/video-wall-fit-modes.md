# Video Wall — modos de encaixe

O grupo de Video Wall pode escolher como a mídia ocupa a superfície virtual:

- `contain`: preserva a mídia inteira e a proporção original; pode deixar áreas vazias.
- `cover`: preenche toda a superfície; pode cortar partes da mídia e ampliar fontes de baixa resolução.
- `native`: usa toda a superfície virtual sem correção de proporção; indicado para conteúdo produzido na proporção final do wall, por exemplo 5760×1080 em um grupo 1×3 de telas Full HD.

O modo fica persistido em `display_groups.media_fit` no Supabase e é devolvido ao player público por `display-wall-context`.
