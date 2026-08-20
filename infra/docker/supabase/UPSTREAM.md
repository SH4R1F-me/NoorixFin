# Vendored Supabase self-host configuration

The files in this directory are a minimal subset of the official
Supabase Docker distribution at tag `self-hosted/v0.7.2`, retrieved from
`https://github.com/supabase/supabase/tree/self-hosted/v0.7.2/docker` on
2026-08-21. NoorixFin's merged Compose file is maintained one directory above.
The vendored function router has whitespace-only normalization so it passes the
repository's patch checks; its normalized checksum is recorded below.

The upstream repository is Apache-2.0 licensed. See the upstream repository for
its licence and notices.

## Integrity

```text
8eede6e4f92c9c2bfcfc864b6f088a1e2c6988b5208998f19d074d3f26bb1055  .env.example
340bb4d4b79c19e682d1a6297d56a6ec63997a49e0e19611c2cb3a6332eb32de  docker-compose.yml
ac3043803e542fca77ba769860842b0385adb95b42cc5d533c51f16555ba4cde  reset.sh
a0c8f1630af9a076a8fd723444de88eda5a91b3284199acb500d0da72cb7fdd6  update.sh
a1070f187839e66bd3ebf1c26ea33041f89d7294a7ed224c0df11b058a526737  versions.md
6299efc24ce94d771ca4abb8ac96b67624cc4ac9a4b13ee0c2a8f0071aa3d619  utils/generate-keys.sh
6fa77255421909685e63311ac22272207ff3f33fc6d1b3bca01b40cbe39c6184  utils/rotate-new-api-keys.sh
399394576635f7477dfee32e870f509567fc496f0dc86a5a6611f58d1099031f  volumes/api/kong-entrypoint.sh
acdce0ff4ac9e1dfa496733df7ca97cc89a9632de4b727af3f3a0d600ada2db7  volumes/api/kong.yml
9dce462adc04137d6afabcf28efa60a6c355270a4b32d7af58891ac4eb964c5f  volumes/db/_supabase.sql
1cc94a4f16f6e2932b383cd68e211a96bcae298437ca4120d8a5106396c58465  volumes/db/jwt.sql
f0463ce5030907acef49326d2bffd36002df0718035071be7c99bd7fc897c63d  volumes/db/logs.sql
df97ebe148d94cfb92a5e37ebf972dfd496be195f0915ecf14396b2cf50efecb  volumes/db/pooler.sql
7e9e442e7fc4dae05544c07b67bede37a00d84644304dfce4d937134cb4c8f88  volumes/db/realtime.sql
3ad717b225daa38aa982da26750f35641eb404e1eb5e69a763c22236ab96c1b2  volumes/db/roles.sql
b584aaaa0c393f27218f81e01e76e1d07d42f947083249adcd6097ad471cde62  volumes/db/webhooks.sql
924360da7a031b0c649d870863aa69cfa7436550169e7cc0d163bb15de2b0e3f  volumes/functions/hello/index.ts
daa4c31d63747183541aed1668adf6be69de097c55375f9a598ea28fb9be2b70  volumes/functions/main/index.ts
d844e49f8915021ccbf6af6b769fef7909a723346bfc8f94ddb0433a328e49b1  volumes/pooler/pooler.exs
```
