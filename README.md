# Natal a Dois 🎄

Calendário do advento com jogos para dois: todos os dias de 1 a 24 de dezembro abre uma porta com o desafio do dia, e no dia 25 abre a "Grande Prenda", um resumo ao estilo *Wrapped* com os recordes de cada um. É uma PWA pensada para telemóvel.

- **Stack:** Next.js 16 (App Router), React 19, Tailwind 4, Postgres (`postgres.js`), Three.js para o jogo 3D.
- **Login:** só há duas palavras-passe, `Duda` e `Filipino`, e cada uma identifica quem está a jogar. Não distinguem maiúsculas de minúsculas e ficam guardadas na BD com hash scrypt.
- **Dias:** contam no fuso horário de Lisboa. Cada porta só se pode jogar no próprio dia e conta o melhor resultado desse dia. As pontuações são validadas no servidor (dia e jogo certos).

## Jogos

| id | Nome | Pontuação |
|---|---|---|
| `fly` | Voo de Natal | 1 ponto por par de bastões |
| `run` | Corrida na Neve | segundos aguentados (mais é melhor) |
| `whack` | Chaminés | 1 ponto por cabeça do outro; perde logo se acertar na própria; 3 fugas = perde |
| `slice` | Fruta Fatiada | 1 ponto por fruta; 3 frutas caídas = perde; cortar uma cabeça = perde |
| `memory` | Memórias | tentativas (menos é melhor) |
| `snake` | Serpentina | 1 ponto por cabeça comida |
| `puzzle` | Puzzle | segundos (menos é melhor); peças com encaixes |
| `invaders` | Invasão de Beijinhos | 1 ponto por cabeça; 3 vidas; nenhuma cabeça pode chegar abaixo |
| `jump` | Até à Estrela | 1 ponto por andar; inclina o telemóvel (ou toca nos lados) |
| `cross` | Atravessa a Aldeia (3D) | 1 ponto por fila nova |

O calendário (que jogo calha em que dia) está em [`src/lib/server/schedule.ts`](src/lib/server/schedule.ts). Fica do lado do servidor para os jogos futuros continuarem surpresa.

## Correr localmente (desenvolvimento)

```bash
cp .env.example .env.local           # preenche SESSION_SECRET (openssl rand -hex 32)
docker run -d --name natal-db -e POSTGRES_USER=natal -e POSTGRES_PASSWORD=natal -e POSTGRES_DB=natal -p 5433:5432 postgres:16-alpine
npm install
npm run db:setup                     # cria as tabelas e as duas contas
npm run dev
```

**Testar antes de dezembro:** põe `DEV_TODAY=5` (ou outro dia) no `.env.local` para simular esse dia. `DEV_TODAY=25` abre o Wrapped e o modo livre de todos os jogos. **Em produção, deixa vazio.**

## As vossas fotos (Memórias e Puzzle)

Neste momento as fotos são placeholders. Para pôr fotos verdadeiras:

1. Põe pelo menos 8 fotos `.jpg`/`.png`/`.webp` em `assets-src/photos/` (fotos HEIC do iPhone têm de ser exportadas para JPG primeiro).
2. Corre `npm run assets:images`. Isto otimiza as fotos para WebP em `public/photos/` e atualiza `src/data/photos.generated.ts`.

As fotos originais ficam fora do git. As versões otimizadas só se veem com sessão iniciada.

O puzzle usa uma foto diferente em cada dia em que aparece.

## Música de fundo

Põe as músicas em `public/music/` e faz deploy. A app vai buscar a lista a `/api/music`, por isso não é preciso mais nada.

- **Formato:** `.m4a` (AAC) a 96–128 kbps é o melhor para iPhone: ficheiros pequenos e boa qualidade. `.mp3` também funciona. Evita `.ogg`/`.opus`, porque o Safari mais antigo não os toca.
- Tocam baixinho, por ordem aleatória. Nenhuma se repete até terem tocado todas, mesmo entre aberturas da app.
- Começam no primeiro toque no ecrã (o iOS não deixa tocar áudio antes disso) e podem ser desligadas em Definições → Música.
- No iPhone respeitam o botão de silêncio e misturam-se com outra música que esteja a tocar.
- Os ficheiros só se ouvem com sessão iniciada.

## Espreitadela antes de dezembro

Até 1/12/2026, três toques seguidos numa porta fechada abrem-na: dá para jogar o jogo desse dia (ou ver o resumo, na porta 25), mas nada fica guardado. A partir de 1/12/2026 deixa de funcionar. O servidor verifica a data verdadeira, e o `DEV_TODAY` não influencia.

## Assets

- `npm run assets:images` gera as cabeças em WebP (128/256/512), os ícones da PWA e as fotos.
- `npm run assets:3d` converte as cabeças 3D (OBJ com 1M de triângulos e texturas 2K) em GLB com cerca de 400 KB. Antes de correr, descomprime `assets-src/*_head_3d.zip` para `assets-src/heads3d/{filipino,duda}/`. Os ZIPs e os OBJ não vão para o git porque são demasiado grandes.

## Deploy no Mac mini (Docker + Traefik)

O `docker-compose.yml` constrói a imagem e liga o container `natal-a-dois` à rede externa `docker_shared_network`, onde já estão o Postgres e o Traefik. **Não publica portas no host.** O Traefik encaminha os pedidos diretamente para `natal-a-dois:3000` dentro da rede.

### 1. Criar a base de dados no Postgres partilhado (só da primeira vez)

```bash
docker exec -it <container-do-postgres> psql -U <superuser> -c "CREATE USER natal WITH PASSWORD 'uma-password-forte';"
docker exec -it <container-do-postgres> psql -U <superuser> -c "CREATE DATABASE natal OWNER natal;"
```

### 2. Criar o `.env` ao lado do `docker-compose.yml`

```bash
cp .env.example .env
```

```env
# o host é o nome do container do Postgres na docker_shared_network
DATABASE_URL=postgres://natal:uma-password-forte@<container-do-postgres>:5432/natal
SESSION_SECRET=<openssl rand -hex 32>
NEXT_PUBLIC_CALENDAR_YEAR=2026
DEV_TODAY=
```

O `.env` está no `.gitignore`. `DEV_TODAY` **tem de ficar vazio** em produção.

### 3. Arrancar

```bash
docker compose up -d --build
docker compose logs -f web      # deve aparecer "✓ schema applied, players seeded" e "Ready"
```

Em cada arranque, o container corre primeiro o `scripts/db-setup.mjs`, que cria as tabelas se não existirem e (re)grava as duas palavras-passe, e só depois o servidor Next.js. Esta operação é idempotente e nunca apaga pontuações. Para mudar as palavras-passe, define `PASSWORD_DUDA` / `PASSWORD_FILIPINO` no `.env` e reinicia o container.

O container tem um healthcheck (`/manifest.webmanifest`). Usa `docker ps` para ver o estado `healthy`.

### 4. Traefik

O serviço escuta na **porta 3000**. Se o Traefik usar labels do Docker, descomenta o bloco `labels` no `docker-compose.yml` e ajusta o domínio e o entrypoint. Se usar configuração por ficheiro, aponta o serviço para `http://natal-a-dois:3000`.

> ⚠️ O site tem de ser servido em **HTTPS**. Em produção, o cookie de sessão é `Secure`, por isso em HTTP simples o login parece funcionar mas a sessão não fica guardada.

### 5. Atualizar

```bash
git pull
docker compose up -d --build
```

As fotos e as cabeças vão dentro da imagem (`public/`). Depois de mudar fotos com `npm run assets:images`, faz commit dos ficheiros gerados e volta a fazer o build.

### No iPhone

Abre o site no Safari e escolhe Partilhar → "Adicionar ao ecrã principal".

## Notas

- **Haptics no iOS:** o Safari não tem `navigator.vibrate`. A partir do iOS 17.4, ao alternar um `<input type="checkbox" switch>` o sistema dá um toque háptico, e o [`haptics.ts`](src/lib/client/haptics.ts) usa isso clicando num switch escondido. Funciona quando é chamado a partir de um toque do utilizador. No Android usa-se `navigator.vibrate`. Ambos podem ser desligados nas definições, tal como os sons. Todos os botões e links dão um toque leve, e os que já têm um háptico próprio não dão dois.
- **Zoom:** a app fica sempre a 100%. O pinch, o duplo toque e o zoom com ctrl/cmd são bloqueados em [`zoom-lock.ts`](src/lib/client/zoom-lock.ts) e com `touch-action: manipulation`.
- **Offline:** o service worker guarda a app e os assets em cache. Se uma pontuação não for enviada por falta de rede, fica numa fila e é reenviada quando a ligação voltar (até 10 minutos depois da meia-noite ainda conta para o dia anterior).
- **Repor tudo:** `docker exec -it <container-do-postgres> psql -U natal -d natal -c "truncate plays;"`.
