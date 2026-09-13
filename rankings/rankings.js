import { db, auth } from "../core/firebase.js";
import { doc, getDoc, collection, getDocs, query, where, updateDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { checkPageContentAccess } from "../js/page-content-guard.js";
import { buildAlfredoGiftMessage, CADERNETA_GIFT_OFFERS_COLLECTION, CADERNETA_GIFT_REDIRECT_PARAM } from "../caderneta/pack-offers.js";
import { getLatestSeason, mergeUserSeasonData } from "../core/user-season.js";

function logUserAction(actionDescription) {
    if (!auth.currentUser) {
        console.log("Nenhum utilizador logado para registar a ação.");
        return;
    }
    
    try {
        const eyeCollection = collection(db, 'eye');
        void addDoc(eyeCollection, {
            dataacao: serverTimestamp(),
            acao: actionDescription,
            userId: auth.currentUser.uid
        }).catch((error) => console.error("Erro ao registar a acção na coleção 'eye':", error));
    } catch (error) {
        console.error("Erro ao registar ação na coleção 'eye':", error);
    }
}

const modCache = new Map();
const userCache = new Map();
const gameCache = new Map();
let usersSnapshotPromise = null;

const PRESET_AVATARS_LIST = [
  { id: 'pele_rei', name: 'Pelé - O Rei (10)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23009739' stroke='%23ffdf00' stroke-width='2'/><path d='M25 32 L20 18 L36 24 L50 14 L64 24 L80 18 L75 32 Z' fill='%23ffdf00' stroke='%23d4ac0d' stroke-width='1.5'/><circle cx='50' cy='22' r='3' fill='%23002776'/><circle cx='50' cy='46' r='18' fill='%23795548'/><path d='M33 34 C40 26 60 26 67 34 C60 30 40 30 33 34 Z' fill='%23212121'/><circle cx='43' cy='44' r='2.5' fill='%23212121'/><circle cx='57' cy='44' r='2.5' fill='%23212121'/><path d='M42 53 Q50 59 58 53' stroke='%23212121' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23ffdf00'/><path d='M44 64 L50 74 L56 64' fill='%23009739'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23002776' font-family='sans-serif'>10</text></svg>" },
  { id: 'maradona_dios', name: 'Maradona - Díos (10)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2374b9ff' stroke='%23ffffff' stroke-width='2'/><ellipse cx='50' cy='22' rx='22' ry='5' stroke='%23f1c40f' stroke-width='3' fill='none'/><path d='M22 36 C16 20 84 20 78 36 C84 50 16 50 22 36 Z' fill='%232d3436'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='43' cy='44' r='2.5' fill='%232d3436'/><circle cx='57' cy='44' r='2.5' fill='%232d3436'/><path d='M42 53 Q50 59 58 53' stroke='%232d3436' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%2374b9ff'/><path d='M40 64 V88 M50 64 V88 M60 64 V88' stroke='%23ffffff' stroke-width='5'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%232d3436' font-family='sans-serif'>10</text></svg>" },
  { id: 'eusebio_pantera', name: 'Eusébio - Pantera Negra (13)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23d63031' stroke='%23ffdd59' stroke-width='2'/><circle cx='50' cy='45' r='18' fill='%234e342e'/><path d='M32 36 Q50 24 68 36 Z' fill='%23212121'/><circle cx='43' cy='43' r='2.5' fill='%23ffffff'/><circle cx='57' cy='43' r='2.5' fill='%23ffffff'/><path d='M42 53 Q50 59 58 53' stroke='%23ffffff' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23d63031'/><path d='M44 64 L50 74 L56 64' fill='%2300b894'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffdd59' font-family='sans-serif'>13</text></svg>" },
  { id: 'beckenbauer_kaiser', name: 'Beckenbauer - Kaiser (5)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%232c3e50' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='43' r='17' fill='%23ffdbac'/><path d='M32 34 Q50 22 68 34 Q50 28 32 34' fill='%23f5cd79'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 51 Q50 55 57 51' stroke='%232c3e50' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23ffffff'/><rect x='24' y='72' width='14' height='10' fill='%23f1c40f'/><text x='31' y='80' font-size='9' font-weight='900' text-anchor='middle' fill='%232c3e50' font-family='sans-serif'>C</text><text x='58' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%232c3e50' font-family='sans-serif'>5</text></svg>" },
  { id: 'cruyff_14', name: 'Cruyff - Carrossel (14)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23ff793f' stroke='%23ffffff' stroke-width='2'/><path d='M28 30 C24 45 26 55 28 60 M72 30 C76 45 74 55 72 60' stroke='%23f5cd79' stroke-width='6' fill='none'/><circle cx='50' cy='44' r='16' fill='%23ffeaa7'/><path d='M32 34 Q50 20 68 34 Q50 28 32 34' fill='%23f5cd79'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 50 Q50 54 57 50' stroke='%232d3436' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23ff793f'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>14</text></svg>" },
  { id: 'capitao_equipa', name: 'O Capitão de Equipa', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2310ac84' stroke='%23ffdd59' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M30 34 Q50 20 70 34 Z' fill='%23222f3e'/><circle cx='43' cy='42' r='2.5' fill='%23222f3e'/><circle cx='57' cy='42' r='2.5' fill='%23222f3e'/><path d='M43 50 Q50 55 57 50' stroke='%23222f3e' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23ee5253'/><path d='M44 64 L50 72 L56 64' fill='%23222f3e'/><rect x='22' y='72' width='14' height='10' rx='2' fill='%23ffdd59'/><text x='29' y='80' font-size='9' font-weight='900' text-anchor='middle' fill='%23222f3e' font-family='sans-serif'>C</text><circle cx='58' cy='76' r='5' fill='%23ffffff' stroke='%23222f3e' stroke-width='1'/><polygon points='58,73 60,75 59,78 57,78 56,75' fill='%23222f3e'/></svg>" },
  { id: 'guarda_redes_paredao', name: 'O Guarda-Redes (1)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2327ae60' stroke='%23f1c40f' stroke-width='2'/><path d='M28 34 C28 22 72 22 72 34 V38 H28 Z' fill='%23f1c40f'/><path d='M20 38 H80 L74 42 H26 Z' fill='%23f39c12'/><circle cx='50' cy='48' r='16' fill='%23ffdbac'/><circle cx='43' cy='46' r='2.5' fill='%232c3e50'/><circle cx='57' cy='46' r='2.5' fill='%232c3e50'/><path d='M43 54 Q50 58 57 54' stroke='%232c3e50' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23e67e22'/><rect x='16' y='74' width='10' height='14' rx='3' fill='%23f1c40f' stroke='%232c3e50' stroke-width='1.5'/><rect x='74' y='74' width='10' height='14' rx='3' fill='%23f1c40f' stroke='%232c3e50' stroke-width='1.5'/><text x='50' y='83' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>1</text></svg>" },
  { id: 'goleador_matador', name: 'O Avançado Matador (9)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23e74c3c' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M30 32 L50 18 L70 32 Z' fill='%232c3e50'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M42 51 Q50 57 58 51' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%232c3e50'/><text x='50' y='83' font-size='15' font-weight='900' text-anchor='middle' fill='%23f1c40f' font-family='sans-serif'>9</text><circle cx='76' cy='72' r='7' fill='%23ffffff' stroke='%232c3e50' stroke-width='1.5'/><polygon points='76,68 78,70 77,73 75,73 74,70' fill='%232c3e50'/></svg>" },
  { id: 'jovem_prodigio', name: 'O Jovem Prodígio (10)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%238e44ad' stroke='%2300cec9' stroke-width='2'/><path d='M26 40 C26 20 74 20 74 40' stroke='%2300cec9' stroke-width='5' fill='none'/><rect x='22' y='36' width='8' height='14' rx='4' fill='%2334495e'/><rect x='70' y='36' width='8' height='14' rx='4' fill='%2334495e'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M30 32 C38 20 62 20 70 32 Q50 28 30 32' fill='%23f1c40f'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 51 Q50 56 57 51' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%2334495e'/><text x='50' y='83' font-size='15' font-weight='900' text-anchor='middle' fill='%2300cec9' font-family='sans-serif'>10</text></svg>" },
  { id: 'mister_treinador', name: 'O Mister / Treinador Tático', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2334495e' stroke='%23bdc3c7' stroke-width='2'/><circle cx='50' cy='40' r='16' fill='%23ffdbac'/><path d='M32 30 Q50 18 68 30 Z' fill='%232c3e50'/><circle cx='43' cy='40' r='2.5' fill='%232c3e50'/><circle cx='57' cy='40' r='2.5' fill='%232c3e50'/><path d='M44 48 Q50 52 56 48' stroke='%232c3e50' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%232c3e50'/><path d='M44 64 L50 82 L56 64' fill='%23ffffff'/><path d='M48 64 L50 80 L52 64' fill='%23e74c3c'/><rect x='68' y='68' width='16' height='20' rx='2' fill='%2327ae60' stroke='%23ffffff' stroke-width='1'/><circle cx='76' cy='78' r='4' stroke='%23ffffff' stroke-width='1' fill='none'/></svg>" },
  { id: 'arbitro_juiz', name: 'O Árbitro / Juiz', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23222f3e' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='42' r='16' fill='%23ffdd59'/><circle cx='44' cy='40' r='2.5' fill='%23222f3e'/><circle cx='56' cy='40' r='2.5' fill='%23222f3e'/><rect x='48' y='48' width='10' height='6' fill='%23c8d6e5'/><path d='M58 51 H66' stroke='%23c8d6e5' stroke-width='2'/><path d='M20 88 C20 68 32 64 50 64 C68 64 80 68 80 88 Z' fill='%23f1c40f'/><path d='M32 64 V88 M41 64 V88 M50 64 V88 M59 64 V88 M68 64 V88' stroke='%23222f3e' stroke-width='4'/><rect x='28' y='72' width='8' height='12' rx='1' fill='%23e74c3c'/></svg>" },
  { id: 'ultra_adepto', name: 'O Ultra / Adepto de Curva', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23e67e22' stroke='%23ffffff' stroke-width='2'/><rect x='30' y='24' width='40' height='12' rx='6' fill='%23c0392b'/><circle cx='50' cy='20' r='4' fill='%23f1c40f'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 50 Q50 56 57 50' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232c3e50'/><rect x='24' y='62' width='52' height='12' rx='4' fill='%23c0392b'/><path d='M34 62 V74 M46 62 V74 M58 62 V74 M70 62 V74' stroke='%23f1c40f' stroke-width='4'/></svg>" },
  { id: 'veterano_camisola10', name: 'O Veterano (10)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2316a085' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='42' r='17' fill='%23e0ac69'/><path d='M34 46 C34 56 66 56 66 46 Z' fill='%232c3e50'/><circle cx='43' cy='40' r='2.5' fill='%23ffffff'/><circle cx='57' cy='40' r='2.5' fill='%23ffffff'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2316a085'/><path d='M44 66 L50 76 L56 66' fill='%23ffffff'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>" },
  { id: 'velocista_raio', name: 'O Velocista (11)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23f39c12' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='42' r='17' fill='%23ffdbac'/><path d='M30 30 Q50 18 70 30 Z' fill='%23e74c3c'/><rect x='30' y='32' width='40' height='6' fill='%232c3e50'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 51 Q50 56 57 51' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23e74c3c'/><polygon points='32,68 24,78 30,78 26,86 38,74 30,74' fill='%23f1c40f'/><text x='58' y='83' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>11</text></svg>" },
  { id: 'trinco_destruidor', name: 'O Trinco Destruidor (6)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2334495e' stroke='%23e74c3c' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%238d5524'/><path d='M30 32 Q50 20 70 32 Z' fill='%232c3e50'/><circle cx='43' cy='42' r='2.5' fill='%23ffffff'/><circle cx='57' cy='42' r='2.5' fill='%23ffffff'/><path d='M42 50 H58' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232c3e50'/><text x='50' y='83' font-size='15' font-weight='900' text-anchor='middle' fill='%23e74c3c' font-family='sans-serif'>6</text></svg>" },
  { id: 'jogador_samurai', name: 'Jogador Samurai (8)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23c0392b' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='20' r='6' fill='%232c3e50'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><rect x='30' y='30' width='40' height='7' fill='%23ffffff'/><circle cx='50' cy='33.5' r='2.5' fill='%23c0392b'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 50 Q50 55 57 50' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232980b9'/><path d='M44 66 L50 74 L56 66' fill='%23ffffff'/><text x='50' y='84' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>8</text><circle cx='76' cy='74' r='6' fill='%23ffffff' stroke='%232c3e50' stroke-width='1'/><polygon points='76,71 78,73 77,76 75,76 74,73' fill='%232c3e50'/></svg>" },
  { id: 'jogador_ninja', name: 'Jogador Ninja (7)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231e272e' stroke='%23ff5e57' stroke-width='2'/><path d='M26 30 C26 20 74 20 74 30 V65 C74 74 26 74 26 65 Z' fill='%232d3436'/><rect x='30' y='38' width='40' height='14' rx='4' fill='%23ffdbac'/><circle cx='41' cy='45' r='3.5' fill='%232d3436'/><circle cx='59' cy='45' r='3.5' fill='%232d3436'/><rect x='24' y='32' width='52' height='6' rx='2' fill='%23ff5e57'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23ff5e57'/><text x='50' y='84' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>7</text><circle cx='24' cy='74' r='6' fill='%23ffffff' stroke='%232d3436' stroke-width='1'/><polygon points='24,71 26,73 25,76 23,76 22,73' fill='%232d3436'/></svg>" },
  { id: 'jogador_cyborg', name: 'Jogador Cyborg (99)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%232c3e50' stroke='%2300cec9' stroke-width='2'/><rect x='30' y='26' width='40' height='36' rx='8' fill='%23bdc3c7'/><rect x='34' y='34' width='32' height='12' rx='4' fill='%2300cec9'/><circle cx='42' cy='40' r='3' fill='%23ffffff'/><circle cx='58' cy='40' r='3' fill='%23ffffff'/><rect x='42' y='52' width='16' height='4' rx='2' fill='%232c3e50'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2300cec9'/><text x='50' y='84' font-size='14' font-weight='900' text-anchor='middle' fill='%232c3e50' font-family='sans-serif'>99</text></svg>" },
  { id: 'jogador_viking', name: 'Jogador Viking (4)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23576574' stroke='%23ff9f43' stroke-width='2'/><path d='M26 38 C26 24 74 24 74 38 Z' fill='%238395a7'/><path d='M20 38 Q10 20 28 24 Q24 34 28 38' fill='%23c8d6e5'/><path d='M80 38 Q90 20 72 24 Q76 34 72 38' fill='%23c8d6e5'/><circle cx='50' cy='48' r='14' fill='%23ffdbac'/><circle cx='44' cy='46' r='2.5' fill='%23222f3e'/><circle cx='56' cy='46' r='2.5' fill='%23222f3e'/><path d='M34 52 C34 74 66 74 66 52 Z' fill='%23ff9f43'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%230984e3'/><text x='50' y='84' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>4</text></svg>" },
  { id: 'jogador_rei', name: 'Jogador Rei Campeão (10)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%236c5ce7' stroke='%23f1c40f' stroke-width='2'/><path d='M26 40 L22 20 L38 30 L50 16 L62 30 L78 20 L74 40 Z' fill='%23f1c40f'/><circle cx='50' cy='14' r='4' fill='%23e74c3c'/><circle cx='50' cy='50' r='15' fill='%23ffdbac'/><circle cx='44' cy='48' r='2.5' fill='%232d3436'/><circle cx='56' cy='48' r='2.5' fill='%232d3436'/><path d='M44 56 Q50 60 56 56' stroke='%232d3436' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23d63031'/><polygon points='50,65 52,69 56,69 53,72 54,76 50,73 46,76 47,72 44,69 48,69' fill='%23f1c40f'/><text x='50' y='86' font-size='14' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>" },
  { id: 'cobrador_livres', name: 'O Cobrador de Livres (10)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23192a56' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M30 30 Q50 18 70 30 Z' fill='%23273c75'/><circle cx='43' cy='42' r='2.5' fill='%23192a56'/><circle cx='57' cy='42' r='2.5' fill='%23192a56'/><path d='M43 51 Q50 56 57 51' stroke='%23192a56' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23273c75'/><path d='M44 66 L50 76 L56 66' fill='%23f1c40f'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text><path d='M24 45 Q40 24 76 38' stroke='%23f1c40f' stroke-width='3' stroke-dasharray='3' fill='none'/></svg>" },
  { id: 'defesa_central', name: 'O Defesa Central (4)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23b2bec3' stroke='%23d63031' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23e0ac69'/><rect x='44' y='42' width='12' height='5' fill='%23ffffff' transform='rotate(-10 50 44)'/><circle cx='43' cy='40' r='2.5' fill='%232d3436'/><circle cx='57' cy='40' r='2.5' fill='%232d3436'/><path d='M42 50 H58' stroke='%232d3436' stroke-width='3' stroke-linecap='round'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23d63031'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>4</text></svg>" },
  { id: 'jogador_gladiador', name: 'Jogador Gladiador (300)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%232d3436' stroke='%23d35400' stroke-width='2'/><path d='M28 34 C28 20 72 20 72 34 Z' fill='%23d35400'/><path d='M46 12 H54 V26 H46 Z' fill='%23c0392b'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='43' cy='44' r='2.5' fill='%232d3436'/><circle cx='57' cy='44' r='2.5' fill='%232d3436'/><path d='M43 52 Q50 56 57 52' stroke='%232d3436' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23c0392b'/><text x='50' y='85' font-size='11' font-weight='900' text-anchor='middle' fill='%23f1c40f' font-family='sans-serif'>300</text></svg>" },
  { id: 'jogador_pirata', name: 'Jogador Pirata (10)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231b1464' stroke='%23ff4757' stroke-width='2'/><path d='M26 34 C26 22 74 22 74 34 Z' fill='%232f3542'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='40' cy='44' r='4' fill='%232f3542'/><line x1='24' y1='38' x2='76' y2='48' stroke='%232f3542' stroke-width='2'/><circle cx='58' cy='44' r='2.5' fill='%232f3542'/><path d='M44 53 Q50 57 56 53' stroke='%232f3542' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23ff4757'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>" },
  { id: 'jogador_magico', name: 'Jogador Mágico (10)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23482475' stroke='%23e056fd' stroke-width='2'/><path d='M34 26 L66 26 L62 10 L38 10 Z' fill='%232c2c54'/><rect x='28' y='26' width='44' height='6' fill='%23e056fd'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='43' cy='44' r='2.5' fill='%232c2c54'/><circle cx='57' cy='44' r='2.5' fill='%232c2c54'/><path d='M43 52 Q50 56 57 52' stroke='%232c2c54' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232c2c54'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23e056fd' font-family='sans-serif'>10</text></svg>" },
  { id: 'jogador_imperador', name: 'Jogador Imperador (10)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23686de0' stroke='%23f9ca24' stroke-width='2'/><path d='M28 32 C34 22 66 22 72 32 C64 28 36 28 28 32 Z' fill='%23f9ca24'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><circle cx='43' cy='42' r='2.5' fill='%2330336b'/><circle cx='57' cy='42' r='2.5' fill='%2330336b'/><path d='M43 50 Q50 55 57 50' stroke='%2330336b' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23eb4d4b'/><path d='M44 66 L50 76 L56 66' fill='%23f9ca24'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>" },
  { id: 'apanha_bolas', name: 'O Apanha-Bolas (12)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2320bf6b' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='42' r='16' fill='%23ffdbac'/><path d='M32 32 C38 22 62 22 68 32 Z' fill='%2326de81'/><circle cx='43' cy='40' r='2.5' fill='%231e272e'/><circle cx='57' cy='40' r='2.5' fill='%231e272e'/><path d='M42 48 Q50 54 58 48' stroke='%231e272e' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2326de81'/><circle cx='50' cy='76' r='10' fill='%23ffffff' stroke='%231e272e' stroke-width='1.5'/><polygon points='50,71 53,74 52,78 48,78 47,74' fill='%231e272e'/></svg>" },
  { id: 'jogador_superheroi', name: 'O Super-Jogador (7)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23ff4757' stroke='%23eccc68' stroke-width='2'/><path d='M16 66 L30 50 L70 50 L84 66 Z' fill='%23eccc68'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><rect x='32' y='38' width='36' height='10' rx='4' fill='%2f3542'/><circle cx='42' cy='43' r='2.5' fill='%23ffffff'/><circle cx='58' cy='43' r='2.5' fill='%23ffffff'/><path d='M43 51 Q50 55 57 51' stroke='%232f3542' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23ff4757'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23eccc68' font-family='sans-serif'>7</text></svg>" },
  { id: 'fisioterapeuta_equipa', name: 'O Fisioterapeuta de Campo', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231289a7' stroke='%23ffffff' stroke-width='2'/><rect x='32' y='24' width='36' height='10' rx='3' fill='%23ffffff'/><path d='M48 26 H52 V32 H48 Z M45 28 H55 V30 H45 Z' fill='%23ea2027'/><circle cx='50' cy='44' r='16' fill='%23ffdbac'/><circle cx='43' cy='42' r='2.5' fill='%231289a7'/><circle cx='57' cy='42' r='2.5' fill='%231289a7'/><path d='M43 50 Q50 54 57 50' stroke='%231289a7' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%231289a7'/><rect x='64' y='68' width='16' height='14' rx='2' fill='%23ffffff'/><path d='M70 71 H74 V79 H70 Z M67 74 H77 V76 H67 Z' fill='%23ea2027'/></svg>" },
  { id: 'marcador_penaltis', name: 'O Marcador de Penáltis (11)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23c0392b' stroke='%23f1c40f' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><circle cx='43' cy='42' r='2.5' fill='%232c3e50'/><circle cx='57' cy='42' r='2.5' fill='%232c3e50'/><path d='M43 51 Q50 55 57 51' stroke='%232c3e50' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232c3e50'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>11</text><circle cx='76' cy='74' r='7' stroke='%23f1c40f' stroke-width='2' fill='none'/><line x1='76' y1='64' x2='76' y2='84' stroke='%23f1c40f' stroke-width='1.5'/><line x1='66' y1='74' x2='86' y2='74' stroke='%23f1c40f' stroke-width='1.5'/></svg>" },
  { id: 'guarda_redes_estrela', name: 'O Guarda-Redes Estrela (13)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2300b894' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M28 32 C28 20 72 20 72 32 Z' fill='%232d3436'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 51 Q50 55 57 51' stroke='%232d3436' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2300b894'/><rect x='16' y='74' width='10' height='14' rx='3' fill='%23fdcb6e' stroke='%232d3436' stroke-width='1.5'/><rect x='74' y='74' width='10' height='14' rx='3' fill='%23fdcb6e' stroke='%232d3436' stroke-width='1.5'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>13</text></svg>" },
  { id: 'jogador_robot_guarda', name: 'Jogador Robô N.º 1 (1)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23636e72' stroke='%23fdcb6e' stroke-width='2'/><rect x='30' y='26' width='40' height='36' rx='6' fill='%23b2bec3'/><rect x='34' y='34' width='32' height='12' rx='3' fill='%23fdcb6e'/><circle cx='42' cy='40' r='3' fill='%232d3436'/><circle cx='58' cy='40' r='3' fill='%232d3436'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%232d3436'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23fdcb6e' font-family='sans-serif'>1</text></svg>" },
  { id: 'jogador_dragao', name: 'Jogador Dragão (9)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23d35400' stroke='%23f1c40f' stroke-width='2'/><path d='M30 30 Q16 12 26 40 M70 30 Q84 12 74 40' stroke='%23f39c12' stroke-width='4' fill='none'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='43' cy='44' r='2.5' fill='%232d3436'/><circle cx='57' cy='44' r='2.5' fill='%232d3436'/><path d='M43 52 Q50 57 57 52' stroke='%232d3436' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23e67e22'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>9</text></svg>" },
  { id: 'jogador_detective', name: 'Jogador Detetive (7)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%237f8c8d' stroke='%23f1c40f' stroke-width='2'/><path d='M26 34 C26 22 74 22 74 34 Z' fill='%2334495e'/><ellipse cx='50' cy='34' rx='28' ry='4' fill='%232c3e50'/><circle cx='50' cy='46' r='16' fill='%23ffdbac'/><circle cx='43' cy='44' r='2.5' fill='%232c3e50'/><circle cx='57' cy='44' r='2.5' fill='%232c3e50'/><path d='M43 52 Q50 56 57 52' stroke='%232c3e50' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%2334495e'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23f1c40f' font-family='sans-serif'>7</text></svg>" },
  { id: 'extremo_canhoto', name: 'O Extremo Canhoto (11)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%2300cec9' stroke='%23ffffff' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M30 32 Q50 18 70 32 Z' fill='%232d3436'/><circle cx='43' cy='42' r='2.5' fill='%232d3436'/><circle cx='57' cy='42' r='2.5' fill='%232d3436'/><path d='M43 51 Q50 56 57 51' stroke='%232d3436' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%230984e3'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>11</text><path d='M70 70 C76 68 84 76 80 82 Z' fill='%23f1c40f'/></svg>" },
  { id: 'arbitro_assistente', name: 'O Árbitro Assistente (Bandeirinha)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%231e272e' stroke='%23ff5e57' stroke-width='2'/><circle cx='48' cy='42' r='16' fill='%23ffdbac'/><path d='M30 34 Q48 22 66 34 Z' fill='%232d3436'/><path d='M62 38 Q66 42 60 48' stroke='%23ff5e57' stroke-width='2' fill='none'/><circle cx='60' cy='48' r='2' fill='%23ff5e57'/><circle cx='42' cy='40' r='2.5' fill='%232d3436'/><circle cx='54' cy='40' r='2.5' fill='%232d3436'/><path d='M42 48 Q48 53 54 48' stroke='%232d3436' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M18 88 C18 68 30 64 48 64 C66 64 78 68 78 88 Z' fill='%23ffdd59'/><path d='M42 64 L48 74 L54 64' fill='%232d3436'/><line x1='70' y1='88' x2='76' y2='38' stroke='%23ff5e57' stroke-width='3' stroke-linecap='round'/><g transform='translate(76, 38)'><rect x='0' y='0' width='18' height='14' fill='%23ffdd59' stroke='%232d3436' stroke-width='1'/><rect x='0' y='0' width='9' height='7' fill='%23ff3f34'/><rect x='9' y='7' width='9' height='7' fill='%23ff3f34'/></g></svg>" },
  { id: 'jogador_mascarado', name: 'O Jogador Mascarado (10)', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%232d3436' stroke='%23e74c3c' stroke-width='2'/><circle cx='50' cy='44' r='17' fill='%23ffdbac'/><path d='M32 36 C32 28 68 28 68 36 L62 48 H38 Z' fill='%231e272e'/><circle cx='43' cy='40' r='2.5' fill='%23ffffff'/><circle cx='58' cy='40' r='2.5' fill='%23ffffff'/><path d='M43 52 Q50 56 57 52' stroke='%231e272e' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M20 88 C20 70 32 66 50 66 C68 66 80 70 80 88 Z' fill='%23e74c3c'/><text x='50' y='85' font-size='15' font-weight='900' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>10</text></svg>" }
];

function cleanSvgStr(str) {
    if (!str || typeof str !== 'string') return '';
    let decoded = str;
    try {
        decoded = decodeURIComponent(str);
    } catch (e) {}
    return decoded
        .replace(/%23/g, '#')
        .replace(/%27/g, "'")
        .replace(/%22/g, '"')
        .replace(/\s+/g, '')
        .replace(/['"]/g, '')
        .toLowerCase();
}

const CLEAN_AVATAR_MAP = new Map();
PRESET_AVATARS_LIST.forEach(item => {
    if (item.id) CLEAN_AVATAR_MAP.set(cleanSvgStr(item.id), item.name);
    if (item.url) CLEAN_AVATAR_MAP.set(cleanSvgStr(item.url), item.name);
});

function getAvatarName(userData) {
    if (userData.avatarName) return userData.avatarName;
    const avatarKey = userData.avatar || userData.avatarUrl || userData.imagem;
    const userName = userData.nometabela || userData.nome || 'Jogador';
    if (!avatarKey) return `Avatar de ${userName}`;

    const cleanedKey = cleanSvgStr(avatarKey);
    if (CLEAN_AVATAR_MAP.has(cleanedKey)) {
        return CLEAN_AVATAR_MAP.get(cleanedKey);
    }

    for (const item of PRESET_AVATARS_LIST) {
        const cleanedUrl = cleanSvgStr(item.url);
        if (cleanedUrl && cleanedUrl.length > 40 && cleanedKey.length > 40) {
            const snippet = cleanedUrl.slice(30, 90);
            if (cleanedKey.includes(snippet)) {
                return item.name;
            }
        }
    }

    return `Avatar de ${userName}`;
}

function loadUsersSnapshot() {
    if (!usersSnapshotPromise) {
        usersSnapshotPromise = getDocs(collection(db, 'users'));
    }
    return usersSnapshotPromise;
}

const loadingScreen = document.getElementById('loading-screen');
const content = document.querySelector('.content');
const rankingsBody = document.getElementById('rankings-body');
const alfredoPackPopup = document.getElementById('alfredo-pack-popup');
const alfredoPackMessage = document.getElementById('alfredo-pack-message');
const openAlfredoPackButton = document.getElementById('open-alfredo-pack-btn');
let currentUserStatus = null; // Store user status (estatuto)
let toastTimeout; 
let pendingGiftOfferCount = 0;
let mostRecentSeason; // <-- Variável global para a época mais recente

// --- Function to load Menu Settings ---
async function loadMenuSettings() {
    try {
        const menuSettingsDocRef = doc(db, 'paineis', 'paineis menu');
        const docSnap = await getDoc(menuSettingsDocRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null; // Return null if document doesn't exist
        }
    } catch (error) {
        return null; // Return null on error
    }
}

// --- Function to check page access based on status and menu settings ---
function checkPageAccess(userStatus, menuSettings) {
    if (!menuSettings) {
        // Default behavior if settings are missing: only ruler access
        return userStatus === 'ruler';
    }

    const rankingsEnabled = menuSettings['rankings'] === 'on';

    if (rankingsEnabled) {
        return true; // Access granted if rankings are 'on'
    } else {
        // Access granted only if rankings are 'off' BUT user is 'ruler'
        return userStatus === 'ruler';
    }
}

// Função para buscar o nome do Mod
async function getModName(modId) {
    if (modCache.has(modId)) {
        return modCache.get(modId);
    }
    try {
        const modDocRef = doc(db, 'mods', modId);
        const modDocSnap = await getDoc(modDocRef);
        if (modDocSnap.exists()) {
            const modName = modDocSnap.data().nomeMod;
            modCache.set(modId, modName); // Guarda em cache
            return modName;
        }
    } catch (error) {
        console.error("Erro ao buscar nome do mod:", error);
    }
    return 'Mod Desconhecido';
}

const gameDetailsCache = new Map();

// Função para buscar detalhes de um jogo (incluindo dataJogo)
async function getGameDetails(gameId) {
    if (!gameId) return null;
    if (gameDetailsCache.has(gameId)) {
        return gameDetailsCache.get(gameId);
    }
    try {
        const gameDocRef = doc(db, 'jogos', gameId);
        const gameDocSnap = await getDoc(gameDocRef);
        if (gameDocSnap.exists()) {
            const gameData = gameDocSnap.data();
            // Adiciona o nome limpo ao objeto para facilitar o uso
            gameData.nomeJogoLimpo = (gameData.nomeJogo || '').split(' - ')[0]; // <--- LINHA A REMOVER
            gameDetailsCache.set(gameId, gameData); 
            return gameData;
        }
    } catch (error) {
        console.error("Erro ao buscar detalhes do jogo:", error);
    }
    return null;
}

// Função para buscar o nome de tabela de um utilizador
async function getUserTableName(userId) {
    if (userCache.has(userId)) {
        return userCache.get(userId);
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userName = userDocSnap.data().nometabela;
            userCache.set(userId, userName); // Guarda em cache
            return userName;
        }
    } catch (error) {
        console.error("Erro ao buscar nometabela do user:", error);
    }
    return 'Utilizador Desconhecido';
}

// Função para buscar o nome de um jogo (assumindo que estão na coleção 'jogos')
async function getGameName(gameId) {
    if (!gameId) return 'Jogo Inválido'; // Adiciona uma verificação
    if (gameCache.has(gameId)) {
        return gameCache.get(gameId);
    }
    try {
        const gameDocRef = doc(db, 'jogos', gameId); 
        const gameDocSnap = await getDoc(gameDocRef);
        if (gameDocSnap.exists()) {
            const rawGameName = gameDocSnap.data().nomeJogo || '';
            const cleanGameName = rawGameName.split(' - ')[0];
            gameCache.set(gameId, cleanGameName); // Guarda em cache
            return cleanGameName;
        }
    } catch (error) {
        console.error("Erro ao buscar nome do jogo:", error);
    }
    return 'Jogo Desconhecido';
}

// --- Function to get User Status (estatuto) ---
async function getUserStatus(userId) {
    try {
        const userDocRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.aceite !== "Yes") {
                return null; // Treat as not valid if terms not accepted
            }
            return userData.estatuto || null; // Return estatuto or null if missing
        } else {
            return null; // User document doesn't exist
        }
    } catch (error) {
        console.error('Error fetching user status:', error);
        return null; // Return null on error
    }
}

async function fetchPendingCadernetaGiftOffersCount(userId) {
    const offersQuery = query(
        collection(db, CADERNETA_GIFT_OFFERS_COLLECTION),
        where('userId', '==', userId),
        where('status', '==', 'pending')
    );
    const offersSnapshot = await getDocs(offersQuery);
    return offersSnapshot.size;
}

function isAnyPopupVisible() {
    const popups = [
        document.getElementById('predictions-popup'),
        document.getElementById('ranking-animation-popup'),
        document.getElementById('alfredo-pack-popup')
    ];
    return popups.some(p => p && p.style.display === 'block');
}

function updateBodyScrollState() {
    if (isAnyPopupVisible()) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
    }
}

function showAlfredoGiftPopup() {
    if (!alfredoPackPopup || pendingGiftOfferCount <= 0) {
        return;
    }

    alfredoPackMessage.textContent = buildAlfredoGiftMessage(pendingGiftOfferCount);
    alfredoPackPopup.style.display = 'block';
    updateBodyScrollState();
}

function hideAlfredoGiftPopup() {
    if (alfredoPackPopup) {
        alfredoPackPopup.style.display = 'none';
        updateBodyScrollState();
    }
}

document.getElementById('close-alfredo-pack-popup')?.addEventListener('click', () => {
    hideAlfredoGiftPopup();
});

openAlfredoPackButton?.addEventListener('click', () => {
    window.location.href = `caderneta.html?${CADERNETA_GIFT_REDIRECT_PARAM}=1`;
});

// --- Consolidated Authentication and Initialization Logic ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserStatus = await getUserStatus(user.uid);
        if (currentUserStatus === null) {
            window.location.href = '404.html';
            return;
        }

        try {
            const userDocRef = doc(db, 'users', user.uid);
            void updateDoc(userDocRef, {
                ultimoacesso: serverTimestamp()
            }).catch((error) => console.error("Erro ao atualizar o campo ultimoacesso: ", error));
        } catch (error) {
            console.error("Erro ao atualizar o campo ultimoacesso: ", error);
        }

        const menuSettings = await loadMenuSettings();
        const hasAccess = checkPageAccess(currentUserStatus, menuSettings);

        if (hasAccess) {
            if (typeof updateMenuVisibility === 'function' && menuSettings) {
                updateMenuVisibility(menuSettings);
            }

            const hasContentAccess = await checkPageContentAccess('rankings', currentUserStatus, db);
            if (!hasContentAccess) {
                loadingScreen.style.display = 'none';
                return;
            }

            // Regista a entrada na página
            await logUserAction(`Entrou em ${document.title}`);
            
            loadingScreen.style.display = 'none';
            content.style.display = 'block';
            void Promise.all([
                loadSeasons().then(() => mostRecentSeason ? checkForRankingUpdateAndShowAnimation() : undefined),
                fetchPendingCadernetaGiftOffersCount(user.uid)
            ]).then(([, giftCount]) => {
                pendingGiftOfferCount = giftCount;
                if (pendingGiftOfferCount > 0 && animationPopup.style.display !== 'block') showAlfredoGiftPopup();
            }).catch((error) => console.error("Erro ao carregar dados secundários do ranking: ", error));
        } else {
            window.location.href = '404.html';
        }
    } else {
        loadingScreen.style.display = 'none';
        window.location.href = 'index.html';
    }
});

function showToast(message) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function updateStatusIndicator(isPending) {
    const indicator = document.getElementById('status-indicator');
    if (indicator) {
        indicator.onclick = null;
        indicator.style.cursor = 'default';
        if (isPending) {
            indicator.innerHTML = '🟠 Tabela Pendente';
            indicator.setAttribute('title', 'Ainda faltam atribuir pontos em alguns palpites.');
            indicator.style.cursor = 'pointer';
            indicator.onclick = () => {
                showToast('Ainda faltam atribuir pontos em alguns palpites.');
            };
        } else {
            indicator.innerHTML = '🟢 Tabela Atualizada';
            indicator.removeAttribute('title');
        }
    }
}

async function checkPendingPredictionsStatus(season) {
    try {
        const palpitesRef = collection(db, 'palpites');
        const q = query(palpitesRef,
            where('temporada', '==', season),
            where('Analisado', '!=', 'Sim')
        );
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error("Erro ao verificar o status dos palpites:", error);
        return true;
    }
}

async function loadSeasons() {
    mostRecentSeason = await getLatestSeason(db);
    const sortedSeasons = [mostRecentSeason];

    if (mostRecentSeason) {
        mostRecentSeason = sortedSeasons[0]; // <-- Define a variável global
        const isPending = await checkPendingPredictionsStatus(mostRecentSeason);
        updateStatusIndicator(isPending);
        await Promise.all([
            loadRankings(mostRecentSeason),
            loadRoundHighlights(mostRecentSeason)
        ]);
    } else {
        rankingsBody.innerHTML = '<tr><td colspan="4">Sem épocas disponíveis.</td></tr>';
        document.getElementById('status-indicator').style.display = 'none';
    }
}

async function loadRankings(season) {
    const usersSnap = await loadUsersSnapshot();
    const rankings = [];

    usersSnap.forEach(userDoc => {
        const userData = mergeUserSeasonData(userDoc.data(), season);
        if (userData.aceite === "Yes" && userData.estatuto && userData.natabela === "Yes") {
            const seasonPoints = userData.Pontos || 0;
            const avatarName = getAvatarName(userData);
            rankings.push({
                userId: userDoc.id,
                username: userData.nometabela || 'Utilizador Desconhecido',
                avatarUrl: userData.avatarUrl || userData.imagem || userData.avatar || null,
                avatarName: avatarName,
                points: seasonPoints
            });
        }
    });

    rankings.sort((a, b) => b.points - a.points);
    rankingsBody.innerHTML = '';

    const totalUsers = rankings.length;
    if (totalUsers === 0) {
        rankingsBody.innerHTML = '<tr><td colspan="4">Sem jogadores classificados para esta época.</td></tr>';
        return;
    }

    rankings.forEach((rank, index) => {
        const row = document.createElement('tr');
        const position = index + 1;
        const positionCell = document.createElement('td');
        const playerCell = document.createElement('td');
        const pointsCell = document.createElement('td');
        const infoCell = document.createElement('td');

        const percentage = totalUsers > 1 ? position / totalUsers : 0;
        let backgroundColor;
        if (percentage <= 0.33) {
            const factor = percentage / 0.33;
            const green = Math.floor(200 - 100 * factor);
            backgroundColor = `rgba(50, ${green}, 50, 0.2)`;
        } else if (percentage <= 0.67) {
            const factor = (percentage - 0.33) / 0.34;
            const yellowComp = Math.floor(200 - 100 * factor);
            backgroundColor = `rgba(${yellowComp}, ${yellowComp}, 50, 0.2)`;
        } else {
            const factor = (percentage - 0.67) / 0.33;
            const red = Math.floor(200 - 100 * factor);
            backgroundColor = `rgba(${red}, 50, 50, 0.2)`;
        }

        if (position === 1) {
            positionCell.innerHTML = `<div class="podium-badge-container"><img src="assets/tabela/Emblema dourado de primeiro lugar.png" alt="1º" class="podium-badge" oncontextmenu="return false;" ondragstart="return false;"></div>`;
        } else if (position === 2) {
            positionCell.innerHTML = `<div class="podium-badge-container"><img src="assets/tabela/Emblema de prata em segundo lugar.png" alt="2º" class="podium-badge" oncontextmenu="return false;" ondragstart="return false;"></div>`;
        } else if (position === 3) {
            positionCell.innerHTML = `<div class="podium-badge-container"><img src="assets/tabela/Medal de bronze com coroa e louros.png" alt="3º" class="podium-badge" oncontextmenu="return false;" ondragstart="return false;"></div>`;
        } else {
            positionCell.innerHTML = `<div class="position-circle">${position}</div>`;
        }
        
        const avatarHTML = rank.avatarUrl 
            ? `<img src="${rank.avatarUrl}" alt="${rank.avatarName}" title="${rank.avatarName}" class="ranking-player-avatar" data-avatar-name="${rank.avatarName}" />`
            : `<div class="ranking-player-avatar-placeholder" title="${rank.avatarName}" data-avatar-name="${rank.avatarName}"><i class="fas fa-user"></i></div>`;
        
        playerCell.innerHTML = `<div class="ranking-player-cell">${avatarHTML}<span>${rank.username}</span></div>`;
        
        const avatarEl = playerCell.querySelector('.ranking-player-avatar, .ranking-player-avatar-placeholder');
        if (avatarEl) {
            avatarEl.addEventListener('click', (e) => {
                e.stopPropagation();
                showToast(`Avatar: ${rank.avatarName}`);
            });
        }

        pointsCell.textContent = rank.points;
        infoCell.innerHTML = `<i class="fas fa-info-circle info-icon" data-userid="${rank.userId}" data-season="${season}"></i>`;
        row.style.backgroundColor = backgroundColor;
        row.appendChild(positionCell);
        row.appendChild(playerCell);
        row.appendChild(pointsCell);
        row.appendChild(infoCell);
        const infoIcon = infoCell.querySelector('.info-icon');
        infoIcon.addEventListener('click', () => togglePredictions(rank.userId, season));
        rankingsBody.appendChild(row);
    });
}

let selectedRounds = {};

async function togglePredictions(userId, season) {
    logUserAction(`Clicou no ícone "i" da classificação para ver detalhes/palpites do utilizador (ID: ${userId})`);
    console.log(`%c[LOG] Iniciando busca de palpites para UserID: ${userId}, Época: ${season}`, 'background-color: #2176ff; color: white; padding: 2px 5px; border-radius: 3px;');
    const popup = document.getElementById('predictions-popup');
    const popupBody = document.getElementById('popup-predictions-body');
    const roundFilter = document.getElementById('round-filter');
    popupBody.innerHTML = 'A carregar previsões...';
    popup.style.display = "block";
    updateBodyScrollState();
    try {
        const palpitesRef = collection(db, 'palpites');
        const q = query(palpitesRef, where('userId', '==', userId), where('temporada', '==', season));
        const palpitesSnap = await getDocs(q);
        const modPalpitesRef = collection(db, 'palpitesmods');
        const attacksMadeQuery = query(modPalpitesRef, where('userId', '==', userId), where('temporada', '==', season));
        const attacksMadeSnap = await getDocs(attacksMadeQuery);
        const attacksMadeByRound = new Map();
        attacksMadeSnap.forEach(doc => {
            const data = doc.data();
            if (data.ronda) { attacksMadeByRound.set(String(data.ronda), { id: doc.id, ...data }); }
        });
        const allModsQuery = query(modPalpitesRef, where('temporada', '==', season));
        const allModsSnap = await getDocs(allModsQuery);
        const attacksReceivedByRound = new Map();
        allModsSnap.forEach(doc => {
            const modData = doc.data();
            if (modData.selecoes) {
                for (const key in modData.selecoes) {
                    const selection = modData.selecoes[key];
                    if (selection.copiedFromUserId === userId) {
                        const roundStr = String(modData.ronda);
                        if (!attacksReceivedByRound.has(roundStr)) { attacksReceivedByRound.set(roundStr, []); }
                        attacksReceivedByRound.get(roundStr).push({
                            attackerUserId: modData.userId,
                            modId: modData.modId,
                            ronda: modData.ronda,
                            gameId: selection.jogoId,
                            selection: selection
                        });
                    }
                }
            }
        });
        const predictions = [];
        const rounds = new Set();
        palpitesSnap.forEach(doc => {
            const data = doc.data();
            predictions.push({ ...data, id: doc.id, timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(0) });
            if (data.ronda) rounds.add(String(data.ronda));
        });
        attacksMadeByRound.forEach((mod) => rounds.add(String(mod.ronda)));
        attacksReceivedByRound.forEach((attacks, round) => rounds.add(round));
        const sortedRounds = Array.from(rounds).sort((a, b) => parseInt(a) - parseInt(b));
        const userSeasonKey = `${userId}-${season}`;
        const currentSelection = selectedRounds[userSeasonKey] || '';
        roundFilter.innerHTML = '<option value="">Todas as Rondas</option>';
        sortedRounds.forEach(round => {
            const option = document.createElement('option');
            option.value = round;
            option.textContent = `Ronda ${round}`;
            if (String(currentSelection) === String(round)) { option.selected = true; }
            roundFilter.appendChild(option);
        });
        roundFilter.value = currentSelection;
        const selectedRound = roundFilter.value;
        const filteredPredictions = selectedRound ? predictions.filter(p => String(p.ronda) === selectedRound) : predictions;
        const predictionsByRound = {};
        filteredPredictions.forEach(prediction => {
            const round = prediction.ronda || 'Desconhecida';
            if (!predictionsByRound[round]) { predictionsByRound[round] = []; }
            predictionsByRound[round].push(prediction);
        });
        const allRoundsInView = new Set();
        if (selectedRound) { allRoundsInView.add(selectedRound); } 
        else { sortedRounds.forEach(r => allRoundsInView.add(r)); }
        const roundStats = {};
        for (const round of allRoundsInView) {
            let totalPoints = 0; let isPending = false;
            const currentRoundPredictions = predictionsByRound[round] || [];
            for (const prediction of currentRoundPredictions) {
                if (prediction.Analisado !== "Sim") { isPending = true; break; }
                for (let i = 1; i <= 10; i++) { totalPoints += prediction[`Palpite${i}PontosGanhos`] || 0; }
            }
            if (isPending) { roundStats[round] = { text: '[em análise]' }; continue; }
            const attackMadeData = attacksMadeByRound.get(round);
            if (attackMadeData) {
                for (const key in attackMadeData.selecoes) {
                    const selection = attackMadeData.selecoes[key];
                    if (selection.hasOwnProperty('pontosGanhosJogador')) { totalPoints += selection.pontosGanhosJogador || 0; } 
                    else { isPending = true; break; }
                }
            }
            if (isPending) { roundStats[round] = { text: '[em análise]' }; continue; }
            const attacksReceivedData = attacksReceivedByRound.get(round);
            if (attacksReceivedData) {
                for (const attack of attacksReceivedData) {
                    if (attack.selection.hasOwnProperty('pontosGanhosJogadorAlvo')) { totalPoints += attack.selection.pontosGanhosJogadorAlvo || 0; } 
                    else { isPending = true; break; }
                }
            }
            if (isPending) { roundStats[round] = { text: '[em análise]' }; } 
            else { roundStats[round] = { text: `[${totalPoints} gPoints]` }; }
        }
        let predictionsHTML = '';
        const displaySortedRounds = Array.from(allRoundsInView).sort((a, b) => parseInt(b) - parseInt(a));
        if (displaySortedRounds.length === 0) { predictionsHTML = 'Nenhuma previsão encontrada para esta seleção.'; } 
        else {
            const roundToOpen = selectedRound || displaySortedRounds[0];
            for (const round of displaySortedRounds) {
                let hasContent = false;
                const isOpen = String(round) === String(roundToOpen);
                const roundPredictions = predictionsByRound[round] || [];
                let roundContentHTML = '';
                if (roundPredictions.length > 0) {
                    hasContent = true;
                    const enrichedPredictionsPromises = roundPredictions.map(async (prediction) => {
                        const gameDetails = await getGameDetails(prediction.jogoId);
                        return { ...prediction, dataJogo: gameDetails ? gameDetails.dataJogo : null, nomeJogoCompleto: gameDetails ? gameDetails.nomeJogo : (prediction.nomeJogo || 'Jogo Desconhecido') };
                    });
                    let enrichedPredictions = await Promise.all(enrichedPredictionsPromises);
                    enrichedPredictions.sort((a, b) => {
                        if (!a.dataJogo) return 1;
                        if (!b.dataJogo) return -1;
                        return a.dataJogo.toDate() - b.dataJogo.toDate();
                    });
                    enrichedPredictions.forEach(prediction => {
                        console.groupCollapsed(`[LOG JOGO] ${prediction.nomeJogoCompleto}`);
                        console.log('Objeto completo do palpite recebido do Firestore:', prediction);
                        let palpitesHTML = '';
                        for (let i = 1; i <= 10; i++) {
                            if (prediction[`palpite${i}`]) {
                                let pointsContent = '';
                                if (prediction.Analisado === "Sim") {
                                    const fieldName = `Palpite${i}PontosGanhos`;
                                    const rawValue = prediction[fieldName];
                                    const points = rawValue || 0;
                                    const pointsClass = points > 0 ? 'prediction-points' : 'prediction-points-negative';
                                    pointsContent = `<span class="${pointsClass}">(${points} pts)</span>`;
                                } else { pointsContent = `<span class="in-analysis"><em>(em análise)</em></span>`; }
                                palpitesHTML += `<div class="prediction-item">→ ${prediction[`palpite${i}`]} ${pointsContent}</div>`;
                            }
                        }
                        if (palpitesHTML) { roundContentHTML += `<div class="game-header">${prediction.nomeJogoCompleto}</div>${palpitesHTML}`; }
                        console.groupEnd();
                    });
                }
                const attackMadeData = attacksMadeByRound.get(round);
                if (attackMadeData) {
                    hasContent = true;
                    let modHTML = '';
                    const modName = await getModName(attackMadeData.modId);
                    modHTML += `<div class="game-header" style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; color: #E67E22;">Mod: ${modName} | Ataque | Ronda ${attackMadeData.ronda}</div>`;
                    for (const key in attackMadeData.selecoes) {
                        const selection = attackMadeData.selecoes[key];
                        const jogoId = selection.jogoId;
                        const targetUserName = await getUserTableName(selection.copiedFromUserId);
                        const gameName = await getGameName(jogoId);
                        let pointsContent = '';
                        if (selection.hasOwnProperty('pontosGanhosJogador')) {
                            const points = selection.pontosGanhosJogador;
                            const pointsClass = points > 0 ? 'prediction-points' : 'prediction-points-negative';
                            pointsContent = `<span class="${pointsClass}">(${points} pts)</span>`;
                        } else { pointsContent = `<span class="in-analysis"><em>(em análise)</em></span>`; }
                        modHTML += `<div class="prediction-item">→ Atacou: ${targetUserName} | ${gameName} | ${selection.palpiteSelecionado} ${pointsContent}</div>`;
                    }
                    roundContentHTML += modHTML;
                }
                const attacksReceivedData = attacksReceivedByRound.get(round);
                if (attacksReceivedData) {
                    hasContent = true;
                    let modHTML = '';
                    const firstAttack = attacksReceivedData[0];
                    const modName = await getModName(firstAttack.modId);
                    modHTML += `<div class="game-header" style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; color: #E67E22;">Mod: ${modName} | Defesa | Ronda ${firstAttack.ronda}</div>`;
                    for (const attack of attacksReceivedData) {
                        const attackerName = await getUserTableName(attack.attackerUserId);
                        const gameName = await getGameName(attack.gameId);
                        let pointsContent = '';
                        if (attack.selection.hasOwnProperty('pontosGanhosJogadorAlvo')) {
                            const points = attack.selection.pontosGanhosJogadorAlvo;
                            const pointsClass = points > 0 ? 'prediction-points' : 'prediction-points-negative';
                            pointsContent = `<span class="${pointsClass}">(${points} pts)</span>`;
                        } else { pointsContent = `<span class="in-analysis"><em>(em análise)</em></span>`; }
                        modHTML += `<div class="prediction-item">→ Alvo de: ${attackerName} | ${gameName} | ${attack.selection.palpiteSelecionado} ${pointsContent}</div>`;
                    }
                    roundContentHTML += modHTML;
                }
                if (hasContent) {
                    const roundInfoText = roundStats[round] ? roundStats[round].text : '';
                    predictionsHTML += `<div class="round-section"><div class="round-header" data-round="${round}"><div style="display: flex; align-items: baseline; gap: 8px;"><span>Ronda ${round}</span><span style="font-style: italic; font-size: 0.7em; font-weight: normal;">${roundInfoText}</span></div><span class="toggle-arrow ${isOpen ? 'open' : ''}">▶</span></div><div class="round-content ${isOpen ? 'open' : ''}">${roundContentHTML}</div></div>`;
                }
            }
        }
        if (!predictionsHTML) { predictionsHTML = 'Nenhuma previsão encontrada para esta seleção.'; }
        popupBody.innerHTML = predictionsHTML;
        document.querySelectorAll('.round-header').forEach(header => {
            header.removeEventListener('click', toggleRoundContent);
            header.addEventListener('click', toggleRoundContent);
        });
        roundFilter.onchange = () => {
            selectedRounds[userSeasonKey] = roundFilter.value;
            togglePredictions(userId, season);
        };
    } catch (error) {
        console.error("Error loading predictions:", error);
        popupBody.innerHTML = 'Erro ao carregar previsões.';
    }
}

async function checkForRankingUpdateAndShowAnimation() {
    // 1. Obter todos os palpites da época mais recente
    const palpitesRef = collection(db, 'palpites');
    const q = query(palpitesRef, where('temporada', '==', mostRecentSeason));
    const palpitesSnap = await getDocs(q);

    const roundsData = {};
    let highestRoundOverall = 0; // <-- Variável para guardar a ronda mais alta de todas

    palpitesSnap.forEach(doc => {
        const data = doc.data();
        const round = data.ronda;
        if (!round) return;

        const roundNum = parseInt(round);

        // Atualiza a ronda mais alta encontrada até agora
        if (roundNum > highestRoundOverall) {
            highestRoundOverall = roundNum;
        }

        // Agrupa os dados para verificar a conclusão
        if (!roundsData[round]) {
            roundsData[round] = { total: 0, analisado: 0 };
        }
        roundsData[round].total++;
        if (data.Analisado === 'Sim') {
            roundsData[round].analisado++;
        }
    });
    
    // 2. Encontrar a ronda mais alta que está 100% analisada
    let latestCompletedRound = 0;
    for (const round in roundsData) {
        if (roundsData[round].total > 0 && roundsData[round].total === roundsData[round].analisado) {
            const roundNum = parseInt(round);
            if (roundNum > latestCompletedRound) {
                latestCompletedRound = roundNum;
            }
        }
    }

    if (latestCompletedRound === 0) return; // Nenhuma ronda completa ainda

    // 3. Verificar no localStorage se o utilizador já viu esta atualização
    const lastSeenRound = parseInt(localStorage.getItem('lastSeenRoundAnimation')) || 0;
    
    // --- NOVA CONDIÇÃO CRÍTICA ---
    // A animação só é acionada se a última ronda completa for também a ronda mais
    // alta que existe no geral, e se for uma novidade para o utilizador.
    if (latestCompletedRound === highestRoundOverall && latestCompletedRound > lastSeenRound) {
        // Gatilho! Uma nova ronda foi concluída e é a mais recente.
        console.log(`Nova ronda concluída: ${latestCompletedRound}. É a ronda mais alta. A mostrar animação.`);
        
        await showRankingAnimation(mostRecentSeason, latestCompletedRound);
        
        // Atualizar o localStorage após mostrar a animação
        localStorage.setItem('lastSeenRoundAnimation', latestCompletedRound);
    } else {
        // Log para depuração, caso a animação não apareça
        console.log(`Animação não acionada. Motivo: latestCompletedRound (${latestCompletedRound}) !== highestRoundOverall (${highestRoundOverall}) ou já foi vista (lastSeenRound: ${lastSeenRound}).`);
    }
}

async function calculateAllUserPointsUpToRound(season, targetRound) {
    const userPoints = new Map();
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);

    // Inicializa todos os jogadores com 0 pontos
    usersSnap.forEach(doc => {
        const userData = mergeUserSeasonData(doc.data(), season);
        if (userData.natabela !== 'Yes' || userData.aceite !== 'Yes') return;
        userPoints.set(doc.id, {
            userId: doc.id,
            username: userData.nometabela || 'Desconhecido',
            avatarUrl: userData.avatarUrl || userData.imagem || null,
            points: 0
        });
    });

    // Buscar todos os palpites e palpitesmods da época UMA SÓ VEZ para otimizar
    const palpitesRef = collection(db, 'palpites');
    const qPalpites = query(palpitesRef, where('temporada', '==', season), where('ronda', '<=', targetRound));
    const palpitesSnap = await getDocs(qPalpites);

    const modsRef = collection(db, 'palpitesmods');
    const qMods = query(modsRef, where('temporada', '==', season), where('ronda', '<=', targetRound));
    const modsSnap = await getDocs(qMods);

    // Processar palpites normais
    palpitesSnap.forEach(doc => {
        const data = doc.data();
        if (userPoints.has(data.userId) && data.Analisado === 'Sim') {
            let userTotal = userPoints.get(data.userId).points;
            for (let i = 1; i <= 10; i++) {
                userTotal += data[`Palpite${i}PontosGanhos`] || 0;
            }
            userPoints.get(data.userId).points = userTotal;
        }
    });

    // Processar palpites de mods
    modsSnap.forEach(doc => {
        const data = doc.data();
        // Pontos do atacante
        if (userPoints.has(data.userId)) {
            let userTotal = userPoints.get(data.userId).points;
            for (const key in data.selecoes) {
                userTotal += data.selecoes[key].pontosGanhosJogador || 0;
            }
            userPoints.get(data.userId).points = userTotal;
        }
        // Pontos do alvo
        for (const key in data.selecoes) {
            const targetId = data.selecoes[key].copiedFromUserId;
            if (userPoints.has(targetId)) {
                let targetTotal = userPoints.get(targetId).points;
                targetTotal += data.selecoes[key].pontosGanhosJogadorAlvo || 0;
                userPoints.get(targetId).points = targetTotal;
            }
        }
    });
    
    // Converter o Map para um array e ordenar
    const rankings = Array.from(userPoints.values()).sort((a, b) => b.points - a.points);
    return rankings;
}

async function showRankingAnimation(season, completedRound) {
    const roundAnterior = completedRound - 1;

    // 1. Calcular os dois rankings
    const rankingsAnteriores = roundAnterior > 0 ? await calculateAllUserPointsUpToRound(season, roundAnterior) : [];
    const rankingsAtuais = await calculateAllUserPointsUpToRound(season, completedRound);

    const posicoesAnteriores = new Map();
    rankingsAnteriores.forEach((user, index) => {
        posicoesAnteriores.set(user.userId, index + 1);
    });

    const popupList = document.getElementById('ranking-changes-list');
    popupList.innerHTML = ''; // Limpar lista anterior

    document.getElementById('animation-popup-title').textContent = `Movimentações da Ronda ${completedRound}`;

    // 2. Construir o HTML para cada jogador
    rankingsAtuais.forEach((user, index) => {
        const posAtual = index + 1;
        const posAnterior = posicoesAnteriores.get(user.userId);
        
        let changeIcon = '●';
        let changeClass = 'stable';
        let changeText = `manteve a posição`;
        
        if (posAnterior) { // Jogador já existia no ranking anterior
            const mudanca = posAnterior - posAtual;
            if (mudanca > 0) {
                changeIcon = `▲ +${mudanca}`;
                changeClass = 'up';
                changeText = `subiu da ${posAnterior}ª`;
            } else if (mudanca < 0) {
                changeIcon = `▼ ${mudanca}`;
                changeClass = 'down';
                changeText = `desceu da ${posAnterior}ª`;
            }
        } else { // Jogador novo no ranking
            changeIcon = '★';
            changeClass = 'up';
            changeText = 'entrou no ranking';
        }

        const listItem = document.createElement('li');
        listItem.style.animationDelay = `${index * 0.1}s`;

        const avatarHTML = user.avatarUrl 
            ? `<img src="${user.avatarUrl}" alt="${user.username}" class="ranking-player-avatar animation-avatar" />`
            : '';

        listItem.innerHTML = `
            <span class="rank-change ${changeClass}">${changeIcon}</span>
            <span class="player-name-animation">${avatarHTML} ${posAtual}º ${user.username}</span>
            <span class="rank-details">(${changeText})</span>
        `;
        popupList.appendChild(listItem);
    });

    // 3. Mostrar o popup
    const popup = document.getElementById('ranking-animation-popup');
    popup.style.display = 'block';
    updateBodyScrollState();
}

function toggleRoundContent() {
    const content = this.nextElementSibling;
    const arrow = this.querySelector('.toggle-arrow');
    if (content && arrow) {
        content.classList.toggle('open');
        arrow.classList.toggle('open');
    }
}

// Event Listeners dos Popups
const popup = document.getElementById('predictions-popup');
const closeButton = document.getElementById('close-popup');
closeButton.addEventListener('click', () => {
    popup.style.display = "none";
    updateBodyScrollState();
});
window.addEventListener('click', (event) => {
    if (event.target == popup) {
        popup.style.display = "none";
        updateBodyScrollState();
    }
});

// --- NOVO EVENT LISTENER PARA O POPUP DE ANIMAÇÃO ---
const animationPopup = document.getElementById('ranking-animation-popup');
const closeAnimationButton = document.getElementById('close-animation-popup');
closeAnimationButton.addEventListener('click', () => {
    animationPopup.style.display = "none";
    updateBodyScrollState();
    if (pendingGiftOfferCount > 0) {
        showAlfredoGiftPopup();
    }
});
window.addEventListener('click', (event) => {
    if (event.target == animationPopup) {
        animationPopup.style.display = "none";
        updateBodyScrollState();
        if (pendingGiftOfferCount > 0) {
            showAlfredoGiftPopup();
        }
    }
});

const closeAlfredoPackPopupButton = document.getElementById('close-alfredo-pack-popup');
closeAlfredoPackPopupButton?.addEventListener('click', hideAlfredoGiftPopup);
openAlfredoPackButton?.addEventListener('click', async () => {
    hideAlfredoGiftPopup();
    await logUserAction(`Seguiu para a caderneta para abrir ${pendingGiftOfferCount} saqueta(s) do Sr Alfredo`);
    window.location.href = `caderneta.html?${CADERNETA_GIFT_REDIRECT_PARAM}=1`;
});
window.addEventListener('click', (event) => {
    if (event.target == alfredoPackPopup) {
        hideAlfredoGiftPopup();
    }
});

/* ---- NOVO E CORRIGIDO: Listener Global para Cliques ---- */
document.addEventListener('click', async (event) => {
    // Selector para todos os elementos interativos da página
    const clickableElement = event.target.closest('.info-icon, .round-header, .close-button, a.menu-item');

    if (!clickableElement) return;

    let actionName = '';

    if (clickableElement.matches('.info-icon')) {
        const userId = clickableElement.dataset.userid;
        // Precisamos buscar o nome do utilizador para um log mais claro
        const userName = await getUserTableName(userId);
        actionName = `Visualizou os palpites de: ${userName || 'utilizador desconhecido'}`;
    }
    else if (clickableElement.matches('.round-header')) {
        const roundNumber = clickableElement.dataset.round;
        actionName = `Filtrou os palpites para a Ronda ${roundNumber}`;
    }
    else if (clickableElement.matches('.close-button')) {
        const popup = clickableElement.closest('.predictions-popup');
        let popupName = 'um popup';
        if (popup.id === 'ranking-animation-popup') popupName = 'o popup de movimentações';
        if (popup.id === 'predictions-popup') popupName = 'o popup de palpites';
        actionName = `Fechou ${popupName}`;
    }
    else if (clickableElement.matches('a.menu-item')) {
        actionName = `Navegou para: ${clickableElement.querySelector('.menu-text')?.textContent.trim() || 'Menu'}`;
    }
    
    if (!actionName) return;

    // Lida com a navegação para outras páginas (menu inferior)
    const isNavLink = clickableElement.tagName === 'A' && clickableElement.href && clickableElement.target !== '_blank';
    
    if (isNavLink) {
        event.preventDefault();
        await logUserAction(actionName);
        window.location.href = clickableElement.href;
    } else {
        // Para todos os outros cliques
        await logUserAction(actionName);
    }
});

// --- FUNÇÃO PARA CARREGAR OS DESTAQUES DA ÚLTIMA RONDA ---
async function loadRoundHighlights(season) {
    const highlightsContainer = document.getElementById('highlights-container');
    if (!highlightsContainer) return;
    highlightsContainer.innerHTML = '<div style="color: #8892b0; font-size: 0.9rem; text-align: center; width: 100%;">A carregar destaques da ronda...</div>';

    try {
        const usersSnap = await loadUsersSnapshot();
        const userNames = {};
        usersSnap.forEach(doc => {
            userNames[doc.id] = doc.data().nometabela || doc.data().username || 'Desconhecido';
        });

        const palpitesRef = collection(db, 'palpites');
        const q = query(palpitesRef, where('temporada', '==', season));
        const querySnapshot = await getDocs(q);

        const roundsData = {};
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const round = data.ronda;
            if (!round) return;
            if (!roundsData[round]) {
                roundsData[round] = [];
            }
            roundsData[round].push(data);
        });

        const rounds = Object.keys(roundsData).map(r => parseInt(r));
        if (rounds.length === 0) {
            highlightsContainer.innerHTML = '';
            return;
        }

        // Encontra a ronda mais alta analisada, ou a maior ronda existente
        let targetRound = Math.max(...rounds);
        const analyzedRounds = rounds.filter(r => roundsData[r].some(p => p.Analisado === 'Sim'));
        if (analyzedRounds.length > 0) {
            targetRound = Math.max(...analyzedRounds);
        }

        const roundPredictions = roundsData[targetRound] || [];
        
        const getCategoryIcon = (catName) => {
            const lower = catName.toLowerCase();
            
            // 1. Resultado
            if (lower === 'resultado') return '<i class="fa-solid fa-list-ol"></i>';
            // 2. Resultado Exato
            if (lower.includes('resultado exato')) return '<i class="fa-solid fa-thumbtack"></i>';
            // 3. Resultado Handicap
            if (lower.includes('handicap')) return '<i class="fa-solid fa-scale-balanced"></i>';
            // 4. Por Parte
            if (lower.includes('por parte')) return '<i class="fa-solid fa-scissors"></i>';
            // 5. Tempo
            if (lower.includes('tempo')) return '<i class="fa-solid fa-stopwatch"></i>';
            // 6. Golos
            if (lower.includes('golo')) return '<i class="fa-solid fa-futbol"></i>';
            // 7. Cantos
            if (lower.includes('canto')) return '<i class="fa-solid fa-flag"></i>';
            // 8. Remates à Baliza (net SVG)
            if (lower.includes('baliza')) return `<svg viewBox="0 0 24 24" width="15" height="15" style="display: inline-block; vertical-align: middle; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-top: -2px;">
                <path d="M3,18V7h18v11" />
                <path d="M3,7l3-3h12l3,3" />
                <path d="M6,4v14" style="stroke-dasharray: 0; stroke-width: 1.2; opacity: 0.7;" />
                <path d="M18,4v14" style="stroke-dasharray: 0; stroke-width: 1.2; opacity: 0.7;" />
                <path d="M6,18h12" />
                <path d="M3,11h18 M3,15h18" style="stroke-width: 0.8; opacity: 0.4;" />
                <path d="M9,7v11 M15,7v11" style="stroke-width: 0.8; opacity: 0.4;" />
            </svg>`;
            // 9. Remates Totais
            if (lower.includes('remate')) return '<i class="fa-solid fa-bullseye"></i>';
            // 10. Cartões Amarelos
            if (lower.includes('cart')) return '<i class="fa-solid fa-square" style="font-size: 0.9em; transform: rotate(10deg); display: inline-block;"></i>';
            // 11. Faltas
            if (lower.includes('falta')) return '<i class="fa-solid fa-burst"></i>';
            // 12. Foras de Jogo
            if (lower.includes('fora')) return '<i class="fa-solid fa-flag-checkered"></i>';
            // 13. Mercados Combinados
            if (lower.includes('combinado')) return '<i class="fa-solid fa-clover"></i>';
            // 14. Mercados Especiais
            if (lower.includes('especial')) return '<i class="fa-solid fa-puzzle-piece"></i>';
            // 15. Específicos por Equipa / Defesas
            if (lower.includes('defesa') || lower.includes('equipa')) return '<i class="fa-solid fa-shield-halved"></i>';
            
            return '<i class="fa-solid fa-star"></i>';
        };

        const categoryTotals = {}; // categoria -> total de acertos
        const categoryUserStats = {}; // categoria -> { userId -> acertos }

        roundPredictions.forEach(prediction => {
            const userId = prediction.userId;
            if (!userId) return;

            for (let i = 1; i <= 10; i++) {
                const palpiteText = prediction[`palpite${i}`];
                const pontos = prediction[`Palpite${i}PontosGanhos`] || 0;
                if (palpiteText && prediction.Analisado === 'Sim' && pontos > 0) {
                    // Extrai a categoria principal (ex: "Golos" ou "Cantos") antes do traço
                    const parts = palpiteText.split(' - ');
                    const category = parts[0] ? parts[0].trim() : 'Outros';

                    categoryTotals[category] = (categoryTotals[category] || 0) + 1;

                    if (!categoryUserStats[category]) {
                        categoryUserStats[category] = {};
                    }
                    categoryUserStats[category][userId] = (categoryUserStats[category][userId] || 0) + 1;
                }
            }
        });

        // Procurar defesas de mods ativas na ronda
        const modsRef = collection(db, 'palpitesmods');
        const qMods = query(modsRef, where('temporada', '==', season), where('ronda', '==', String(targetRound)));
        const modsSnap = await getDocs(qMods);
        
        modsSnap.forEach(doc => {
            const data = doc.data();
            for (const key in data.selecoes) {
                const targetId = data.selecoes[key].copiedFromUserId;
                const targetPoints = data.selecoes[key].pontosGanhosJogadorAlvo || 0;
                if (targetId && targetPoints > 0) {
                    const category = 'Defesas';
                    categoryTotals[category] = (categoryTotals[category] || 0) + 1;
                    if (!categoryUserStats[category]) {
                        categoryUserStats[category] = {};
                    }
                    categoryUserStats[category][targetId] = (categoryUserStats[category][targetId] || 0) + 1;
                }
            }
        });

        // Ordenar as categorias pelo total de acertos na ronda
        const sortedCategories = Object.keys(categoryTotals)
            .filter(cat => categoryTotals[cat] > 0)
            .sort((a, b) => categoryTotals[b] - categoryTotals[a]);

        // Pegar no máximo 5 categorias reais
        const topCategories = sortedCategories.slice(0, 5);

        if (topCategories.length === 0) {
            highlightsContainer.innerHTML = '<div style="color: #8892b0; font-size: 0.85rem; text-align: center; width: 100%;">Sem registos ou palpites analisados nesta ronda.</div>';
            return;
        }

        const cardsHTML = topCategories.map(category => {
            const userCounts = categoryUserStats[category];
            let winnerId = null;
            let maxCount = 0;
            for (const userId in userCounts) {
                if (userCounts[userId] > maxCount) {
                    maxCount = userCounts[userId];
                    winnerId = userId;
                }
            }
            const winnerName = winnerId ? userNames[winnerId] : 'Sem registo';
            const icon = getCategoryIcon(category);

            return `
                <div class="highlight-card">
                    <div class="card-title"><span class="desktop-round">Ronda ${targetRound}</span><span class="mobile-round">R${targetRound}</span> - ${category} ${icon}</div>
                    <div class="card-user" title="${winnerName}">${winnerName}</div>
                </div>
            `;
        }).join('');

        highlightsContainer.innerHTML = cardsHTML;
    } catch (error) {
        console.error("Erro ao carregar destaques da ronda:", error);
        highlightsContainer.innerHTML = '';
    }
}
