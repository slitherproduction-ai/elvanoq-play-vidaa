# ELVANOQ Play — VIDAA (Hisense / Toshiba)

Versão **1.0.0** para TVs com **VIDAA** (Hisense, Toshiba e outras marcas; o sistema também aparece como *V* / *Home OS*). No VIDAA o app é uma **página HTML5 hospedada**: a loja abre o endereço em tela cheia no navegador do sistema. Não há pacote para instalar.

Repositório independente: não compartilha código em tempo de execução com Android, Amazon, LG, Roku ou Samsung. Foi criado a partir do `elvanoq-play-msx` 1.1.5 (mesmas telas e regras), com as diferenças abaixo.

## Estrutura

```
public/                 o app (ES5 + Promise)
  src/core/platform.js  diferenças VIDAA: configuração, ID do aparelho, saída, deep link
  src/core/keys.js      controle VIDAA (HbbTV/W3C)
  src/core/http.js      GET direto e, se o navegador bloquear (CORS), via /api/fetch
worker/                 Cloudflare Worker: serve o app + relays /api/portal e /api/fetch
portal/                 ajustes do Portal para aceitar a plataforma vidaa (VD-)
store/                  banner e ícone para a loja VIDAA
tests/                  regras (Node), cliente VIDAA e Worker
scripts/validate.mjs    sintaxe ES5, arquivos e testes
```

## Diferenças em relação ao Samsung/MSX

| Samsung / MSX | VIDAA |
|---|---|
| Aberto pelo Media Station X (`/msx/start.json`) | Aberto pela loja VIDAA (ou pelo navegador da TV) |
| Identidade aleatória | SHA-256 do ID do aparelho (`Hisense_GetDeviceID`); aleatória se a API não existir |
| Código `SM-…`, `platform: "samsung-msx"` | Código `VD-…`, `platform: "vidaa"` |
| Voltar = 10009 (Tizen) | Voltar = 8; cores 403–406; mídia 19/412/413/415/417 |
| Só HTTP (`samsung.elvanoqplay.com`) | HTTPS para a loja (`vidaa.elvanoqplay.app`) + cópia HTTP (`vidaa.elvanoqplay.com`) |

O vídeo **não** passa pelo relay: a TV toca direto do servidor da lista.

## Publicação

### 1. Portal — aplicado em 11/11/2026
- `portal/migration-vidaa.sql` (migração `vidaa_platform`): libera `vidaa` na tabela `portal_webos_devices` e na função `portal_webos_device_register` (cria a TV como "TV VIDAA").
- `portal/portal-control-vidaa.patch`: publicado como `portal-control` v57. Aceita códigos `VD-` (QR/site, checkout, vínculo pelo painel) e o login por código do servidor com `platform: "vidaa"`.
- **Pendente:** o formulário `elvanoqplay.app/adicionar-lista` precisa aceitar `VD-` como já aceita `LG-`/`SM-` (o Portal já aceita).

### 2. Worker
GitHub → **Actions → Deploy VIDAA Worker → Run workflow**. Secrets do repositório: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e `PORTAL_KEY` (os mesmos do `elvanoq-play-msx`).
Confira `https://vidaa.elvanoqplay.app/health` e `http://vidaa.elvanoqplay.com/health`.

### 3. Loja VIDAA
Não existe cadastro aberto: é preciso se tornar parceiro.
1. Formulário de parceiro: <https://www.vidaa.com/partners/> (dados da empresa e do app).
2. Após aprovação, o VIDAA libera o **Partner Portal** e indica um Partner Engagement Manager.
3. Enviar: URL `https://vidaa.elvanoqplay.app`, banner `store/vidaa-banner-1776x284.jpg`, ícone `store/vidaa-icon-512.png`, no mínimo 3 capturas 1920×1080 (JPG/PNG ≤ 500 KB), política de privacidade `https://elvanoqplay.app/privacidade`, suporte `suporteelvanoqplay@gmail.com` e o acesso de demonstração (`demo.elvanoqplay.app`, usuário/senha demo).
4. O VIDAA testa, certifica e publica.

## Ponto de atenção: HTTPS × streams `http://`
A loja exige HTTPS, e a maioria dos streams IPTV é `http://`. Alguns navegadores bloqueiam vídeo `http://` numa página HTTPS (conteúdo misto); as Samsung 2022+ bloqueiam. **Precisa ser testado numa TV VIDAA física**:
- abra `https://vidaa.elvanoqplay.app` e `http://vidaa.elvanoqplay.com` no navegador da TV e toque um canal `.ts`, um `.m3u8` e um filme `.mp4` em cada um;
- se só o HTTP tocar, isso deve ser levado ao Partner Engagement Manager antes da submissão.

## Testes
```sh
node scripts/validate.mjs
```

## Homologação na TV
Hisense VIDAA U4 ou mais nova: ativação pelo QR, login por código, catálogo, TV ao vivo (`.ts` e `.m3u8`), filmes/séries (`mp4`/`mkv`), teclas coloridas e de mídia, Voltar e saída. Confirme também que o código `VD-` continua o mesmo depois de desligar a TV.
