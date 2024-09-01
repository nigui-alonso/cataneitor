import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { GameSession } from './gameSession';
import dotenv from 'dotenv';

dotenv.config();

const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS

if (!spreadsheetId) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS must be provided!');
}

if (!keyFile) {
  throw new Error('GOOGLE_SHEETS_ID must be provided!');
}

const auth = new google.auth.GoogleAuth({
  keyFile: keyFile,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export async function loadPlayersFromSheet(): Promise<string[]> {
  try {
    const authClient = await auth.getClient() as JWT;
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'jugadores!A:A',
    });

    const players = response.data.values?.flat() || [];

    return players.map(String).sort((a, b) => a.localeCompare(b));

  } catch (error) {
    console.error('Error loading players:', error);
    return [];
  }
}

export async function addResultToSheet(gameSession: GameSession) {

    const authClient = await auth.getClient() as JWT;
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const players = gameSession.getPlayers();
  const scores = players.map(player => player.score);
  const highestScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);

  // Obtener el último número de juego
  const lastGameResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'resultados!A:A',
  });

  const lastGameNumber = lastGameResponse.data.values ? Math.max(...lastGameResponse.data.values.map(row => parseInt(row[0]) || 0)) : 0;
  const newGameNumber = lastGameNumber + 1;

  const values = players.map(player => [
    newGameNumber,
    new Date().toISOString(),
    player.name,
    player.score,
    player.score === highestScore ? 'Si' : 'No',
    player.score === lowestScore ? 'Si' : 'No',
    player.score === highestScore ? gameSession.winnerColor : '', // Add color only for the winner
    player.score === highestScore ? gameSession.location : '', // Add location only for the winner
  ]);

  const request = {
    spreadsheetId,
    range: 'resultados!A:H',
    valueInputOption: 'USER_ENTERED' as const,
    insertDataOption: 'INSERT_ROWS' as const,
    resource: { values },
  };

  try {
    await sheets.spreadsheets.values.append(request);
    console.log('Resultados agregados exitosamente a la hoja de cálculo.');
  } catch (error) {
    console.error('Error al agregar resultados a la hoja de cálculo:', error);
    throw error;
  }
}

export async function addPlayersToSheet(newPlayers: string): Promise<string[]> {
  try {
    const authClient = await auth.getClient() as JWT;
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const values = newPlayers.split(',').map(p => {
      const trimmedName = p.trim();
      const capitalizedName = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1).toLowerCase();
      return [capitalizedName, 'false'];
    }).filter(p => p[0] !== '');

    if (values.length === 0) {
      throw new Error('No se proporcionaron nombres de jugadores válidos.');
    }

    const request = {
      spreadsheetId,
      range: 'jugadores!A:A',
      valueInputOption: 'USER_ENTERED' as const,
      insertDataOption: 'INSERT_ROWS' as const,
      resource: { values },
    };

    console.log('Request to Google Sheets API:', JSON.stringify(request.resource.values, null, 2));

    const response = await sheets.spreadsheets.values.append(request);

    console.log('Response from Google Sheets API:', JSON.stringify(response.data, null, 2));

    return values.map(v => v[0]);
  } catch (error) {
    console.error('Error appending to sheet:', error);
    throw error;
  }
}