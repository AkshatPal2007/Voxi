type Player = { id: string; playing: boolean; title: string };

/** Prefer a newly started player, retain the current player on ties, then Spotify. */
export function choosePlayer<T extends Player>(players: T[], current: string, previous: Player[]): T | undefined {
  const playing = players.filter(player => player.playing && player.title.trim());
  const started = playing.filter(player => !previous.some(old => old.id === player.id && old.playing));
  const prefer = (items: T[]) => items.find(player => player.id === current)
    ?? items.find(player => /spotify/i.test(player.id)) ?? items[0];
  return prefer(started) ?? prefer(playing) ?? players.find(player => player.id === current)
    ?? players.find(player => /spotify/i.test(player.id) && player.title.trim())
    ?? players.find(player => player.title.trim());
}

export function playerLabel(id: string) {
  if (/spotify/i.test(id)) return 'Spotify';
  if (/msedge/i.test(id)) return 'Microsoft Edge';
  if (/chrome/i.test(id)) return 'Google Chrome';
  if (/firefox/i.test(id)) return 'Firefox';
  return id;
}
