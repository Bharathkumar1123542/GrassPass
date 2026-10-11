import { challengeCatalog } from './catalog';

export function selectChallenge(challengeId?: string): typeof challengeCatalog[number] {
  if (challengeId) {
    const match = challengeCatalog.find((challenge) => challenge.id === challengeId);
    if (match) {
      return match;
    }
  }

  return challengeCatalog[0];
}
