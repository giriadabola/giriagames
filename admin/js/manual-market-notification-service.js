import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { app, auth } from './auth-guard.js';

const functions = getFunctions(app, 'us-central1');
const sendManualNotificationCallable = httpsCallable(functions, 'sendManualMarketNotification');

export async function sendManualMarketNotification(message) {
  if (!auth.currentUser) {
    throw new Error('Sessão expirada. Volta a entrar para enviar notificações.');
  }

  const response = await sendManualNotificationCallable({ message });
  return response.data;
}
