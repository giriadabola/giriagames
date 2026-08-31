import { auth, db } from "../core/firebase.js";
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { MARKET_NOTIFICATIONS_DEFAULTS, MARKET_NOTIFICATIONS_VAPID_PUBLIC_KEY } from "../core/pwa/push-config.js";

const USER_SETTINGS_FIELD = 'notificacoesMercado';
const NOTIFICATION_OPEN_EVENT = 'profile-notifications:open';

const popup = document.getElementById('notificationsPopup');
const closePopupButton = document.getElementById('closeNotificationsPopupIcon');
const deviceStatus = document.getElementById('notificationsDeviceStatus');
const enableDeviceButton = document.getElementById('enableDeviceNotificationsBtn');
const disableDeviceButton = document.getElementById('disableDeviceNotificationsBtn');

let activeUserId = null;
let currentSettings = { ...MARKET_NOTIFICATIONS_DEFAULTS };
let currentDeviceSubscription = null;
let userSettingsUnsubscribe = null;
let allUsersAvatarsUnsubscribe = null;
let profilePanelUnsubscribe = null;
let occupiedAvatars = {};
let avatarFuseEnabled = true;
let areEventsBound = false;

// --- 20 AVATARES DE JOGADORES E ARQUÉTIPOS DE FUTEBOL AUTÊNTICOS ---
const PRESET_AVATARS = [
  // 5 LENDAS DE FUTEBOL (FALECIDAS)
  {
    id: 'pele_rei',
    name: 'Pelé - O Rei (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23009739' stroke='%23ffdf00' stroke-width='2'/><path d='M25 32 L20 18 L36 24 L50 14 L64 24 L80 18 L75 32 Z' fill='%23ffdf00' stroke='%23d4ac0d' stroke-width='1.5'/><circle cx='50' cy='22' r='3' fill='%23002776'/><circle cx='50' cy='46' r='18' fill='%23795548'/><path d='M33 34 C40 26 60 26 67 34 C60 30 40 30 33 34 Z' fill='%23212121'/><circle cx='43' cy='44' r='2.5' fill='%23212121'/><circle cx='57' cy='44' r='2.5' fill='%23212121'/><path d='M42 53 Q50 59 58 53' stroke='%23212121' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23ffdf00'/><path d='M44 64 L50 74 L56 64' fill='%23009739'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23002776' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'maradona_dios',
    name: 'Maradona - Díos (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2374b9ff' stroke='%23ffffff' stroke-width='2'/><ellipse cx='50' cy='22' rx='22' ry='5' stroke='%23f1c40f' stroke-width='3' fill='none'/><path d='M22 36 C16 20 84 20 78 36 C84 50 16 50 22 36 Z' fill='%232d3436'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='43' cy='44' r='2.5' fill='%232d3436'/><circle cx='57' cy='44' r='2.5' fill='%232d3436'/><path d='M42 53 Q50 59 58 53' stroke='%232d3436' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%2374b9ff'/><path d='M40 64 V88 M50 64 V88 M60 64 V88' stroke='%23ffffff' stroke-width='5'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%232d3436' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'eusebio_pantera',
    name: 'Eusébio - Pantera Negra (13)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23d63031' stroke='%23ffdd59' stroke-width='2'/><circle cx='50' cy='45' r='18' fill='%234e342e'/><path d='M32 36 Q50 24 68 36 Z' fill='%23212121'/><circle cx='43' cy='43' r='2.5' fill='%23ffffff'/><circle cx='57' cy='43' r='2.5' fill='%23ffffff'/><path d='M42 53 Q50 59 58 53' stroke='%23ffffff' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23d63031'/><path d='M44 64 L50 74 L56 64' fill='%2300b894'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffdd59' font-family='sans-serif'>13</text></svg>"
  },
  {
    id: 'beckenbauer_kaiser',
    name: 'Beckenbauer - Kaiser (5)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%232c3e50' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='43' r='17' fill='%23ffdbac'/><path d='M32 34 Q50 22 68 34 Q50 28 32 34' fill='%23f5cd79'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 51 Q50 55 57 51' stroke='%232c3e50' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23ffffff'/><rect x='24' y='72' width='14' height='10' fill='%23f1c40f'/><text x='31' y='80' font-size='9' font-weight='900' text-anchor='middle' fill='%232c3e50' font-family='sans-serif'>C</text><text x='58' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%232c3e50' font-family='sans-serif'>5</text></svg>"
  },
  {
    id: 'cruyff_14',
    name: 'Cruyff - Carrossel (14)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23ff793f' stroke='%23ffffff' stroke-width='2'/><path d='M28 30 C24 45 26 55 28 60 M72 30 C76 45 74 55 72 60' stroke='%23f5cd79' stroke-width='6' fill='none'/><circle cx='50' cy='44' r='16' fill='%23ffeaa7'/><path d='M32 34 Q50 20 68 34 Q50 28 32 34' fill='%23f5cd79'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 50 Q50 54 57 50' stroke='%232d3436' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23ff793f'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>14</text></svg>"
  },

  // 10 ARQUÉTIPOS DE FUTEBOL
  {
    id: 'capitao_equipa',
    name: 'O Capitão de Equipa',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2310ac84' stroke='%23ffdd59' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M30 34 Q50 20 70 34 Z' fill='%23222f3e'/><circle cx='43' cy='42' r='2.5' fill='%23222f3e'/><circle cx='57' cy='42' r='2.5' fill='%23222f3e'/><path d='M43 50 Q50 55 57 50' stroke='%23222f3e' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23ee5253'/><path d='M44 64 L50 72 L56 64' fill='%23222f3e'/><rect x='22' y='72' width='14' height='10' rx='2' fill='%23ffdd59'/><text x='29' y='80' font-size='9' font-weight='900' text-anchor='middle' fill='%23222f3e' font-family='sans-serif'>C</text><circle cx='58' cy='76' r='5' fill='%23ffffff' stroke='%23222f3e' stroke-width='1'/><polygon points='58,73 60,75 59,78 57,78 56,75' fill='%23222f3e'/></svg>"
  },
  {
    id: 'guarda_redes_paredao',
    name: 'O Guarda-Redes (1)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2327ae60' stroke='%23f1c40f' stroke-width='2'/><path d='M28 34 C28 22 72 22 72 34 V38 H28 Z' fill='%23f1c40f'/><path d='M20 38 H80 L74 42 H26 Z' fill='%23f39c12'/><circle cx='50' cy='48' r='16' fill='%23ffdbac'/><circle cx='43' cy='46' r='2.5' fill='%232c3e50'/><circle cx='57' cy='46' r='2.5' fill='%232c3e50'/><path d='M43 54 Q50 58 57 54' stroke='%232c3e50' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23e67e22'/><rect x='16' y='74' width='10' height='14' rx='3' fill='%23f1c40f' stroke='%232c3e50' stroke-width='1.5'/><rect x='74' y='74' width='10' height='14' rx='3' fill='%23f1c40f' stroke='%232c3e50' stroke-width='1.5'/><text x='50' y='83' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>1</text></svg>"
  },
  {
    id: 'goleador_matador',
    name: 'O Avançado Matador (9)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23e74c3c' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M30 32 L50 18 L70 32 Z' fill='%232c3e50'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M42 51 Q50 57 58 51' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%232c3e50'/><text x='50' y='83' font-size='15' font-weight='900' text-anchor='middle' fill='%23f1c40f' font-family='sans-serif'>9</text><circle cx='76' cy='72' r='7' fill='%23ffffff' stroke='%232c3e50' stroke-width='1.5'/><polygon points='76,68 78,70 77,73 75,73 74,70' fill='%232c3e50'/></svg>"
  },
  {
    id: 'jovem_prodigio',
    name: 'O Jovem Prodígio (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%238e44ad' stroke='%2300cec9' stroke-width='2'/><path d='M26 40 C26 20 74 20 74 40' stroke='%2300cec9' stroke-width='5' fill='none'/><rect x='22' y='36' width='8' height='14' rx='4' fill='%2334495e'/><rect x='70' y='36' width='8' height='14' rx='4' fill='%2334495e'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M30 32 C38 20 62 20 70 32 Q50 28 30 32' fill='%23f1c40f'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 51 Q50 56 57 51' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%2334495e'/><text x='50' y='83' font-size='15' font-weight='900' text-anchor='middle' fill='%2300cec9' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'mister_treinador',
    name: 'O Mister / Treinador Tático',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2334495e' stroke='%23bdc3c7' stroke-width='2'/><circle cx='50' cy='40' r='16' fill='%23ffdbac'/><path d='M32 30 Q50 18 68 30 Z' fill='%232c3e50'/><circle cx='43' cy='40' r='2.5' fill='%232c3e50'/><circle cx='57' cy='40' r='2.5' fill='%232c3e50'/><path d='M44 48 Q50 52 56 48' stroke='%232c3e50' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%232c3e50'/><path d='M44 64 L50 82 L56 64' fill='%23ffffff'/><path d='M48 64 L50 80 L52 64' fill='%23e74c3c'/><rect x='68' y='68' width='16' height='20' rx='2' fill='%2327ae60' stroke='%23ffffff' stroke-width='1'/><circle cx='76' cy='78' r='4' stroke='%23ffffff' stroke-width='1' fill='none'/></svg>"
  },
  {
    id: 'arbitro_juiz',
    name: 'O Árbitro / Juiz',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23222f3e' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='42' r='16' fill='%23ffdd59'/><circle cx='44' cy='40' r='2.5' fill='%23222f3e'/><circle cx='56' cy='40' r='2.5' fill='%23222f3e'/><rect x='48' y='48' width='10' height='6' fill='%23c8d6e5'/><path d='M58 51 H66' stroke='%23c8d6e5' stroke-width='2'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23f1c40f'/><path d='M32 64 V88 M41 64 V88 M50 64 V88 M59 64 V88 M68 64 V88' stroke='%23222f3e' stroke-width='4'/><rect x='28' y='72' width='8' height='12' rx='1' fill='%23e74c3c'/></svg>"
  },
  {
    id: 'ultra_adepto',
    name: 'O Ultra / Adepto de Curva',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23e67e22' stroke='%23ffffff' stroke-width='2'/><rect x='30' y='24' width='40' height='12' rx='6' fill='%23c0392b'/><circle cx='50' cy='20' r='4' fill='%23f1c40f'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 50 Q50 56 57 50' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232c3e50'/><rect x='24' y='62' width='52' height='12' rx='4' fill='%23c0392b'/><path d='M34 62 V74 M46 62 V74 M58 62 V74 M70 62 V74' stroke='%23f1c40f' stroke-width='4'/></svg>"
  },
  {
    id: 'veterano_camisola10',
    name: 'O Veterano (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2316a085' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='42' r='17' fill='%23e0ac69'/><path d='M34 46 C34 56 66 56 66 46 Z' fill='%232c3e50'/><circle cx='43' cy='40' r='2.5' fill='%23ffffff'/><circle cx='57' cy='40' r='2.5' fill='%23ffffff'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2316a085'/><path d='M44 66 L50 76 L56 66' fill='%23ffffff'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'velocista_raio',
    name: 'O Velocista (11)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23f39c12' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='42' r='17' fill='%23ffdbac'/><path d='M30 30 Q50 18 70 30 Z' fill='%23e74c3c'/><rect x='30' y='32' width='40' height='6' fill='%232c3e50'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 51 Q50 56 57 51' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23e74c3c'/><polygon points='32,68 24,78 30,78 26,86 38,74 30,74' fill='%23f1c40f'/><text x='58' y='83' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>11</text></svg>"
  },
  {
    id: 'trinco_destruidor',
    name: 'O Trinco Destruidor (6)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2334495e' stroke='%23e74c3c' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%238d5524'/><path d='M30 32 Q50 20 70 32 Z' fill='%232c3e50'/><circle cx='43' cy='42' r='2.5' fill='%23ffffff'/><circle cx='57' cy='42' r='2.5' fill='%23ffffff'/><path d='M42 50 H58' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232c3e50'/><text x='50' y='83' font-size='15' font-weight='900' text-anchor='middle' fill='%23e74c3c' font-family='sans-serif'>6</text></svg>"
  },

  // 5 ARQUÉTIPOS TEMÁTICOS (SEMPRE COM EQUIPAMENTO DE FUTEBOL E BOLA)
  {
    id: 'jogador_samurai',
    name: 'Jogador Samurai (8)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23c0392b' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='20' r='6' fill='%232c3e50'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><rect x='30' y='30' width='40' height='7' fill='%23ffffff'/><circle cx='50' cy='33.5' r='2.5' fill='%23c0392b'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 50 Q50 55 57 50' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232980b9'/><path d='M44 66 L50 74 L56 66' fill='%23ffffff'/><text x='50' y='84' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>8</text><circle cx='76' cy='74' r='6' fill='%23ffffff' stroke='%232c3e50' stroke-width='1'/><polygon points='76,71 78,73 77,76 75,76 74,73' fill='%232c3e50'/></svg>"
  },
  {
    id: 'jogador_ninja',
    name: 'Jogador Ninja (7)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231e272e' stroke='%23ff5e57' stroke-width='2'/><path d='M26 30 C26 20 74 20 74 30 V65 C74 74 26 74 26 65 Z' fill='%232d3436'/><rect x='30' y='38' width='40' height='14' rx='4' fill='%23ffdbac'/><circle cx='41' cy='45' r='3.5' fill='%232d3436'/><circle cx='59' cy='45' r='3.5' fill='%232d3436'/><rect x='24' y='32' width='52' height='6' rx='2' fill='%23ff5e57'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23ff5e57'/><text x='50' y='84' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>7</text><circle cx='24' cy='74' r='6' fill='%23ffffff' stroke='%232d3436' stroke-width='1'/><polygon points='24,71 26,73 25,76 23,76 22,73' fill='%232d3436'/></svg>"
  },
  {
    id: 'jogador_cyborg',
    name: 'Jogador Cyborg (99)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%232c3e50' stroke='%2300cec9' stroke-width='2'/><rect x='30' y='26' width='40' height='36' rx='8' fill='%23bdc3c7'/><rect x='34' y='34' width='32' height='12' rx='4' fill='%2300cec9'/><circle cx='42' cy='40' r='3' fill='%23ffffff'/><circle cx='58' cy='40' r='3' fill='%23ffffff'/><rect x='42' y='52' width='16' height='4' rx='2' fill='%232c3e50'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2300cec9'/><text x='50' y='84' font-size='14' font-weight='900' text-anchor='middle' fill='%232c3e50' font-family='sans-serif'>99</text></svg>"
  },
  {
    id: 'jogador_viking',
    name: 'Jogador Viking (4)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23576574' stroke='%23ff9f43' stroke-width='2'/><path d='M26 38 C26 24 74 24 74 38 Z' fill='%238395a7'/><path d='M20 38 Q10 20 28 24 Q24 34 28 38' fill='%23c8d6e5'/><path d='M80 38 Q90 20 72 24 Q76 34 72 38' fill='%23c8d6e5'/><circle cx='50' cy='48' r='14' fill='%23ffdbac'/><circle cx='44' cy='46' r='2.5' fill='%23222f3e'/><circle cx='56' cy='46' r='2.5' fill='%23222f3e'/><path d='M34 52 C34 74 66 74 66 52 Z' fill='%23ff9f43'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%230984e3'/><text x='50' y='84' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>4</text></svg>"
  },
  {
    id: 'jogador_rei',
    name: 'Jogador Rei Campeão (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%236c5ce7' stroke='%23f1c40f' stroke-width='2'/><path d='M26 40 L22 20 L38 30 L50 16 L62 30 L78 20 L74 40 Z' fill='%23f1c40f'/><circle cx='50' cy='14' r='4' fill='%23e74c3c'/><circle cx='50' cy='50' r='15' fill='%23ffdbac'/><circle cx='44' cy='48' r='2.5' fill='%232d3436'/><circle cx='56' cy='48' r='2.5' fill='%232d3436'/><path d='M44 56 Q50 60 56 56' stroke='%232d3436' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23d63031'/><polygon points='50,65 52,69 56,69 53,72 54,76 50,73 46,76 47,72 44,69 48,69' fill='%23f1c40f'/><text x='50' y='86' font-size='14' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'cobrador_livres',
    name: 'O Cobrador de Livres (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23192a56' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M30 30 Q50 18 70 30 Z' fill='%23273c75'/><circle cx='43' cy='42' r='2.5' fill='%23192a56'/><circle cx='57' cy='42' r='2.5' fill='%23192a56'/><path d='M43 51 Q50 56 57 51' stroke='%23192a56' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23273c75'/><path d='M44 66 L50 76 L56 66' fill='%23f1c40f'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text><path d='M24 45 Q40 24 76 38' stroke='%23f1c40f' stroke-width='3' stroke-dasharray='3' fill='none'/></svg>"
  },
  {
    id: 'defesa_central',
    name: 'O Defesa Central (4)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23b2bec3' stroke='%23d63031' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23e0ac69'/><rect x='44' y='42' width='12' height='5' fill='%23ffffff' transform='rotate(-10 50 44)'/><circle cx='43' cy='40' r='2.5' fill='%232d3436'/><circle cx='57' cy='40' r='2.5' fill='%232d3436'/><path d='M42 50 H58' stroke='%232d3436' stroke-width='3' stroke-linecap='round'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23d63031'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>4</text></svg>"
  },
  {
    id: 'jogador_gladiador',
    name: 'Jogador Gladiador (300)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%232d3436' stroke='%23d35400' stroke-width='2'/><path d='M28 34 C28 20 72 20 72 34 Z' fill='%23d35400'/><path d='M46 12 H54 V26 H46 Z' fill='%23c0392b'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='43' cy='44' r='2.5' fill='%232d3436'/><circle cx='57' cy='44' r='2.5' fill='%232d3436'/><path d='M43 52 Q50 56 57 52' stroke='%232d3436' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23c0392b'/><text x='50' y='85' font-size='11' font-weight='900' text-anchor='middle' fill='%23f1c40f' font-family='sans-serif'>300</text></svg>"
  },
  {
    id: 'jogador_pirata',
    name: 'Jogador Pirata (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231b1464' stroke='%23ff4757' stroke-width='2'/><path d='M26 34 C26 22 74 22 74 34 Z' fill='%232f3542'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='40' cy='44' r='4' fill='%232f3542'/><line x1='24' y1='38' x2='76' y2='48' stroke='%232f3542' stroke-width='2'/><circle cx='58' cy='44' r='2.5' fill='%232f3542'/><path d='M44 53 Q50 57 56 53' stroke='%232f3542' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23ff4757'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'jogador_magico',
    name: 'Jogador Mágico (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23482475' stroke='%23e056fd' stroke-width='2'/><path d='M34 26 L66 26 L62 10 L38 10 Z' fill='%232c2c54'/><rect x='28' y='26' width='44' height='6' fill='%23e056fd'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='43' cy='44' r='2.5' fill='%232c2c54'/><circle cx='57' cy='44' r='2.5' fill='%232c2c54'/><path d='M43 52 Q50 56 57 52' stroke='%232c2c54' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232c2c54'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23e056fd' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'jogador_astronauta',
    name: 'Jogador Astronauta (99)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%230c2461' stroke='%234a69bd' stroke-width='2'/><circle cx='50' cy='44' r='22' fill='%23f5f6fa'/><ellipse cx='50' cy='44' rx='16' ry='12' fill='%231e3799'/><path d='M38 38 Q50 32 62 40 Q50 46 38 38' fill='%23f6b93b' opacity='0.7'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23f5f6fa'/><text x='50' y='85' font-size='14' font-weight='900' text-anchor='middle' fill='%231e3799' font-family='sans-serif'>99</text></svg>"
  },
  {
    id: 'jogador_imperador',
    name: 'Jogador Imperador (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23686de0' stroke='%23f9ca24' stroke-width='2'/><path d='M28 32 C34 22 66 22 72 32 C64 28 36 28 28 32 Z' fill='%23f9ca24'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><circle cx='43' cy='42' r='2.5' fill='%2330336b'/><circle cx='57' cy='42' r='2.5' fill='%2330336b'/><path d='M43 50 Q50 55 57 50' stroke='%2330336b' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23eb4d4b'/><path d='M44 66 L50 76 L56 66' fill='%23f9ca24'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'apanha_bolas',
    name: 'O Apanha-Bolas (12)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2320bf6b' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='42' r='16' fill='%23ffdbac'/><path d='M32 32 C38 22 62 22 68 32 Z' fill='%2326de81'/><circle cx='43' cy='40' r='2.5' fill='%231e272e'/><circle cx='57' cy='40' r='2.5' fill='%231e272e'/><path d='M42 48 Q50 54 58 48' stroke='%231e272e' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2326de81'/><circle cx='50' cy='76' r='10' fill='%23ffffff' stroke='%231e272e' stroke-width='1.5'/><polygon points='50,71 53,74 52,78 48,78 47,74' fill='%231e272e'/></svg>"
  },
  {
    id: 'jogador_superheroi',
    name: 'O Super-Jogador (7)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23ff4757' stroke='%23eccc68' stroke-width='2'/><path d='M16 66 L30 50 L70 50 L84 66 Z' fill='%23eccc68'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><rect x='32' y='38' width='36' height='10' rx='4' fill='%2f3542'/><circle cx='42' cy='43' r='2.5' fill='%23ffffff'/><circle cx='58' cy='43' r='2.5' fill='%23ffffff'/><path d='M43 51 Q50 55 57 51' stroke='%232f3542' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23ff4757'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23eccc68' font-family='sans-serif'>7</text></svg>"
  },
  {
    id: 'fisioterapeuta_equipa',
    name: 'O Fisioterapeuta de Campo',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231289a7' stroke='%23ffffff' stroke-width='2'/><rect x='32' y='24' width='36' height='10' rx='3' fill='%23ffffff'/><path d='M48 26 H52 V32 H48 Z M45 28 H55 V30 H45 Z' fill='%23ea2027'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><circle cx='43' cy='42' r='2.5' fill='%231289a7'/><circle cx='57' cy='42' r='2.5' fill='%231289a7'/><path d='M43 50 Q50 54 57 50' stroke='%231289a7' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%231289a7'/><rect x='64' y='68' width='16' height='14' rx='2' fill='%23ffffff'/><path d='M70 71 H74 V79 H70 Z M67 74 H77 V76 H67 Z' fill='%23ea2027'/></svg>"
  },
  {
    id: 'marcador_penaltis',
    name: 'O Marcador de Penáltis (11)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23c0392b' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 51 Q50 55 57 51' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232c3e50'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>11</text><circle cx='76' cy='74' r='7' stroke='%23f1c40f' stroke-width='2' fill='none'/><line x1='76' y1='64' x2='76' y2='84' stroke='%23f1c40f' stroke-width='1.5'/><line x1='66' y1='74' x2='86' y2='74' stroke='%23f1c40f' stroke-width='1.5'/></svg>"
  },
  {
    id: 'guarda_redes_estrela',
    name: 'O Guarda-Redes Estrela (13)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2300b894' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M28 32 C28 20 72 20 72 32 Z' fill='%232d3436'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 51 Q50 55 57 51' stroke='%232d3436' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2300b894'/><rect x='16' y='74' width='10' height='14' rx='3' fill='%23fdcb6e' stroke='%232d3436' stroke-width='1.5'/><rect x='74' y='74' width='10' height='14' rx='3' fill='%23fdcb6e' stroke='%232d3436' stroke-width='1.5'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>13</text></svg>"
  },
  {
    id: 'jogador_robot_guarda',
    name: 'Jogador Robô N.º 1 (1)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23636e72' stroke='%23fdcb6e' stroke-width='2'/><rect x='30' y='26' width='40' height='36' rx='6' fill='%23b2bec3'/><rect x='34' y='34' width='32' height='12' rx='3' fill='%23fdcb6e'/><circle cx='42' cy='40' r='3' fill='%232d3436'/><circle cx='58' cy='40' r='3' fill='%232d3436'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232d3436'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23fdcb6e' font-family='sans-serif'>1</text></svg>"
  },
  {
    id: 'jogador_dragao',
    name: 'Jogador Dragão (9)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23d35400' stroke='%23f1c40f' stroke-width='2'/><path d='M30 30 Q16 12 26 40 M70 30 Q84 12 74 40' stroke='%23f39c12' stroke-width='4' fill='none'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='43' cy='44' r='2.5' fill='%232d3436'/><circle cx='57' cy='44' r='2.5' fill='%232d3436'/><path d='M43 52 Q50 57 57 52' stroke='%232d3436' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23e67e22'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>9</text></svg>"
  },
  {
    id: 'jogador_detective',
    name: 'Jogador Detetive (7)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%237f8c8d' stroke='%23f1c40f' stroke-width='2'/><path d='M26 34 C26 22 74 22 74 34 Z' fill='%2334495e'/><ellipse cx='50' cy='34' rx='28' ry='4' fill='%232c3e50'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='43' cy='44' r='2.5' fill='%232c3e50'/><circle cx='57' cy='44' r='2.5' fill='%232c3e50'/><path d='M43 52 Q50 56 57 52' stroke='%232c3e50' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2334495e'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23f1c40f' font-family='sans-serif'>7</text></svg>"
  },
  {
    id: 'extremo_canhoto',
    name: 'O Extremo Canhoto (11)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2300cec9' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M30 32 Q50 18 70 32 Z' fill='%232d3436'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 51 Q50 56 57 51' stroke='%232d3436' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%230984e3'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>11</text><path d='M70 70 C76 68 84 76 80 82 Z' fill='%23f1c40f'/></svg>"
  },
  {
    id: 'arbitro_assistente',
    name: 'O Árbitro Assistente (Bandeirinha)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231e272e' stroke='%23ff5e57' stroke-width='2'/><circle cx='48' cy='42' r='16' fill='%23ffdbac'/><path d='M30 34 Q48 22 66 34 Z' fill='%232d3436'/><path d='M62 38 Q66 42 60 48' stroke='%23ff5e57' stroke-width='2' fill='none'/><circle cx='60' cy='48' r='2' fill='%23ff5e57'/><circle cx='42' cy='40' r='2.5' fill='%232d3436'/><circle cx='54' cy='40' r='2.5' fill='%232d3436'/><path d='M42 48 Q48 53 54 48' stroke='%232d3436' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M18 88 C18 68 30 64 48 64 C66 64 78 68 78 88 Z' fill='%23ffdd59'/><path d='M42 64 L48 74 L54 64' fill='%232d3436'/><line x1='70' y1='88' x2='76' y2='38' stroke='%23ff5e57' stroke-width='3' stroke-linecap='round'/><g transform='translate(76, 38)'><rect x='0' y='0' width='18' height='14' fill='%23ffdd59' stroke='%232d3436' stroke-width='1'/><rect x='0' y='0' width='9' height='7' fill='%23ff3f34'/><rect x='9' y='7' width='9' height='7' fill='%23ff3f34'/></g></svg>"
  },
  {
    id: 'jogador_mascarado',
    name: 'O Jogador Mascarado (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%232d3436' stroke='%23e74c3c' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M32 36 C32 28 68 28 68 36 L62 48 H38 Z' fill='%231e272e'/><circle cx='43' cy='40' r='2.5' fill='%23ffffff'/><circle cx='58' cy='40' r='2.5' fill='%23ffffff'/><path d='M43 52 Q50 56 57 52' stroke='%231e272e' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23e74c3c'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'jogador_fantasma',
    name: 'Jogador Fantasma (00)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%230f2027' stroke='%2300cec9' stroke-width='2'/><path d='M30 40 C30 22 70 22 70 40 V68 Q50 78 30 68 Z' fill='%2381ecec' opacity='0.85'/><circle cx='42' cy='42' r='4' fill='%230f2027'/><circle cx='58' cy='42' r='4' fill='%230f2027'/><circle cx='42' cy='42' r='1.5' fill='%2300cec9'/><circle cx='58' cy='42' r='1.5' fill='%2300cec9'/><path d='M44 54 Q50 60 56 54' stroke='%230f2027' stroke-width='2' fill='none'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%2300cec9' font-family='sans-serif'>00</text></svg>"
  },
  {
    id: 'presidente_clube',
    name: 'O Presidente do Clube',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231e3799' stroke='%23f6b93b' stroke-width='2'/><circle cx='50' cy='40' r='16' fill='%23ffdbac'/><path d='M34 30 Q50 18 66 30 Z' fill='%230c2461'/><circle cx='43' cy='40' r='2.5' fill='%230c2461'/><circle cx='57' cy='40' r='2.5' fill='%230c2461'/><path d='M44 48 Q50 52 56 48' stroke='%230c2461' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%230c2461'/><path d='M44 64 L50 82 L56 64' fill='%23ffffff'/><path d='M48 64 L50 80 L52 64' fill='%23f6b93b'/><circle cx='70' cy='74' r='6' fill='%23f6b93b' stroke='%23ffffff' stroke-width='1'/></svg>"
  },
  {
    id: 'treinador_mister_fato',
    name: 'O Treinador Principal (Mister)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%232980b9' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='40' r='16' fill='%23ffdbac'/><path d='M30 26 C30 18 70 18 70 26 Z' fill='%231b4f72'/><circle cx='43' cy='40' r='2.5' fill='%231b4f72'/><circle cx='57' cy='40' r='2.5' fill='%231b4f72'/><path d='M44 48 Q50 52 56 48' stroke='%231b4f72' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%231b4f72'/><rect x='64' y='66' width='16' height='20' rx='2' fill='%2327ae60' stroke='%23ffffff' stroke-width='1'/><circle cx='72' cy='76' r='4' stroke='%23ffffff' stroke-width='1' fill='none'/></svg>"
  },
  {
    id: 'guarda_redes_galactico',
    name: 'O Guarda-Redes Galáctico (1)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23130f40' stroke='%2300cec9' stroke-width='2'/><circle cx='50' cy='44' r='18' fill='%23ffdbac'/><path d='M28 32 C28 20 72 20 72 32 Z' fill='%2330336b'/><rect x='34' y='38' width='32' height='10' rx='3' fill='%2300cec9' opacity='0.85'/><circle cx='43' cy='43' r='2' fill='%23ffffff'/><circle cx='57' cy='43' r='2' fill='%23ffffff'/><path d='M43 52 Q50 56 57 52' stroke='%2330336b' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2300cec9'/><rect x='16' y='74' width='10' height='14' rx='3' fill='%23f6b93b' stroke='%23130f40' stroke-width='1.5'/><rect x='74' y='74' width='10' height='14' rx='3' fill='%23f6b93b' stroke='%23130f40' stroke-width='1.5'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23130f40' font-family='sans-serif'>1</text></svg>"
  },

  // 7 AVATARES FEMININOS DE FUTEBOL
  {
    id: 'jogadora_capita_10',
    name: 'A Capitã de Equipa (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2300cec9' stroke='%23ffffff' stroke-width='2'/><path d='M24 38 Q18 52 28 60' stroke='%23f1c40f' stroke-width='8' fill='none' stroke-linecap='round'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><path d='M30 32 C34 20 66 20 70 32 Z' fill='%23f1c40f'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 51 Q50 56 57 51' stroke='%23e74c3c' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%230984e3'/><rect x='22' y='72' width='14' height='10' rx='2' fill='%23f1c40f'/><text x='29' y='80' font-size='9' font-weight='900' text-anchor='middle' fill='%232d3436' font-family='sans-serif'>C</text><text x='58' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'jogadora_guarda_redes_1',
    name: 'A Guarda-Redes (1)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%236c5ce7' stroke='%23a29bfe' stroke-width='2'/><path d='M74 38 Q82 52 72 60' stroke='%232d3436' stroke-width='8' fill='none' stroke-linecap='round'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><path d='M30 32 C34 20 66 20 70 32 Z' fill='%232d3436'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 51 Q50 55 57 51' stroke='%232d3436' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23e84393'/><rect x='16' y='74' width='10' height='14' rx='3' fill='%23fdcb6e' stroke='%232d3436' stroke-width='1.5'/><rect x='74' y='74' width='10' height='14' rx='3' fill='%23fdcb6e' stroke='%232d3436' stroke-width='1.5'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>1</text></svg>"
  },
  {
    id: 'jogadora_avancada_9',
    name: 'A Avançada Matadora (9)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23d63031' stroke='%23ff7675' stroke-width='2'/><circle cx='50' cy='22' r='8' fill='%232d3436'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><rect x='30' y='30' width='40' height='6' fill='%23ff7675'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 51 Q50 56 57 51' stroke='%23d63031' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23d63031'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>9</text><circle cx='76' cy='72' r='6' fill='%23ffffff' stroke='%232d3436' stroke-width='1'/><polygon points='76,69 78,71 77,74 75,74 74,71' fill='%232d3436'/></svg>"
  },
  {
    id: 'jogadora_maestrina_10',
    name: 'A Maestrina (10)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2300b894' stroke='%2355efc4' stroke-width='2'/><path d='M22 36 C16 20 84 20 78 36 C84 54 16 54 22 36 Z' fill='%23d63031'/><circle cx='50' cy='44' r='16' fill='%23e0ac69'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 51 Q50 56 57 51' stroke='%23d63031' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%2300b894'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>"
  },
  {
    id: 'jogadora_extrema_7',
    name: 'A Extremista Velocista (7)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23fdcb6e' stroke='%23d35400' stroke-width='2'/><path d='M24 38 Q18 52 26 62' stroke='%232d3436' stroke-width='6' fill='none'/><path d='M76 38 Q82 52 74 62' stroke='%232d3436' stroke-width='6' fill='none'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><path d='M30 32 C34 20 66 20 70 32 Z' fill='%232d3436'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 51 Q50 56 57 51' stroke='%23e74c3c' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23e17055'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>7</text></svg>"
  },
  {
    id: 'jogadora_arbitra',
    name: 'A Árbitra Principal',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%232d3436' stroke='%23fdcb6e' stroke-width='2'/><path d='M74 38 Q82 52 74 60' stroke='%23fdcb6e' stroke-width='8' fill='none' stroke-linecap='round'/><circle cx='50' cy='42' r='16' fill='%23ffdbac'/><circle cx='44' cy='40' r='2.5' fill='%232d3436'/><circle cx='56' cy='40' r='2.5' fill='%232d3436'/><rect x='48' y='48' width='10' height='6' fill='%23c8d6e5'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23fdcb6e'/><path d='M32 64 V88 M41 64 V88 M50 64 V88 M59 64 V88 M68 64 V88' stroke='%232d3436' stroke-width='4'/></svg>"
  },
  {
    id: 'jogadora_treinadora',
    name: 'A Treinadora (Mister)',
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2300cec9' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='22' r='8' fill='%232d3436'/><circle cx='50' cy='40' r='16' fill='%23ffdbac'/><rect x='34' y='36' width='14' height='8' rx='2' fill='none' stroke='%232d3436' stroke-width='1.5'/><rect x='52' y='36' width='14' height='8' rx='2' fill='none' stroke='%232d3436' stroke-width='1.5'/><line x1='48' y1='40' x2='52' y2='40' stroke='%232d3436' stroke-width='1.5'/><circle cx='43' cy='40' r='2' fill='%232d3436'/><circle cx='57' cy='40' r='2' fill='%232d3436'/><path d='M44 48 Q50 52 56 48' stroke='%232d3436' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%232d3436'/><rect x='64' y='66' width='16' height='20' rx='2' fill='%2327ae60' stroke='%23ffffff' stroke-width='1'/><circle cx='72' cy='76' r='4' stroke='%23ffffff' stroke-width='1' fill='none'/></svg>"
  }
];

let pendingAvatarUrl = '';
let currentAvatarUrl = '';

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneDisplayMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function normalizeUserSettings(rawSettings) {
  return {
    pushEnabled: rawSettings?.pushEnabled === true,
    pushSubscriptions: Array.isArray(rawSettings?.pushSubscriptions) ? rawSettings.pushSubscriptions : []
  };
}

function getNotificationSupportState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return {
      supported: false,
      message: 'Este dispositivo/browser não suporta notificações web.'
    };
  }

  if (isIosDevice() && !isStandaloneDisplayMode()) {
    return {
      supported: false,
      message: 'No iPhone/iPad, instala a app no ecrã principal para ativar notificações.'
    };
  }

  return {
    supported: true,
    message: ''
  };
}

function base64UrlToUint8Array(base64UrlValue) {
  const padding = '='.repeat((4 - (base64UrlValue.length % 4)) % 4);
  const normalized = (base64UrlValue + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none'
  });

  return navigator.serviceWorker.ready;
}

async function getCurrentSubscription() {
  const registration = await getServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

function buildStoredSubscription(subscription) {
  const json = subscription.toJSON();

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: json.keys || {},
    userAgent: navigator.userAgent,
    standalone: isStandaloneDisplayMode(),
    platform: navigator.platform || 'unknown',
    updatedAtIso: new Date().toISOString()
  };
}

function mergeSubscriptions(existingSubscriptions, nextSubscription) {
  const filtered = existingSubscriptions.filter(
    (subscription) => subscription.endpoint !== nextSubscription.endpoint
  );

  return [...filtered, nextSubscription];
}

function removeSubscriptionByEndpoint(existingSubscriptions, endpoint) {
  return existingSubscriptions.filter((subscription) => subscription.endpoint !== endpoint);
}

function setDeviceStatus(message, tone = '') {
  if (!deviceStatus) return;
  deviceStatus.textContent = message;
  deviceStatus.className = 'notifications-device-status';

  if (tone) {
    deviceStatus.classList.add(tone);
  }
}

async function upsertCurrentSubscription(subscription) {
  if (!activeUserId) {
    return;
  }

  const userRef = doc(db, 'users', activeUserId);
  const userSnapshot = await getDoc(userRef);
  const userSettings = normalizeUserSettings(userSnapshot.data()?.[USER_SETTINGS_FIELD]);
  const nextSubscription = buildStoredSubscription(subscription);
  const nextSubscriptions = mergeSubscriptions(userSettings.pushSubscriptions, nextSubscription);

  await setDoc(userRef, {
    [USER_SETTINGS_FIELD]: {
      ...userSettings,
      pushEnabled: nextSubscriptions.length > 0,
      pushSubscriptions: nextSubscriptions,
      updatedAt: serverTimestamp()
    }
  }, { merge: true });
}

async function removeCurrentSubscription(subscription) {
  if (!activeUserId || !subscription) {
    return;
  }

  const userRef = doc(db, 'users', activeUserId);
  const userSnapshot = await getDoc(userRef);
  const userSettings = normalizeUserSettings(userSnapshot.data()?.[USER_SETTINGS_FIELD]);
  const nextSubscriptions = removeSubscriptionByEndpoint(
    userSettings.pushSubscriptions,
    subscription.endpoint
  );

  await setDoc(userRef, {
    [USER_SETTINGS_FIELD]: {
      ...userSettings,
      pushEnabled: nextSubscriptions.length > 0,
      pushSubscriptions: nextSubscriptions,
      updatedAt: serverTimestamp()
    }
  }, { merge: true });
}

async function syncDeviceState() {
  const supportState = getNotificationSupportState();

  if (!supportState.supported) {
    if (enableDeviceButton) enableDeviceButton.disabled = true;
    if (disableDeviceButton) disableDeviceButton.disabled = true;
    setDeviceStatus('Desligado', 'is-error');
    currentDeviceSubscription = null;
    return;
  }

  if (enableDeviceButton) enableDeviceButton.disabled = false;
  try {
    currentDeviceSubscription = await getCurrentSubscription();
  } catch (error) {
    console.error('Erro ao preparar o service worker das notificações:', error);
    currentDeviceSubscription = null;
    setDeviceStatus('Desligado', 'is-error');
    return;
  }

  if (Notification.permission === 'denied') {
    if (enableDeviceButton) enableDeviceButton.disabled = true;
    if (disableDeviceButton) disableDeviceButton.disabled = true;
    setDeviceStatus('Desligado', 'is-error');
    return;
  }

  if (currentDeviceSubscription) {
    if (disableDeviceButton) disableDeviceButton.disabled = false;
    setDeviceStatus('Ligado', 'is-ok');
    return;
  }

  if (disableDeviceButton) disableDeviceButton.disabled = true;
  setDeviceStatus('Desligado', 'is-error');
}

async function enableNotificationsForDevice() {
  const supportState = getNotificationSupportState();
  if (!supportState.supported) {
    setDeviceStatus(supportState.message, 'is-warn');
    return;
  }

  if (enableDeviceButton) enableDeviceButton.disabled = true;
  setDeviceStatus('A ativar notificações neste dispositivo...', 'is-warn');

  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      setDeviceStatus('Permissão não concedida. Sem isso não dá para enviar avisos push.', 'is-error');
      return;
    }

    const registration = await getServiceWorkerRegistration();
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(MARKET_NOTIFICATIONS_VAPID_PUBLIC_KEY)
    });

    currentDeviceSubscription = subscription;
    await upsertCurrentSubscription(subscription);
    setDeviceStatus('Notificações ativadas com sucesso neste dispositivo.', 'is-ok');
  } catch (error) {
    console.error('Erro ao ativar notificações push:', error);
    setDeviceStatus('Não foi possível ativar as notificações neste dispositivo.', 'is-error');
  } finally {
    await syncDeviceState();
  }
}

async function disableNotificationsForDevice() {
  if (!currentDeviceSubscription) {
    await syncDeviceState();
    return;
  }

  if (disableDeviceButton) disableDeviceButton.disabled = true;
  setDeviceStatus('A desligar notificações deste dispositivo...', 'is-warn');

  try {
    await currentDeviceSubscription.unsubscribe();
    await removeCurrentSubscription(currentDeviceSubscription);
    currentDeviceSubscription = null;
    setDeviceStatus('Notificações desligadas neste dispositivo.', 'is-ok');
  } catch (error) {
    console.error('Erro ao desligar notificações push:', error);
    setDeviceStatus('Não foi possível desligar as notificações deste dispositivo.', 'is-error');
  } finally {
    await syncDeviceState();
  }
}

// --- CONTROLO DE ABAS (NOTIFICAÇÕES & AVATAR) ---
function setupTabSwitching() {
  const tabBtnNotifications = document.getElementById('tabBtnNotifications');
  const tabBtnAvatar = document.getElementById('tabBtnAvatar');
  const tabPaneNotifications = document.getElementById('tabPaneNotifications');
  const tabPaneAvatar = document.getElementById('tabPaneAvatar');

  if (!tabBtnNotifications || !tabBtnAvatar || !tabPaneNotifications || !tabPaneAvatar) {
    return;
  }

  tabBtnNotifications.addEventListener('click', () => {
    tabBtnNotifications.classList.add('active');
    tabBtnAvatar.classList.remove('active');
    tabPaneNotifications.classList.add('active');
    tabPaneAvatar.classList.remove('active');
  });

  tabBtnAvatar.addEventListener('click', () => {
    tabBtnAvatar.classList.add('active');
    tabBtnNotifications.classList.remove('active');
    tabPaneAvatar.classList.add('active');
    tabPaneNotifications.classList.remove('active');
  });
}

// --- LÓGICA DO AVATAR ---
function updateAvatarDisplays(url) {
  updateAvatarPreview(url);

  const headerImg = document.getElementById('profileHeaderAvatarImg');
  const headerIcon = document.getElementById('profileHeaderAvatarIcon');

  // Atualiza avatar no cabeçalho da página
  if (url) {
    if (headerImg) {
      headerImg.src = url;
      headerImg.style.display = 'block';
    }
    if (headerIcon) headerIcon.style.display = 'none';
  } else {
    if (headerImg) {
      headerImg.src = '';
      headerImg.style.display = 'none';
    }
    if (headerIcon) headerIcon.style.display = 'block';
  }
}

function updateAvatarPreview(url) {
  const previewImg = document.getElementById('avatarPreviewImg');
  const previewDefault = document.getElementById('avatarPreviewDefault');
  const previewHint = document.getElementById('avatarPreviewHint');

  const preset = PRESET_AVATARS.find((p) => p.url === url);
  const avatarName = preset ? preset.name : (url ? 'Personalizado' : 'Nenhum');

  if (previewHint) {
    previewHint.textContent = `Avatar: ${avatarName}`;
  }

  if (url) {
    if (previewImg) {
      previewImg.src = url;
      previewImg.style.display = 'block';
    }
    if (previewDefault) previewDefault.style.display = 'none';
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (previewDefault) previewDefault.style.display = 'block';
  }
}

function updateAvatarFuseUI() {
  const saveBtn = document.getElementById('saveAvatarBtn');
  const removeBtn = document.getElementById('removeAvatarBtn');
  const grid = document.getElementById('presetAvatarsGrid');
  const tabPaneAvatar = document.getElementById('tabPaneAvatar');

  let warningEl = document.getElementById('avatarFuseDisabledMsg');

  if (!avatarFuseEnabled) {
    if (!warningEl && tabPaneAvatar) {
      warningEl = document.createElement('div');
      warningEl.id = 'avatarFuseDisabledMsg';
      warningEl.className = 'avatar-fuse-disabled-warning';
      warningEl.innerHTML = '<i class="fas fa-lock"></i> A escolha de avatares está temporariamente desativada pelo administrador.';
      warningEl.style.cssText = 'background: rgba(231, 76, 60, 0.15); border: 1px solid rgba(231, 76, 60, 0.4); color: #ff6b6b; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; margin-bottom: 14px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;';
      tabPaneAvatar.prepend(warningEl);
    } else if (warningEl) {
      warningEl.style.display = 'flex';
    }

    if (saveBtn) saveBtn.disabled = true;
    if (removeBtn) removeBtn.disabled = true;
    if (grid) grid.style.pointerEvents = 'none';
  } else {
    if (warningEl) {
      warningEl.style.display = 'none';
    }
    if (saveBtn) saveBtn.disabled = false;
    if (removeBtn) removeBtn.disabled = false;
    if (grid) grid.style.pointerEvents = 'auto';
  }
}

function renderPresetAvatars() {
  const grid = document.getElementById('presetAvatarsGrid');
  if (!grid) return;

  grid.innerHTML = '';
  PRESET_AVATARS.forEach((preset) => {
    const item = document.createElement('div');
    item.className = 'preset-avatar-item';

    const img = document.createElement('img');
    img.src = preset.url;
    img.alt = preset.name;
    item.appendChild(img);

    const isOccupiedByOther = occupiedAvatars[preset.url] || occupiedAvatars[preset.id];

    if (!avatarFuseEnabled) {
      item.classList.add('disabled-occupied');
      item.title = 'Seleção de avatares desativada';
    } else if (isOccupiedByOther) {
      item.classList.add('disabled-occupied');
      item.title = `${preset.name} (Em uso por outro utilizador)`;

      const lockBadge = document.createElement('div');
      lockBadge.className = 'avatar-occupied-badge';
      lockBadge.innerHTML = '<i class="fas fa-lock"></i>';
      item.appendChild(lockBadge);
    } else {
      item.title = preset.name;

      if (pendingAvatarUrl === preset.url) {
        item.classList.add('selected');
      }

      item.addEventListener('click', () => {
        document.querySelectorAll('.preset-avatar-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        pendingAvatarUrl = preset.url;

        updateAvatarPreview(pendingAvatarUrl);
      });
    }

    grid.appendChild(item);
  });
}

function setAvatarStatus(message, tone = '') {
  const statusEl = document.getElementById('avatarStatusMsg');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = 'avatar-status-msg';
  if (tone) statusEl.classList.add(tone);
}

function setupAvatarListeners() {
  const saveBtn = document.getElementById('saveAvatarBtn');
  const removeBtn = document.getElementById('removeAvatarBtn');

  saveBtn?.addEventListener('click', async () => {
    if (!activeUserId) return;

    if (!avatarFuseEnabled) {
      setAvatarStatus('A escolha de avatares está desativada pelo administrador.', 'is-error');
      return;
    }

    if (pendingAvatarUrl && (occupiedAvatars[pendingAvatarUrl] || occupiedAvatars[pendingAvatarUrl])) {
      setAvatarStatus('Este avatar já está a ser utilizado por outro utilizador!', 'is-error');
      return;
    }

    saveBtn.disabled = true;
    setAvatarStatus('A guardar avatar...', '');

    try {
      const userRef = doc(db, 'users', activeUserId);
      // Guarda tanto no campo 'avatar' como no 'avatarUrl' na coleção 'users'
      await setDoc(userRef, {
        avatar: pendingAvatarUrl,
        avatarUrl: pendingAvatarUrl
      }, { merge: true });

      currentAvatarUrl = pendingAvatarUrl;
      updateAvatarDisplays(currentAvatarUrl);
      setAvatarStatus('Avatar guardado com sucesso!', 'is-ok');
    } catch (error) {
      console.error('Erro ao guardar avatar:', error);
      setAvatarStatus('Não foi possível guardar o avatar.', 'is-error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  removeBtn?.addEventListener('click', async () => {
    if (!activeUserId) return;

    if (!avatarFuseEnabled) {
      setAvatarStatus('A escolha de avatares está desativada pelo administrador.', 'is-error');
      return;
    }

    removeBtn.disabled = true;
    setAvatarStatus('A remover avatar...', '');

    try {
      const userRef = doc(db, 'users', activeUserId);
      await setDoc(userRef, {
        avatar: '',
        avatarUrl: ''
      }, { merge: true });

      pendingAvatarUrl = '';
      currentAvatarUrl = '';
      document.querySelectorAll('.preset-avatar-item').forEach(el => el.classList.remove('selected'));
      updateAvatarDisplays('');
      setAvatarStatus('Avatar removido.', 'is-ok');
    } catch (error) {
      console.error('Erro ao remover avatar:', error);
      setAvatarStatus('Não foi possível remover o avatar.', 'is-error');
    } finally {
      removeBtn.disabled = false;
    }
  });
}

function openNotificationsPopup() {
  if (!popup) {
    return;
  }

  popup.style.display = 'flex';
}

function closeNotificationsPopup() {
  if (!popup) {
    return;
  }

  popup.style.display = 'none';
}

function bindEvents() {
  if (areEventsBound) {
    return;
  }

  closePopupButton?.addEventListener('click', closeNotificationsPopup);
  popup?.addEventListener('click', (event) => {
    if (event.target === popup) {
      closeNotificationsPopup();
    }
  });

  enableDeviceButton?.addEventListener('click', enableNotificationsForDevice);
  disableDeviceButton?.addEventListener('click', disableNotificationsForDevice);

  setupTabSwitching();
  setupAvatarListeners();

  window.addEventListener(NOTIFICATION_OPEN_EVENT, openNotificationsPopup);
  areEventsBound = true;
}

function cleanupListeners() {
  if (typeof userSettingsUnsubscribe === 'function') {
    userSettingsUnsubscribe();
    userSettingsUnsubscribe = null;
  }
  if (typeof allUsersAvatarsUnsubscribe === 'function') {
    allUsersAvatarsUnsubscribe();
    allUsersAvatarsUnsubscribe = null;
  }
  if (typeof profilePanelUnsubscribe === 'function') {
    profilePanelUnsubscribe();
    profilePanelUnsubscribe = null;
  }
}

export async function initProfileNotifications(user) {
  bindEvents();
  cleanupListeners();

  activeUserId = user?.uid || null;

  if (!activeUserId) {
    currentSettings = { ...MARKET_NOTIFICATIONS_DEFAULTS };
    return;
  }

  // Listener do fusível 'paineis perfil' (campo 'avatar')
  const profilePanelRef = doc(db, 'paineis', 'paineis perfil');
  profilePanelUnsubscribe = onSnapshot(profilePanelRef, (snap) => {
    const data = snap.data();
    avatarFuseEnabled = data?.avatar !== 'off';
    updateAvatarFuseUI();
  }, (error) => {
    console.error('Erro ao ouvir fusível de avatares:', error);
  });

  // Ouvinte em tempo real da coleção 'users' para identificar avatares já ocupados por outros utilizadores
  const usersCollRef = collection(db, 'users');
  allUsersAvatarsUnsubscribe = onSnapshot(usersCollRef, (snapshot) => {
    occupiedAvatars = {};
    snapshot.forEach((docSnap) => {
      const uId = docSnap.id;
      const uData = docSnap.data();
      const uAvatar = uData?.avatar || uData?.avatarUrl || '';
      if (uAvatar && uId !== activeUserId) {
        occupiedAvatars[uAvatar] = uId;
      }
    });

    renderPresetAvatars();
  }, (error) => {
    console.error('Erro ao ouvir avatares em uso:', error);
  });

  const userRef = doc(db, 'users', activeUserId);
  userSettingsUnsubscribe = onSnapshot(userRef, async (snapshot) => {
    const data = snapshot.data();
    currentSettings = normalizeUserSettings(data?.[USER_SETTINGS_FIELD]);
    currentAvatarUrl = data?.avatar || data?.avatarUrl || '';
    pendingAvatarUrl = currentAvatarUrl;

    updateAvatarDisplays(currentAvatarUrl);
    renderPresetAvatars();
    await syncDeviceState();
  }, (error) => {
    console.error('Erro ao ler as definições de notificações e utilizador:', error);
    setDeviceStatus('Não foi possível ler o estado das definições.', 'is-error');
  });
}

export function closeProfileNotificationsPopup() {
  closeNotificationsPopup();
}
