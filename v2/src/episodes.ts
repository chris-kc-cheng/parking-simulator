export type EpisodeId = 1 | 2;

export const EPISODES: Record<EpisodeId, { title: string; short: string; completed: string; welcome: string }> = {
  1: { title: 'Back-In Bay Parking', short: 'Back-In', completed: 'Back-In Parking Completed!',
    welcome: 'Welcome to Episode 1. Hold DOWN to reverse into Bay #14.' },
  2: { title: 'Parallel Parking', short: 'Parallel', completed: 'Parallel Parking Completed!',
    welcome: 'Welcome to Episode 2. Pull up beside the car ahead of the gap, then reverse in.' },
};

export function initialEpisode(): EpisodeId {
  try {
    const value = new URLSearchParams(window.location.search).get('episode');
    return value === '2' ? 2 : 1;
  } catch { return 1; }
}
