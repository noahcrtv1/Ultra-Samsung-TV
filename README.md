# Ultra Samsung TV

Uma tela inicial para TVs Samsung (Tizen) que junta filmes, séries, música, futebol, clima e diversão num lugar só, com uma **Dynamic Island** no topo, igual à do iPhone.

Feito a partir do [Free My TV](https://github.com/simbasjungles/free-my-tv) (MIT), com Claude Code. A tela inicial original da Samsung continua lá: isto é um app que você abre (ou deixa abrir sozinho com *Autorun Last App*).

**Demo no navegador:** https://freemytv-classico-demo.vercel.app (setas, Enter e Esc, ou o controle na tela).

## O que tem

**Tela inicial**
- Saudação com o seu nome ("Boa noite, Ana") e um versículo do dia.
- Abas Explorar, Filmes, Séries, Novidades (estreias das últimas 2 semanas nos seus streamings) e Minha lista, em carrossel. O card focado vira o grande.
- Trailer mudo dentro do card, o fundo pega as cores do pôster e muda de tom pelo gênero (terror escurece e avermelha, comédia esquenta).
- RAM e CPU da TV ao lado das cotações, e um botão que libera memória fechando os outros apps.
- Card do HDMI ao vivo (o console aparece dentro do card).

**Ficha do título**: resumo, trailer, onde ver (todos os streamings do país, mais aluguel), "Assistir no app", Minha lista, Seguir série (avisa episódio novo) e Avisar estreia (contagem na ilha).

**Pesquisa** por teclado na tela ou pela voz do controle.

**O que ver hoje?** Sortear do catálogo inteiro, roleta de gênero, esse ou aquele (5 duelos), pela duração ("termina às 22:40"), ranking da semana, hoje na história do cinema, quiz de filmes e lançamentos.

**Dynamic Island**: música (Spotify), rádio, o jogo do seu time ao vivo (pré-jogo, placar, gol com a tela piscando e som de torcida), alertas de chuva forte, resumo da noite e contagem de estreias. ↑ na linha de botões foca a ilha, OK abre com ações (pausar, pular, "Assistir na Globo (antena)"), Ocultar esconde. Em Ajustes: ligada, só importantes ou desligada.

**Diversão** (gaveta): rádio do mundo num globo, lareira, aquário e chuva na janela (desenhados e com som pelo próprio app) e 2048.

**Automação**: tela de boas-vindas uma vez por dia, chuva e raios na tela quando chove, "Ainda está aí?" depois de 20 minutos parado (desliga a TV), Modo pipoca e gol que disparam rotinas da Alexa (Voice Monkey).

**Gaveta**: entradas, todos os apps, Wi-Fi para visitas (QR), painel do computador, vitrine (descanso de tela), painel do time e ajustes.

## O Hub (opcional)

`hub/` é um servidor pequeno (Node) que roda no seu computador e dá à TV o que ela não faz sozinha:
- trailers (o YouTube recusa tocar dentro do app), lembretes na tela, a música do Spotify;
- controle pelo celular (setas, digitar senha na TV, mandar link do YouTube ou vídeo pra TV);
- CPU, RAM e renders do computador; imagens de referência na vitrine.

```bash
cd hub
npm install
node server.js
```

Depois abra `http://<IP do computador>:3020` no celular. Coloque esse endereço em `hub_url` no `config.properties`. No Mac há um app de barra de menu em `hub/menubar/HubMenu.swift`.

Configurações do Hub ficam em `hub/config.json` (não vai pro git): `tvIp` (para o controle pelo celular), `spotifyClientId` e `spotifyClientSecret` (crie um app em developer.spotify.com com o redirect `http://127.0.0.1:3020/spotify/callback` e abra `/spotify/login`).

## Personalize no seu

Tudo que é seu fica em `config.properties`, que **nunca vai pro git**. Rode `python3 tizen/build.py` uma vez para ele ser criado a partir de `config.example.properties` e preencha:

| Campo | Para quê |
|---|---|
| `name` | sua saudação |
| `latitude`, `longitude`, `city` | clima, pôr do sol, alertas |
| `tmdb_key` | filmes e séries (chave grátis em themoviedb.org) |
| `team_espn_id`, `team_abbr`, `team_name`, `team_nickname`, `team_leagues`, `team_schedule_url` | seu time na ilha |
| `hub_url` | o Hub no seu computador |
| `wifi_ssid`, `wifi_password` | QR do Wi-Fi para visitas |
| `voice_monkey_url`, `voice_monkey_goal_url`, `voice_monkey_pregame_url` | rotinas da Alexa |

Sem um campo, a parte dele simplesmente não aparece.

## Instalar na TV

Igual ao Free My TV (veja [README-freemytv.md](README-freemytv.md#samsung-tvs-tizen)): Developer Mode na TV com o IP do seu computador, um certificado Samsung no Tizen Studio, e então:

```bash
python3 tizen/build.py --sign <seu perfil>
python3 tizen/install.py <IP da TV>
```

## Demo

`python3 tools/demo/build.py fixtures.json` monta `out/demo`, uma versão para navegador que não leva chave nem senha: as respostas do TMDB vêm de um arquivo gravado.

## Licença

MIT, como o Free My TV.
