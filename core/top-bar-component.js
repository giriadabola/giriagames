// core/top-bar-component.js
import { db, auth } from './firebase.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Determine active page to toggle page-specific features
    const currentPage = window.location.pathname.split('/').pop().toLowerCase();
    const isMarketPage = currentPage === 'market.html' || currentPage === 'market';
    const isProfilePage = currentPage === 'profile.html' || currentPage === 'profile';

    // 2. CSS for the top bar and logout popup
    const topBarCSS = `
        /* --- ESTILOS DO MENU DE TOPO --- */
        .top-menu-bar {
            position: fixed;
            top: 15px;
            right: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 2000;
            opacity: 0; /* Escondido inicialmente */
            pointer-events: none;
            transition: opacity 0.5s ease-in-out;
        }

        .top-menu-btn {
            background-color: #121620;
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: #f0f2f5;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            font-size: 16px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            cursor: pointer;
        }

        .top-menu-btn:hover {
            background-color: #1a2232;
            border-color: rgba(255, 255, 255, 0.2);
            color: #2ecc71;
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.45);
        }

        /* Botão Sair Vermelho ao passar o rato */
        .top-menu-btn.logout-btn-top:hover {
            color: #e74c3c;
            border-color: rgba(231, 76, 60, 0.4);
        }

        /* Botão de Transações específico da página Market */
        .top-menu-btn.transaction-btn {
            width: auto;
            padding: 0 16px;
            border-radius: 19px;
            font-weight: 600;
            font-size: 13px;
            gap: 8px;
            background: linear-gradient(135deg, #1b60d6, #0043b8);
            border: none;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(27, 96, 214, 0.25);
        }

        .top-menu-btn.transaction-btn:hover {
            color: #ffffff;
            background: linear-gradient(135deg, #226ee6, #0051db);
            box-shadow: 0 6px 16px rgba(27, 96, 214, 0.4);
            transform: translateY(-2px);
        }

        /* gCoins Display Card */
        .top-coin-display {
            display: flex;
            align-items: center;
            background-color: #121620;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-left: 4px solid #f1c40f;
            padding: 0 16px;
            height: 38px;
            border-radius: 0 19px 19px 0;
            gap: 8px;
            font-size: 13px;
            font-weight: 700;
            color: #ffffff;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
            position: relative;
        }

        /* Efeito de onda circular periódica */
        .top-coin-display::after {
            content: '';
            position: absolute;
            top: -1px;
            left: -1px;
            right: -1px;
            bottom: -1px;
            border-radius: 0 19px 19px 0;
            border: 2px solid #f1c40f;
            opacity: 0;
            pointer-events: none;
            animation: coin-wave-ripple 8s infinite ease-out;
        }

        @keyframes coin-wave-ripple {
            0%, 90% {
                transform: scale(1);
                opacity: 0;
            }
            91% {
                opacity: 0.8;
            }
            100% {
                transform: scale(1.15, 1.35);
                opacity: 0;
                filter: blur(2px);
            }
        }

        .top-coin-display:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.4);
            border-color: rgba(241, 196, 15, 0.4);
            border-left-color: #f1c40f;
        }

        .top-coin-display i {
            color: #f1c40f;
            font-size: 15px;
            animation: pulse-coin 2s infinite alternate;
        }

        .top-coin-display span {
            color: #f1c40f;
        }

        .top-coin-display .coin-suffix {
            color: #8892b0;
            font-weight: 500;
        }

        /* Popup de Confirmação de Saída */
        .logout-popup-overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(5px);
            z-index: 9999;
            justify-content: center; align-items: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .logout-popup-overlay.active {
            display: flex;
            opacity: 1;
        }
        .logout-popup-content {
            background: #111622;
            padding: 25px;
            border-radius: 16px;
            width: 90%; max-width: 350px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.5);
            transform: translateY(-20px);
            transition: transform 0.3s ease;
            color: #ffffff;
        }
        .logout-popup-overlay.active .logout-popup-content {
            transform: translateY(0);
        }
        .logout-popup-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #ffffff;
        }
        .logout-popup-text {
            font-size: 14px;
            color: #8892b0;
            margin-bottom: 24px;
        }
        .logout-popup-buttons {
            display: flex;
            gap: 12px;
        }
        .logout-popup-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            text-transform: uppercase;
            transition: all 0.2s ease;
        }
        .logout-popup-btn.confirm {
            background: #e74c3c;
            color: #ffffff;
        }
        .logout-popup-btn.confirm:hover {
            background: #c0392b;
            transform: translateY(-1px);
        }
        .logout-popup-btn.cancel {
            background: #34495e;
            color: #ffffff;
        }
        .logout-popup-btn.cancel:hover {
            background: #2c3e50;
            transform: translateY(-1px);
        }

        @keyframes pulse-coin {
            0% { transform: scale(1); filter: drop-shadow(0 0 1px rgba(241, 196, 15, 0.2)); }
            100% { transform: scale(1.15); filter: drop-shadow(0 0 6px rgba(241, 196, 15, 0.6)); }
        }

        @media (max-width: 600px) {
            .top-menu-bar {
                top: 10px;
                right: 10px;
                gap: 8px;
            }
            .top-menu-btn.transaction-btn span {
                display: none;
            }
            .top-menu-btn.transaction-btn {
                width: 38px;
                padding: 0;
                border-radius: 50%;
            }
            .top-coin-display .coin-suffix {
                display: none;
            }
        }
    `;

    // Inject CSS
    const styleElement = document.createElement('style');
    styleElement.textContent = topBarCSS;
    document.head.appendChild(styleElement);

    // Create the top menu markup
    const topBarHTML = `
        <div class="top-menu-bar" id="app-top-menu-bar">
            ${isProfilePage ? `
            <button class="top-menu-btn logout-btn-top" id="top-logout-btn" title="Sair">
                <i class="fas fa-sign-out-alt"></i>
            </button>
            <a href="manual.html" class="top-menu-btn" id="top-manual-btn" title="Manual" style="display: none;">
                <i class="fas fa-book-open"></i>
            </a>
            ` : ''}

            ${isMarketPage ? `
            <a href="bank.html" class="top-menu-btn transaction-btn" id="top-transaction-btn">
                <i class="fas fa-exchange-alt"></i><span>Transações</span>
            </a>
            ` : ''}
            
            <a href="manual.html" class="top-menu-btn" title="Manual">
                <i class="fas fa-book"></i>
            </a>

            ${isProfilePage ? `
            <button class="top-menu-btn" id="top-notifications-btn" title="Notificações">
                <i class="fas fa-cog"></i>
            </button>
            ` : ''}

            <a href="calendario.html" class="top-menu-btn" title="Calendário">
                <i class="fas fa-calendar-alt"></i>
            </a>
            
            <a href="banca.html" class="top-menu-btn" title="Banca">
                <i class="fas fa-university"></i>
            </a>
            
            <div class="top-coin-display" id="top-gcoins-display" title="gCoins">
                <i class="fas fa-coins"></i>
                <span id="top-user-gcoins-value">0</span>
                <span class="coin-suffix">gCoins</span>
            </div>
        </div>

        <!-- Pop-up de Confirmação de Saída -->
        <div class="logout-popup-overlay" id="logoutConfirmPopup">
            <div class="logout-popup-content">
                <div class="logout-popup-title">Confirmar Saída</div>
                <div class="logout-popup-text">Deseja realmente terminar a sua sessão?</div>
                <div class="logout-popup-buttons">
                    <button class="logout-popup-btn confirm" id="confirmLogoutBtn">Sair</button>
                    <button class="logout-popup-btn cancel" id="cancelLogoutBtn">Cancelar</button>
                </div>
            </div>
        </div>
    `;

    // Inject HTML at the beginning of the body
    document.body.insertAdjacentHTML('afterbegin', topBarHTML);

    // Dynamic show helper when loading finishes
    const topBar = document.getElementById('app-top-menu-bar');
    const loadingScreen = document.getElementById('loading-screen');

    function checkAndShowTopBar() {
        if (!loadingScreen || loadingScreen.style.display === 'none' || getComputedStyle(loadingScreen).display === 'none') {
            if (topBar) {
                topBar.style.opacity = '1';
                topBar.style.pointerEvents = 'auto';
            }
            if (observer) observer.disconnect();
            clearInterval(fallbackInterval);
        }
    }

    // Set up MutationObserver to watch loading screen style change
    let observer;
    if (loadingScreen && topBar) {
        observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    checkAndShowTopBar();
                }
            });
        });
        observer.observe(loadingScreen, { attributes: true });
    }

    // Fallback interval check
    const fallbackInterval = setInterval(checkAndShowTopBar, 150);

    // Run initial check
    checkAndShowTopBar();

    // 3. Setup Logout Event Handlers (specifically for profile page)
    if (isProfilePage) {
        const topLogoutBtn = document.getElementById('top-logout-btn');
        const topNotificationsBtn = document.getElementById('top-notifications-btn');
        const logoutConfirmPopup = document.getElementById('logoutConfirmPopup');
        const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
        const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');

        if (topLogoutBtn && logoutConfirmPopup) {
            topLogoutBtn.addEventListener('click', () => {
                logoutConfirmPopup.classList.add('active');
            });
        }

        if (cancelLogoutBtn && logoutConfirmPopup) {
            cancelLogoutBtn.addEventListener('click', () => {
                logoutConfirmPopup.classList.remove('active');
            });
        }

        if (confirmLogoutBtn) {
            confirmLogoutBtn.addEventListener('click', async () => {
                try {
                    await signOut(auth);
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('Erro ao fazer logout.');
                }
            });
        }

        if (topNotificationsBtn) {
            topNotificationsBtn.addEventListener('click', () => {
                window.dispatchEvent(new Event('profile-notifications:open'));
            });
        }
    }

    // 4. User gCoins Real-time updating logic
    function findLatestGcoinsField(userData) {
        let latestSeason = 0;
        let latestGcoinsField = null;
        if (!userData) return null;

        for (const key in userData) {
            if (key.match(/^\d{8}GCoins$/)) {
                const season = parseInt(key.slice(0, 8), 10);
                if (!isNaN(season) && season >= latestSeason) {
                    latestSeason = season;
                    latestGcoinsField = key;
                }
            }
        }
        return latestGcoinsField;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    const gCoinsField = findLatestGcoinsField(userData);
                    const userGcoins = (gCoinsField && typeof userData?.[gCoinsField] === 'number') ? userData[gCoinsField] : 0;
                    
                    const coinValueElement = document.getElementById('top-user-gcoins-value');
                    if (coinValueElement) {
                        coinValueElement.textContent = userGcoins.toLocaleString('pt-PT');
                    }
                }
            }, (error) => {
                console.error("Error listening to user doc for top menu:", error);
            });

            // Listen to menu visibility settings to hide/disable caderneta globally if off
            const menuMenuRef = doc(db, 'paineis', 'paineis menu');
            onSnapshot(menuMenuRef, (docSnap) => {
                if (docSnap.exists()) {
                    const menuSettings = docSnap.data();
                    const manualBtn = document.querySelector('a[href="manual.html"]');
                    if (menuSettings.manual === 'off') {
                        if (manualBtn) manualBtn.style.display = 'none';
                        if (currentPage === 'manual.html' || currentPage === 'manual') {
                            window.location.replace('404.html');
                        }
                    } else {
                        if (manualBtn) manualBtn.style.display = 'flex';
                    }
                    if (menuSettings.caderneta === 'off') {
                        if (currentPage === 'caderneta.html' || currentPage === 'caderneta') {
                            window.location.replace('404.html');
                        }
                    }
                }
            });
        }
    });
});
