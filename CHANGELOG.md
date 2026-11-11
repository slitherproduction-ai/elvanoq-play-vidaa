# Changelog — ELVANOQ Play VIDAA

## 1.0.0 — 11/11/2026 (primeira versão VIDAA)

- Base: código do Samsung/MSX 1.1.5 (mesmas telas e recursos da LG 1.1.5 e do Roku 1.1.x): ativação por QR, login por código do servidor, teste grátis de 7 dias, controle parental, retomada automática, catch-up, formato do ao vivo por lista, busca na TV ao Vivo e Ajustes premium.
- Plataforma `vidaa` no Portal, com código de TV `VD-XXXXXXXXXXXX`.
- Identidade: SHA-256 do ID do aparelho exposto pelo VIDAA (`Hisense_GetDeviceID`); sem a API, usa uma identidade local aleatória. O ID nunca sai da TV nem é gravado em texto puro.
- Controle VIDAA (Voltar = 8, cores 403–406, mídia HbbTV) e saída do app com `Hisense_closeApp` / `window.close()`.
- Worker próprio (`elvanoq-play-vidaa`) em `vidaa.elvanoqplay.app` (HTTPS, loja) e `vidaa.elvanoqplay.com` (HTTP), com relay do Portal e das listas. Sem as rotas do MSX.
- Materiais da loja em `store/` (banner 1776×284 e ícone 512).

Histórico das versões anteriores do código: repositórios `elvanoq-play-msx` e `elvanoq-play-lg`.
