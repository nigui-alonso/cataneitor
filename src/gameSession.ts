import { PlayerManager } from './playerManager';
import { Player } from './types';

export class GameSession {
  public playerManager: PlayerManager;
  public winnerColor: string;
  public location: string;

  constructor(allPlayers: string[]) {
    this.playerManager = new PlayerManager(allPlayers);
    this.winnerColor = '';
    this.location = '';
  }

  setExpectedPlayerCount(count: number) {
    this.playerManager.setExpectedPlayerCount(count);
  }

  getPlayers(): Player[] {
    return this.playerManager.getPlayers();
  }

  reset() {
    this.playerManager.reset();
    this.playerManager.setExpectedPlayerCount(0);
    this.winnerColor = '';
    this.location = '';
  }
}