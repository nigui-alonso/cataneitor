import TelegramBot, { Message } from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { addPlayersToSheet, addResultToSheet, loadPlayersFromSheet } from './sheetsService';
import { GameSession } from './gameSession';
import http from 'http';

// Load environment variables
dotenv.config();

// Use environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot: TelegramBot = new TelegramBot(token!, { polling: true });
const gameSessionsMap = new Map<number, GameSession>();

const authorizedUsers = process.env.AUTHORIZED_USERS
  ? process.env.AUTHORIZED_USERS.split(',').map(id => parseInt(id.trim(), 10))
  : [];

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN must be provided!');
  }

function isAuthorized(userId: number): boolean {
  return authorizedUsers.includes(userId);
}

function startServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running!');
  });

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

async function setBotCommands() {
  try {
    await bot.setMyCommands([
      { command: '/new', description: 'Cargar resultados' },
      { command: '/player', description: 'Cargar jugador nuevo' },
      { command: '/cancel', description: 'Cancelar partida' },
      { command: '/help', description: 'Mostrar ayuda' },
      // Add more commands as needed
    ]);
    console.log('Bot commands set successfully');
  } catch (error) {
    console.error('Error setting bot commands:', error);
  }
}

// Handle /start command
bot.onText(/\/start/, (msg: TelegramBot.Message) => {
  const chatId: number = msg.chat.id;
  const userId: number = msg.from?.id ?? 0;

  if (!isAuthorized(userId)) {
    bot.sendMessage(chatId, 'Loco no estás habilitado para cargar partidas, decile al admin que se ponga las pilas y pasale tu ID:');
    bot.sendMessage(chatId, `\`${userId}\``, {parse_mode: 'Markdown'});
    return;
  }

  const startText: string =
  `Bienvenido al registro de Catan de la Xente. Comandos habilitados:
  /new - Cargar resultados de una partida
  /player - Cargar un nuevo jugar a la lista
  /cancel - Cancelar una carga en curso
  /help - Cargar comandos habilitados
  `
  bot.sendMessage(chatId, startText);
});
// Handle /help command
bot.onText(/\/help/, (msg: TelegramBot.Message) => {
  const chatId: number = msg.chat.id;
  const userId: number = msg.from?.id ?? 0;

  if (!isAuthorized(userId)) {
    bot.sendMessage(chatId, 'Loco no estás habilitado para cargar partidas, decile al admin que se ponga las pilas y pasale tu ID:');
    bot.sendMessage(chatId, `\`${userId}\``, {parse_mode: 'Markdown'});
    return;
  }

  const startText: string =
  `Centro de ayuda. Comandos habilitados:
  /new - Cargar resultados de una partida
  /player - Cargar un nuevo jugar a la lista
  /cancel - Cancelar una carga en curso
  /help - Cargar comandos habilitados
  `
  bot.sendMessage(chatId, startText);
});

// Handle /player command
bot.onText(/\/player/, async (msg: TelegramBot.Message) => {
  const chatId: number = msg.chat.id;
  const userId: number = msg.from?.id ?? 0;

  if (!isAuthorized(userId)) {
    bot.sendMessage(chatId, 'No estás habilitado para usar este comando.');
    return;
  }

  try {
    bot.sendMessage(chatId, 'Agrega jugadores que no están en listado. Si es más de uno separalos con comas.');
    const newPlayersMsg = await new Promise<TelegramBot.Message>((resolve) => {
      bot.once('message', resolve);
    });

    if (!newPlayersMsg.text) {
      throw new Error('No se recibió un mensaje de texto válido.');
    }

    const addedPlayers = await addPlayersToSheet(newPlayersMsg.text);
    bot.sendMessage(chatId, `Se han agregado los siguientes jugadores: ${addedPlayers.join(', ')}`);
  } catch (error) {
    console.error('Error en el manejo del comando /player:', error);
    bot.sendMessage(chatId, 'Hubo un error al cargar los jugadores nuevos. Por favor, intenta nuevamente.');
  }
});

// Handle /new command
bot.onText(/\/new/, async (msg) => {
  const chatId = msg.chat.id;
  const userId: number = msg.from?.id ?? 0;

  if (!isAuthorized(userId)) {
    bot.sendMessage(chatId, 'Loco no estás habilitado para cargar partidas, decile al admin que se ponga las pilas y pasale tu ID:');
    bot.sendMessage(chatId, `\`${userId}\``, {parse_mode: 'Markdown'});
    return;
  }

  const allPlayers = await loadPlayersFromSheet()

  if (allPlayers.length == 0) {
    bot.sendMessage(chatId,'No pudimos cargar los jugadores, una lásitma. Proba de nuevo más tarde.')
    process.exit(1);
  }

  const gameSession = new GameSession(allPlayers)
  gameSessionsMap.set(chatId, gameSession)

  await askForPlayerCount(chatId);
});

async function askForPlayerCount(chatId: number) {
  await bot.sendMessage(chatId, '¿Cuántos jugadores participaron hoy?');
  bot.once('message', async (msg) => handlePlayerCountResponse(chatId, msg));
}

async function handlePlayerCountResponse(chatId: number, msg: Message) {
  const gameSession = gameSessionsMap.get(chatId);
  if (!gameSession) return;

  if (msg.text && /^\d+$/.test(msg.text)) {
    const playerCount = parseInt(msg.text);
    gameSession.setExpectedPlayerCount(playerCount);
    await selectPlayers(chatId);
  } else {
    await bot.sendMessage(chatId, 'Número inválido. Por favor, intenta de nuevo.');
    await askForPlayerCount(chatId);
  }
}

async function selectPlayers(chatId: number) {
  const gameSession = gameSessionsMap.get(chatId);
  if (!gameSession) return;

  const keyboard = gameSession.playerManager.getPlayerKeyboard();
  await bot.sendMessage(chatId, `Marca los ${gameSession.playerManager.getExpectedPlayerCount()} que participaron:`, {
    reply_markup: { inline_keyboard: keyboard }
  });

  // Usar bot.once en lugar de bot.on para evitar múltiples manejadores
  bot.once('callback_query', async function handleCallbackQuery(query) {
    if (!query.message || !query.data) return;
    if (query.message.chat.id !== chatId) {
      // Si no es el chat correcto, volver a escuchar
      bot.once('callback_query', handleCallbackQuery);
      return;
    }

    const player = query.data.split(':')[1];
    const result = gameSession.playerManager.togglePlayerSelection(player);
    await bot.answerCallbackQuery(query.id, { text: result.message });

   // Obtener el nuevo teclado
   const updatedKeyboard = gameSession.playerManager.getPlayerKeyboard();

   // Intentar actualizar el teclado
   try {
     await bot.editMessageReplyMarkup({ inline_keyboard: updatedKeyboard }, {
       chat_id: chatId,
       message_id: query.message.message_id
     });
   } catch (error: unknown) {
     if (error instanceof Error && error.message.includes('message is not modified')) {
       console.log('No changes in keyboard, skipping update');
     } else {
       console.error('Error updating keyboard:', error);
     }
   }

    if (result.selectionComplete) {
      await bot.sendMessage(chatId, 'Joya. Ahora vamos a cargar los puntos.');
      await askForScore(chatId);
    } else {
      // Si la selección no está completa, seguir escuchando callbacks
      bot.once('callback_query', handleCallbackQuery);
    }
  });
}

async function askForScore(chatId: number) {
  const gameSession = gameSessionsMap.get(chatId);
  if (!gameSession) return;

  const currentPlayer = gameSession.playerManager.getCurrentPlayer();
  if (currentPlayer) {
    await bot.sendMessage(chatId, `Puntaje hecho por ${currentPlayer}:`);
    bot.once('message', async (msg) => handleScoreResponse(chatId, msg));
  } else {
    await finalizeGame(chatId);
  }
}

async function handleScoreResponse(chatId: number, msg: Message) {
  const gameSession = gameSessionsMap.get(chatId);
  if (!gameSession) return;

  if (msg.text && /^(10|[0-9])$/.test(msg.text)) {
    const score = parseInt(msg.text);
    gameSession.playerManager.setCurrentPlayerScore(score);
    await askForScore(chatId);
  } else {
    await bot.sendMessage(chatId, 'Por favor, ingresa un puntaje válido (0-10).');
    await askForScore(chatId);
  }
}

async function finalizeGame(chatId: number) {
  const gameSession = gameSessionsMap.get(chatId);
  if (!gameSession) return;

  await bot.sendMessage(chatId, '¿Cuál fue el color ganador?');
  bot.once('message', async (colorMsg) => {
    if (colorMsg.text) {
      gameSession.winnerColor = colorMsg.text;
      await bot.sendMessage(chatId, '¿En qué sede se jugó?');
      bot.once('message', async (locationMsg) => {
        if (locationMsg.text) {
          gameSession.location = locationMsg.text;
          await addResultToSheet(gameSession);
          await bot.sendMessage(chatId, '¡Éxito rotundo, todo cargado pibe!');
          gameSessionsMap.delete(chatId);
        }
      });
    }
  });
}

// Command to cancel the current game
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const gameSession = gameSessionsMap.get(chatId);

  if (gameSession) {
    gameSession.reset();
    gameSessionsMap.delete(chatId); // Remove the game session entirely
    await bot.sendMessage(chatId, 'Perfecto, cancelamos todo maestro. Puedes volver a empezar con el comando /new');
  } else {
    await bot.sendMessage(chatId, 'No hay una carga en curso para este chat.');
  }
});

startServer()
setBotCommands();