# Mainnet evidence

Records written by the live app to Walrus Mainnet through MemWal, from real Telegram chats. Every row was confirmed with `getRememberStatus` and can be opened on Walruscan.

## Account
- MemWal account id: `0xe18b76d1a19dcf5acf841d3b716f2e46d5beda539f09918611debb6a41512f12`
- Relayer: `https://relayer.memory.walrus.xyz`

## What gets written
- Facts from free-text chat turns, as `[channel] <text>`, into the namespace `vow:mem:<userId>`. Questions, small talk and fragments are not written.
- Reminder check-ins (Taken, Skipped, Snooze), as `[check-in, <channel>] "<title>" (<role>) -> <status>`, into the same namespace.
- One namespace per user, shared by every linked channel: the same person is one memory whichever door they write from.

Code: `packages/core/memory/walrus-memory.mjs`.

## Recorded blobs (11)
All jobs reported `done` by the relayer.

| # | job_id | blob_id | walruscan | what |
|---|---|---|---|---|
| 1 | `e4a7a118-01e5-4530-a28f-525120bd60d8` | `Gyhuhqv0oXhE4nD5xXxIY0mP9Pe5DRPGSVwFXJ3j8aU` | https://walruscan.com/mainnet/blob/Gyhuhqv0oXhE4nD5xXxIY0mP9Pe5DRPGSVwFXJ3j8aU | chat: magnesium |
| 2 | `4c068468-3bf0-42fa-9643-2d8fdeffc4ca` | `yj-kBg5CpdbIjvqjiYqS2aJcCwfoN0qSQBigwuM7xPg` | https://walruscan.com/mainnet/blob/yj-kBg5CpdbIjvqjiYqS2aJcCwfoN0qSQBigwuM7xPg | schedule: vitamin D |
| 3 | `323cb01f-6044-4a45-a034-61219c85c349` | `auAbtpiRgSsbFnk-vdO3hvlBYFzy65JnvLTcW_WQ2F0` | https://walruscan.com/mainnet/blob/auAbtpiRgSsbFnk-vdO3hvlBYFzy65JnvLTcW_WQ2F0 | chat: knee/stretching |
| 4 | `0cbe56a8-b0bc-4aea-812f-21c94751e2c8` | `DRv--0SaSJpR0Y5_P_I1jMj1UtDyBbnKvUfR2yNtWq0` | https://walruscan.com/mainnet/blob/DRv--0SaSJpR0Y5_P_I1jMj1UtDyBbnKvUfR2yNtWq0 | chat: Rust study |
| 5 | `b6560614-ff61-4f95-b5ab-19236f836118` | `iDTCNjmQjPyJ4IpRbXnE-h4K7DLILbO6dWeF2OBWk1s` | https://walruscan.com/mainnet/blob/iDTCNjmQjPyJ4IpRbXnE-h4K7DLILbO6dWeF2OBWk1s | chat: recall magnesium |
| 6 | `34437b89-5d15-43e6-8ab1-cc667c5f4e3f` | `rO5w22PwNA9yWGJtZSqad6U7PPPx2G7AZ8kUS5Rjtoo` | https://walruscan.com/mainnet/blob/rO5w22PwNA9yWGJtZSqad6U7PPPx2G7AZ8kUS5Rjtoo | chat: water goal |
| 7 | `8a1f33b1-258d-4fd3-a05e-2f8ca2707f45` | `MtqrgKm90VuJuCjxPmnP27z3rWB3Avahcg5nzknGxXk` | https://walruscan.com/mainnet/blob/MtqrgKm90VuJuCjxPmnP27z3rWB3Avahcg5nzknGxXk | schedule: dentist |
| 8 | `63bae2db-c866-4972-960a-acada38af60f` | `1Ar4WytL-Tj96Kt3tMwl0W6Psm9dFDfErm8BgZElC18` | https://walruscan.com/mainnet/blob/1Ar4WytL-Tj96Kt3tMwl0W6Psm9dFDfErm8BgZElC18 | chat: preferences |
| 9 | `6b8be30b-6787-4006-841e-415d028dbc77` | `ftrB1KA-7CNawvs7nnRJ8VJRCpubKaNl6CBdO5kzX0c` | https://walruscan.com/mainnet/blob/ftrB1KA-7CNawvs7nnRJ8VJRCpubKaNl6CBdO5kzX0c | chat: sleep goal |
| 10 | `10528319-944e-4c3e-bd77-4c10f2abaf72` | `jkI6Dv_O9MyunmMKoGaPTXYdcno99RvicDCMezom-OY` | https://walruscan.com/mainnet/blob/jkI6Dv_O9MyunmMKoGaPTXYdcno99RvicDCMezom-OY | chat: Mediterranean diet |
| 11 | `26f0c817-39a9-49e2-b619-561f85e744e2` | `yH-lB3UeXOkUGGrnM4sqTebWF1DQYVT4qtHr-RXdnnU` | https://walruscan.com/mainnet/blob/yH-lB3UeXOkUGGrnM4sqTebWF1DQYVT4qtHr-RXdnnU | chat: summary |
