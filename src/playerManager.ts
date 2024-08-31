import { Player } from './types';

export class PlayerManager {
  private allPlayers: string[];
  private selectedPlayers: string[];
  private playerScores: Map<string, number>;
  private currentPlayerIndex: number;
  private expectedPlayerCount: number;

  constructor(allPlayers: string[]) {
    this.allPlayers = allPlayers;
    this.selectedPlayers = [];
    this.playerScores = new Map();
    this.currentPlayerIndex = 0;
    this.expectedPlayerCount = 0;
  }

  setExpectedPlayerCount(count: number) {
    this.expectedPlayerCount = count;
  }

  getPlayerKeyboard() {
    return this.allPlayers.map(player => [{
      text: this.selectedPlayers.includes(player) ? `✅ ${player}` : player,
      callback_data: `select:${player}`
    }]);
  }

  togglePlayerSelection(player: string) {
    const index = this.selectedPlayers.indexOf(player);
    if (index === -1) {
      if (this.selectedPlayers.length < this.expectedPlayerCount) {
        this.selectedPlayers.push(player);
        return {
          message: `${player} seleccionado`,
          selectionComplete: this.selectedPlayers.length === this.expectedPlayerCount
        };
      } else {
        return { message: "Número máximo de jugadores ya seleccionado", selectionComplete: false };
      }
    } else {
      this.selectedPlayers.splice(index, 1);
      return { message: `${player} deseleccionado`, selectionComplete: false };
    }
  }

  getCurrentPlayer() {
    return this.selectedPlayers[this.currentPlayerIndex];
  }

  setCurrentPlayerScore(score: number) {
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer) {
      this.playerScores.set(currentPlayer, score);
      this.currentPlayerIndex++;
    }
  }

  getPlayers(): Player[] {
    return this.selectedPlayers.map(name => ({
      name,
      score: this.playerScores.get(name) || 0
    }));
  }

  getExpectedPlayerCount() {
    return this.expectedPlayerCount;
  }

  reset() {
    this.selectedPlayers = [];
    this.playerScores.clear();
    this.currentPlayerIndex = 0;
    this.expectedPlayerCount = 0;
  }
}