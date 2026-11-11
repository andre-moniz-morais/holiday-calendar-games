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

## Correr localmente

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

## Assets

- `npm run assets:images` gera as cabeças em WebP (128/256/512), os ícones da PWA e as fotos.
- `npm run assets:3d` converte as cabeças 3D (OBJ com 1M de triângulos e texturas 2K) em GLB com cerca de 400 KB. Antes de correr, descomprime `assets-src/*_head_3d.zip` para `assets-src/heads3d/{filipino,duda}/`. Os ZIPs e os OBJ não vão para o git porque são demasiado grandes.

## Deploy (Vercel + Neon)

1. Cria uma base de dados Postgres (Neon, Supabase ou Vercel Postgres) e copia a connection string.
2. Na Vercel, importa o repositório e define as variáveis `DATABASE_URL`, `SESSION_SECRET` e `NEXT_PUBLIC_CALENDAR_YEAR=2026`. Não definas `DEV_TODAY`.
3. Corre `DATABASE_URL=… npm run db:setup` uma vez a partir do teu computador.
4. No iPhone, abre o site no Safari e escolhe Partilhar → "Adicionar ao ecrã principal".

## Notas

- **Haptics no iOS:** o Safari não tem `navigator.vibrate`. A partir do iOS 17.4, ao alternar um `<input type="checkbox" switch>` o sistema dá um toque háptico, e o [`haptics.ts`](src/lib/client/haptics.ts) usa isso clicando num switch escondido. Funciona quando é chamado a partir de um toque do utilizador. No Android usa-se `navigator.vibrate`. Ambos podem ser desligados nas definições, tal como os sons.
- **Offline:** o service worker guarda a app e os assets em cache. Se uma pontuação não for enviada por falta de rede, fica numa fila e é reenviada quando a ligação voltar (até 10 minutos depois da meia-noite ainda conta para o dia anterior).
- **Repor tudo:** `truncate plays;` na base de dados.
