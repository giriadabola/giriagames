(function loadLoadingWatchdog() {
    const path = window.location.pathname.toLowerCase();
    if (/(^|\/)market(?:\.html|\/|$)/.test(path) || document.getElementById('loading-watchdog')) {
        return;
    }

    const script = document.createElement('script');
    script.id = 'loading-watchdog';
    script.src = './core/pwa/loading-watchdog.js';
    document.head.appendChild(script);
})();

document.addEventListener("DOMContentLoaded", () => {
    // 1. O HTML do menu (sem alterações)
    const menuHTML = `
        <nav class="bottom-menu">
            <a href="1x.html" class="menu-item" data-menu-key="1x" aria-label="1x">
                <span class="one-x-icon" aria-hidden="true"><span>1</span><span>x</span></span>
            </a>
            <a href="market.html" class="menu-item" data-menu-key="market"><i class="fas fa-shopping-cart"></i></a>
            <a href="myteam.html" class="menu-item" data-menu-key="team" aria-label="Relvado">
                <span class="pitch-icon" aria-hidden="true">
                    <span class="pitch-icon__line"></span>
                    <span class="pitch-icon__circle"></span>
                </span>
            </a>
            <a href="empire.html" class="menu-item" data-menu-key="empire"><i class="fas fa-landmark empire-icon"></i></a>
            <a href="rankings.html" class="menu-item" data-menu-key="rankings"><i class="fas fa-list"></i></a>
            <a href="profile.html" class="menu-item" data-menu-key="profile">
                <i class="fas fa-user"></i>
                <span class="menu-badge" style="display: none; position: absolute; bottom: -3px; right: -3px; background: #e74c3c; color: white; min-width: 14px; height: 14px; border-radius: 50%; font-weight: 700; font-size: 8px; align-items: center; justify-content: center; padding: 0 3px; box-shadow: 0 1px 4px rgba(231, 76, 60, 0.4); z-index: 10;">0</span>
            </a>
        </nav>
    `;

    // 2. O CSS do menu, agora com os dois estilos (padrão e empire)
    const menuCSS = `
        /* --- ESTILOS PADRÃO DO MENU (Para todas as outras páginas) --- */
        .bottom-menu {
            position: fixed; bottom: 0; left: 0; width: 100%;
            background-color: #0b0e14;
            box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.4);
            padding: 12px 0; display: flex; justify-content: center;
            gap: 32px; align-items: center; z-index: 1000;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .menu-item {
            display: flex; flex-direction: column; align-items: center;
            text-decoration: none; color: #7f8c8d;
            transition: color 0.3s ease, transform 0.3s ease; position: relative;
        }
        .menu-item.hidden { display: none !important; }
        .menu-item:hover {
            color: #ffffff; transform: translateY(-3px);
        }
        .menu-item.active { 
            color: #2ecc71; 
        }
        .menu-item.active::before {
            content: ''; position: absolute; top: -12px;
            width: 25px; height: 3px;
            background-color: #2ecc71;
            border-radius: 2px;
            box-shadow: 0 0 10px rgba(46, 204, 113, 0.6);
        }
        .menu-item i { font-size: 24px; margin-bottom: 4px; }
        .one-x-icon {
            display: inline-flex;
            align-items: flex-end;
            justify-content: center;
            gap: 1px;
            height: 24px;
            font-size: 30px;
            font-family: 'Poppins', Arial, sans-serif;
            font-weight: 800;
            line-height: 0.82;
            letter-spacing: -0.06em;
            text-transform: lowercase;
            margin-bottom: 3px;
            color: currentColor;
        }
        .one-x-icon span:last-child {
            font-size: 0.82em;
            transform: translateY(-1px);
        }
        .pitch-icon {
            position: relative;
            display: inline-flex;
            width: 26px;
            height: 22px;
            margin-bottom: 4px;
            border: 2px solid currentColor;
            border-radius: 4px;
            color: currentColor;
            opacity: 0.95;
        }
        .pitch-icon::before,
        .pitch-icon::after {
            content: '';
            position: absolute;
            top: 3px;
            bottom: 3px;
            width: 5px;
            border: 2px solid currentColor;
        }
        .pitch-icon::before {
            left: -2px;
            border-right: 0;
            border-radius: 2px 0 0 2px;
        }
        .pitch-icon::after {
            right: -2px;
            border-left: 0;
            border-radius: 0 2px 2px 0;
        }
        .pitch-icon__line {
            position: absolute;
            top: 1px;
            bottom: 1px;
            left: 50%;
            width: 2px;
            background-color: currentColor;
            transform: translateX(-50%);
            border-radius: 999px;
        }
        .pitch-icon__circle {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 7px;
            height: 7px;
            border: 2px solid currentColor;
            border-radius: 50%;
            transform: translate(-50%, -50%);
        }
        .empire-icon {
            font-size: 42px; color: #2176ff; transform: translateY(-3px);
            filter: drop-shadow(0 0 8px rgba(33, 118, 255, 0.4));
            transition: all 0.3s ease;
        }
        .empire-icon:hover {
            color: #0056d6; transform: translateY(-8px);
            filter: drop-shadow(0 0 12px rgba(33, 118, 255, 0.6));
        }

        /* --- ESTILOS ESPECÍFICOS PARA O TEMA EMPIRE --- */
        /* Estas regras só são aplicadas na página com <body class="empire-theme"> */
        body.empire-theme .bottom-menu {
            background-color: rgba(20, 20, 40, 0.9);
            border-top: 2px solid #c9a959;
            box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.5);
        }
        body.empire-theme .menu-item {
            color: #a99a7c; /* Cor base para os ícones no tema empire */
        }
        body.empire-theme .menu-item:hover,
        body.empire-theme .menu-item.active {
            color: #e0d2b4; /* Cor mais clara para hover/ativo */
        }
        body.empire-theme .menu-item.active::before {
            background-color: #c9a959; /* Indicador ativo dourado */
        }
        body.empire-theme .empire-icon {
            color: #c9a959; /* Ícone empire dourado */
            filter: drop-shadow(0 0 8px rgba(201, 169, 89, 0.6));
        }
        /* Combina o hover do item E o estado ativo para o ícone empire */
        body.empire-theme .menu-item:hover .empire-icon,
        body.empire-theme .menu-item.active .empire-icon {
            color: #e6c675;
            transform: translateY(-8px);
            filter: drop-shadow(0 0 12px rgba(230, 198, 117, 0.8));
        }
    `;

    // --- LÓGICA DE INJEÇÃO (sem alterações) ---
    if (!document.querySelector('link[data-menu-poppins]')) {
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap';
        fontLink.setAttribute('data-menu-poppins', 'true');
        document.head.appendChild(fontLink);
    }

    const styleElement = document.createElement('style');
    styleElement.textContent = menuCSS;
    document.head.appendChild(styleElement);
    document.body.insertAdjacentHTML('beforeend', menuHTML);

    if (!document.querySelector('script[data-profile-menu-badge]')) {
        const badgeScript = document.createElement('script');
        badgeScript.type = 'module';
        badgeScript.src = './core/profile-menu-badge.js';
        badgeScript.dataset.profileMenuBadge = 'true';
        document.head.appendChild(badgeScript);
    }
    
    // Chama a função para ativar o item correto do menu
    setActiveMenuItem();
});


// Função para marcar item ativo (VERSÃO CORRIGIDA)
function setActiveMenuItem() {
    const currentPage = window.location.pathname.split('/').pop();
    
    const pageToMenuKey = {
        '1x': '1x',
        '1x.html': '1x',
        'palpite': '1x',
        'palpite.html': '1x',
        'modsplay': '1x',
        'modsplay.html': '1x',
        'market': 'market',
        'market.html': 'market',
        'team': 'team',
        'team.html': 'team',
        'myteam': 'team',
        'myteam.html': 'team',
        'empire': 'empire',
        'empire.html': 'empire',
        'rankings': 'rankings',
        'rankings.html': 'rankings',
        'profile': 'profile',
        'profile.html': 'profile',
        'caderneta': 'profile',
        'caderneta.html': 'profile',
        'manual': 'profile',
        'manual.html': 'profile'
    };
    
    const activeKey = pageToMenuKey[currentPage];
    
    if (activeKey) {
        const menuItem = document.querySelector(`.menu-item[data-menu-key="${activeKey}"]`);
        if (menuItem) {
            menuItem.classList.add('active');
        }
    }
}

// Função de visibilidade global (sem alterações)
window.updateMenuVisibility = function(menuSettings) {
    const bottomMenu = document.querySelector('.bottom-menu');
    if (!bottomMenu) return;
    
    const menuItems = bottomMenu.querySelectorAll('.menu-item');
    const settingToKeyMap = { 
        '1x': '1x', 
        'bank': 'bank', 
        'empire': 'empire', 
        'market': 'market', 
        'profile': 'profile', 
        'rankings': 'rankings', 
        'team': 'team' 
    };
    
    menuItems.forEach(item => {
        const menuKey = item.dataset.menuKey;
        if (menuKey) {
            const settingName = settingToKeyMap[menuKey];
            const settingValue = menuSettings[settingName];
            // Esconde o item se a configuração correspondente for 'off'
            item.classList.toggle('hidden', settingValue === 'off');
        }
    });
}
