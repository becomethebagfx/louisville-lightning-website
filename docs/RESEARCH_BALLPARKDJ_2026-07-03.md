# BallparkDJ Deep Research: Build vs Buy (2026-07-03)

Question: should Louisville Lightning upgrade its custom walk-up app
(loulightning.com/walkup) with BallparkDJ-style features, or pay for
BallparkDJ for the two 8U teams?

Method: deep-research harness, 6 search angles, 23 sources fetched, 111
claims extracted, top 25 adversarially verified with 3 independent votes
each (23 confirmed 3-0, 2 refuted 0-3). All product/pricing claims below
are from BallparkDJ's own site + the two app-store listings, verified
live July 2026. Walkout Song DJ facts verified separately against its
App Store listing 2026-07-03.

## (a) How BallparkDJ actually works

- **Platform**: native iOS + Android apps. Free tier (~3 players); full
  "Unlimited" activation is $6.99/YEAR (not monthly), covers unlimited
  teams/players, never auto-renews. Google Play 4.65 stars / 3,759
  ratings, 100k+ installs, small solo developer, actively updated (last
  update July 1, 2026).
- **Getting music in (their weak spot)**:
  - iOS: songs come from the Apple Music / iTunes LIBRARY (subscription
    songs must be added to library and downloaded for offline). User
    MP3s only via an iCloud Drive detour ("External Sources"). No
    Spotify (Spotify rejected their partnership; integration shelved).
  - Android: NO streaming service at all. Local files must be
    sideloaded (USB/Drive/Dropbox). This is the single most complained
    about thing in their reviews.
  - June 2026: they added an Epidemic Sound catalog (vendor-claimed
    50k+ royalty-free, PRO-cleared tracks, free with activation) +
    15-23 built-in clips.
- **Clip editing**: per-player start offset + duration, voice/music
  relative volume, voice-over-music overlap on a 0.1s draggable
  timeline, music fading. Ducking ("Soften Music During Voice") only
  works on purchased/external files, not Apple Music streams.
- **The announcer (their crown jewel)**: recorded HUMAN voice-overs by
  9 professional big-league PA announcers (Braves, Cubs, Mets, etc.),
  $3.99/player ONE-TIME, ~24h turnaround, free redos, never expires.
  Self-record is free. There is NO text-to-speech option. "SuperVoice"
  ($6.98/player bundle for baseball) stitches up to 4 voice parts and
  auto-builds a continuous full-team pre-game introduction.
- **Team sharing**: roster + settings share cross-platform, BUT user
  MP3s do NOT transfer (they don't host files); Apple Music songs only
  transfer iOS-to-iOS with a subscription. Recipients re-match songs.

## (b) True cost for Lightning (two teams, ~22 players)

| Option | Season 1 | Notes |
|---|---|---|
| Self-voiced only | ~$7-14 | 1-2 activations at $6.99/yr |
| + Pro announcer intros | ~$95-102 | 22 x $3.99 one-time + activation |
| + SuperVoice pregame bundle | ~$160-168 | 22 x $6.98 + activation |

Year 2 falls to the activation fee + new players only (intros persist).
Unconfirmed: whether every coach device needs its own $6.99 activation.
There is no "monthly price"; it's a yearly activation.

## (c) Gap analysis vs our app

Where OURS is already better than BallparkDJ:
- Direct MP3 upload in the browser (theirs needs iCloud/sideload detours)
- Cross-device by URL + coach PIN (theirs drops MP3s on share)
- Works on anything with a browser; theirs is app-per-device
- Batting-order reorder (theirs is reviewed as non-intuitive)
- Offline PWA playback (parity-ish; theirs needs downloaded tracks)

Where THEIRS is ahead (the actual gap list):
1. Player intro announcements (human pro voices; no TTS offered)
2. Voice + song stitching: overlap, ducking, one-tap sequencing
3. Auto full-team continuous pre-game introduction
4. Licensed 50k-track catalog (Epidemic Sound) + built-in clips

## Alternative worth knowing: Walkout Song DJ (verified)

Free + $6.99 LIFETIME premium (or $4.99/yr). AI text-to-speech announcer
voices (multiple voices, Neutral/Expressive/Dramatic styles; generates an
MP3 from a custom script), Apple Music + direct file import (MP3, M4A,
WAV, CAF), 4.8 stars / 12k ratings, iOS (updated within days of this
research). Proves the TTS-announcer approach is good enough to carry a
4.8-star category leader.

## (d) What upgrading OUR app to parity takes (engineering estimate)

1. **Announcer via neural TTS** (Google Chirp/Neural2 or ElevenLabs):
   an announcement is ~60-80 characters ("Now batting, number 25...
   Elijah Hayman!"). 22 players ~= 1,600 chars. Cloud TTS pricing is
   per-million characters, so a full season of regenerated intros costs
   PENNIES (ElevenLabs, the premium option, still under ~$1). Generate
   once, store the MP3 next to the song blob. Zero monthly cost at our
   scale.
2. **Self-record option**: browser MediaRecorder, free, lets a parent
   or coach be the announcer. Trivial addition to the edit modal.
3. **Stitching**: sequential (announcement, then song at its clip
   start) needs no new audio tech, half a day. Overlap + ducking (voice
   over the song intro with the music lowered) = Web Audio API gain
   automation or pre-rendered OfflineAudioContext mix, about a day.
4. **Pre-game full-team intro**: loop the roster playing each
   announcement back-to-back; small feature on top of #3.
5. Effort total: ~1-2 build days. Running cost: ~$0/month (TTS pennies,
   storage rides existing Supabase).
6. What we cannot replicate: the actual human big-league announcers.
   That specific magic is only purchasable, at $3.99/player, and it
   lives inside BallparkDJ's app (not exportable to ours).

Licensing footnote (practical, not legal advice): playing commercial
walk-up clips at games is technically a public performance (ASCAP has a
sports-events license class; NFHS documents the same for school events).
In practice venues/leagues often carry blanket licenses; BallparkDJ's
Epidemic catalog sidesteps it. Our uploaded-MP3 model is the same
posture every team using its own speaker has.

## (e) Recommendation

**Upgrade ours; don't switch.** BallparkDJ is weakest exactly where our
app is strongest (getting songs in, sharing, any-device access), and its
one genuine differentiator, human announcer recordings, only works
inside their app, which would drag game-day playback back into their
music-import pain. There is also no TTS in BallparkDJ, while a
Walkout-Song-DJ-style AI announcer is a 1-2 day, ~zero-cost addition to
our stack and covers 90% of the announcer experience.

Sequencing:
1. Build the announcer layer into /walkup (TTS default + self-record,
   sequential first, then overlap/ducking + pregame mode).
2. If, after hearing it live, the coaches still want the real
   big-league voice, buy BallparkDJ pro voicing as a ~$100 one-time
   experiment for the players' intros. Nothing about option 1 is wasted
   either way.

Caveats: pricing re-checked July 2026 but has changed before (activation
model dates to Dec 2024); multi-device activation question open; iOS
review volume not independently captured (Android-weighted reliability
picture).
