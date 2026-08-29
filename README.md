# home-vinyl-depot

Vinyl Depot — hledání a katalog vinylové sbírky přes Discogs, s volitelným
přehráváním vlastních ripů přes Navidrome.

## První spuštění

1. Zkopíruj `.env.example` na `.env` a uprav si v něm hesla:
   ```
   cp .env.example .env
   ```
2. Spusť:
   ```
   docker compose up --build
   ```

- Aplikace: http://localhost:3000
- Navidrome (hudební server): http://localhost:4533

## Jednorázové nastavení Navidrome

Hned po prvním spuštění Navidrome ještě nemá žádný účet. Bez něj appka
nedokáže potichu ověřit "Přehrát" u žádné desky (Navidrome jen odmítne
přihlášení, appka to tiše ignoruje — žádná chyba se neukáže, sekce
"Přehrát" prostě nikdy nikde nenaskočí). Udělej tenhle krok jednou, hned
po prvním `docker compose up` — účet zůstává uložený v `navidrome-data`
volume, takže při dalších spuštěních už ho není potřeba opakovat.

**Důležité: jméno a heslo, které tu zadáš, musí přesně sedět s tím, co máš
v `.env` u `NAVIDROME_USER`/`NAVIDROME_PASSWORD`** (výchozí je `vinyl` /
cokoliv sis nastavil v kroku "První spuštění"). Appka se pak k Navidrome
přihlašuje právě těmito hodnotami — jinak založíš účet, který appka
nepozná.

**Varianta A — přes web:**
Otevři http://localhost:4533 a formulář "Create Admin" vyplň jménem a
heslem z `.env`.

**Varianta B — přes CLI** (z vlastního terminálu, ne přes Claude — potřebuje
opravdový terminál kvůli interaktivnímu zadání hesla):
```
docker compose run --rm navidrome user create -u <NAVIDROME_USER z .env> -a
```
Zeptá se na heslo — zadej přesně to, co máš v `.env` u `NAVIDROME_PASSWORD`.

## Nahrávání nových písniček

Hudbu dej do `music/`, jedna složka na album:
```
music/
  Green Day - Dookie/
    01 Burnout.mp3
    02 Having a Blast.mp3
    ...
```

**Soubory potřebují správné ID3 tagy** (artist, album, title). Bez nich je
Navidrome zařadí pod "[Unknown Artist]/[Unknown Album]" a "Přehrát" pak
danou desku ve Vinyl Depotu nenajde, i když soubor fyzicky existuje.

Navidrome novou hudbu skenuje sám (jednou za hodinu, `ND_SCANSCHEDULE`
v `docker-compose.yml`). Pro okamžitý sken hned po nahrání:
```
docker compose exec navidrome navidrome scan
```

## Discogs token (obaly desek)

Discogs API bez tokenu vrací u vyhledávání prázdná pole pro obrázky (`thumb`,
`cover_image`) — hledání funguje i bez tokenu, jen bez náhledů obalů.

Vygeneruj si osobní token na https://www.discogs.com/settings/developers
("Generate new token") a dej ho do `.env` k `DISCOGS_TOKEN`. Po restartu
(`docker compose up -d`) se obaly začnou zobrazovat.
