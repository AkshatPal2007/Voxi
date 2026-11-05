# Lyric sources and timing coverage

Reviewed 2026-11-05. More providers improve coverage but do not guarantee native
word timestamps for every recording. An estimate made from line duration is
not word synchronization.

| Source | Integration in Voxi | Limitations |
| --- | --- | --- |
| LRCLIB | Existing recording lookup and line/plain fallback | Usually line timing; accept real enhanced word data when present |
| AMLL TTML database | Existing public index, matched locally | Community catalog coverage |
| LiriQo | Primary and other returned candidates; TTML plus explicitly native normalized word windows | Eight upstream adapters documented; individual requests can return fewer or no results |
| lrcmux | New strict word-level lookup; validates returned title, artist and duration | Community availability, native source coverage, required app User-Agent |
| Better Lyrics | New TTML fallback after lrcmux; optional confidence and timing bounds | No identity echo; depends on upstream matching; some uncached queries require an API key |

LiriQo documents Apple Music, Musixmatch richsync, Unison, NetEase YRC,
KuGou KRC, QQ QRC, LRCLIB and YouTube Music adapters. Voxi previously inspected
only its primary TTML: other candidates and normalized native words were
being missed. Voxi now accepts those windows when explicitly marked native,
preserves gaps/end times, and rejects invalid or mismatched data.

lrcmux documents word timing from Deezer and KuGou, alongside lower precision
fallback sources. Voxi asks for strict word timing. Its returned recording
metadata is checked; a lower precision label does not enable word animation.

New catalogs run only if existing results lack words. They have a separate,
persisted Settings switch and use a bounded native HTTP client to supply
Voxi's User-Agent and support providers without browser CORS headers. Requests
are limited to two fixed HTTPS endpoints with no redirects, no account cookies,
at most two concurrent calls, 12-second timeouts and 2 MB response limits.
Successful results are cached in memory for eight recordings. Track changes
ignore stale replies; they do not cancel an already dispatched native request.
Rate limits and authorization failures are not retried automatically.

Public documentation example tested: Dynamite by BTS, 199 seconds. Both
lrcmux and Better Lyrics returned HTTP 200 with native timing data during
research. This is a one-song service check, not a catalog-wide coverage result.
Provider behavior, access policies and uptime can change.

Other evaluated options: Lyrically advertises multiple sources but is freemium;
direct service adapters and authenticated lyrics routes introduce additional
maintenance or access requirements. No account cookies or private API tokens
are extracted from Spotify or other installed players.

## Primary references

- [LiriQo response format and providers](https://github.com/AlFarrizi-Studio/Liriqo)
- [lrcmux source and public service](https://github.com/f1nniboy/lrcmux)
- [lrcmux machine-readable documentation](https://lrcmux.dev/llms.txt)
- [Better Lyrics request, errors and access requirements](https://lyrics-api-docs.boidu.dev/reference/get-lyrics)
- [Better Lyrics provider formats](https://lyrics-api-docs.boidu.dev/docs/providers)
- [Lyrically](https://lyrics.paxsenix.org/)
