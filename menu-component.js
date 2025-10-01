document.addEventListener("DOMContentLoaded", () => {
    // 1. O HTML do menu (sem alterações)
    const menuHTML = `
        <nav class="bottom-menu">
            <a href="1x.html" class="menu-item" data-menu-key="1x"><i class="fas fa-home"></i></a>
            <a href="market.html" class="menu-item" data-menu-key="market"><i class="fas fa-shopping-cart"></i></a>
            <a href="team.html" class="menu-item" data-menu-key="team"><i class="fas fa-users"></i></a>
            <a href="empire.html" class="menu-item" data-menu-key="empire"><i class="fas fa-landmark empire-icon"></i></a>
            <a href="rankings.html" class="menu-item" data-menu-key="rankings"><i class="fas fa-list"></i></a>
            <a href="profile.html" class="menu-item" data-menu-key="profile"><i class="fas fa-user"></i></a>
        </nav>
    `;

    // 2. O CSS do menu, agora com os dois estilos (padrão e empire)
    const menuCSS = `
        /* --- ESTILOS PADRÃO DO MENU (Para todas as outras páginas) --- */
        .bottom-menu {
            position: fixed; bottom: 0; left: 0; width: 100%;
            background-color: var(--card-bg, #ffffff);
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
            padding: 12px 0; display: flex; justify-content: center;
            gap: 32px; align-items: center; z-index: 1000;
            border-top: none; /* Garante que não há borda por defeito */
        }
        .menu-item {
            display: flex; flex-direction: column; align-items: center;
            text-decoration: none; color: var(--secondary-text, #7f8c8d);
            transition: color 0.3s ease, transform 0.3s ease; position: relative;
        }
        .menu-item.hidden { display: none; }
        .menu-item:hover {
            color: var(--primary-text, #2c3e50); transform: translateY(-3px);
        }
        .menu-item.active { 
            color: var(--accent-color, #3498db); 
        }
        .menu-item.active::before {
            content: ''; position: absolute; top: -12px;
            width: 25px; height: 3px;
            background-color: var(--accent-color, #3498db);
            border-radius: 2px;
        }
        .menu-item i { font-size: 24px; margin-bottom: 4px; }
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
    const styleElement = document.createElement('style');
    styleElement.textContent = menuCSS;
    document.head.appendChild(styleElement);
    document.body.insertAdjacentHTML('beforeend', menuHTML);
    setActiveMenuItem();
});


// Função para marcar item ativo (sem alterações)
function setActiveMenuItem() {
    const currentPage = window.location.pathname.split('/').pop();
    const pageToMenuKey = { '1x.html': '1x', 'market.html': 'market', 'team.html': 'team', 'empire.html': 'empire', 'rankings.html': 'rankings', 'profile.html': 'profile' };
    const activeKey = pageToMenuKey[currentPage];
    if (activeKey) {
        const menuItem = document.querySelector(`.menu-item[data-menu-key="${activeKey}"]`);
        if (menuItem) { menuItem.classList.add('active'); }
    }
}

// Função de visibilidade global (sem alterações)
window.updateMenuVisibility = function(menuSettings) {
    const bottomMenu = document.querySelector('.bottom-menu');
    if (!bottomMenu) return;
    const menuItems = bottomMenu.querySelectorAll('.menu-item');
    const settingToKeyMap = { '1x': '1x', 'bank': 'bank', 'empire': 'empire', 'market': 'market', 'profile': 'profile', 'rankings': 'rankings', 'team': 'team' };
    menuItems.forEach(item => {
        const menuKey = item.dataset.menuKey;
        if (menuKey) {
            const settingName = settingToKeyMap[menuKey];
            const settingValue = menuSettings[settingName];
            item.classList.toggle('hidden', settingValue === 'off');
        }
    });
}
