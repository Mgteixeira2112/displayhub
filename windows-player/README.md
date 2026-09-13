# DisplayHub Player — Windows

Primeira fundação instalável do player Windows.

## Escopo desta etapa

- instalador `.exe` via NSIS;
- janela própria baseada em Electron;
- modo kiosk/tela cheia após ativação;
- inicialização automática com o Windows;
- credencial armazenada com `safeStorage`/proteção do Windows;
- nova tentativa automática de carregamento em falha de rede;
- atalho de manutenção `Ctrl + Shift + Q`;
- configuração inicial usando o link público já existente.

## Teste funcional

1. Baixe o artefato `displayhub-windows-player` do workflow **Windows Player Installer**.
2. Execute `DisplayHub-Player-Setup-0.1.0.exe`.
3. Abra o DisplayHub no painel e copie o link público de uma tela de teste.
4. Cole o link na tela inicial do Player e clique em **Ativar este computador**.
5. Confirme que o conteúdo abre em tela cheia.
6. Feche e abra novamente o Player para confirmar que a configuração persistiu.
7. Reinicie o Windows e confirme a inicialização automática.
8. Use `Ctrl + Shift + Q` para retornar à tela de manutenção.

## Próxima etapa

Substituir a colagem do link pelo pareamento por código temporário + credencial permanente do dispositivo, sem alterar o player já instalado.
