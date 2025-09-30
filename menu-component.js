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

    // 2. O CSS do menu (sem alterações)
    const menuCSS = `
        .bottom-menu { position: fixed; bottom: 0; left: 0; width: 100%; background-color: var(--card-bg, #ffffff); box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1); padding: 12px 0; display: flex; justify-content: center; gap: 32px; align-items: center; z-index: 1000; }
        .menu-item { display: flex; flex-direction: column; align-items: center; text-decoration: none; color: var(--secondary-text, #7f8c8d); transition: color 0.3s ease, transform 0.3s ease; position: relative; }
        .menu-item.hidden { display: none; }
        .menu-item:hover { color: var(--primary-text, #2c3e50); transform: translateY(-3px); }
        .menu-item.active { color: var(--accent-color, #3498db); }
        .menu-item.active::before { content: ''; position: absolute; top: -12px; width: 25px; height: 3px; background-color: var(--accent-color, #3498db); border-radius: 2px; }
        .menu-item i { font-size: 24px; margin-bottom: 4px; }
        .empire-icon { font-size: 42px; color: #2176ff; transform: translateY(-3px); filter: drop-shadow(0 0 8px rgba(33, 118, 255, 0.4)); transition: all 0.3s ease; }
        .empire-icon:hover { color: #0056d6; transform: translateY(-8px); filter: drop-shadow(0 0 12px rgba(33, 118, 255, 0.6)); }
    `;

    // 3. Injeção (sem alterações)
    const styleElement = document.createElement('style');
    styleElement.textContent = menuCSS;
    document.head.appendChild(styleElement);
    document.body.insertAdjacentHTML('beforeend', menuHTML);
    
    // 4. Marcar item ativo (sem alterações)
    setActiveMenuItem();
});

function setActiveMenuItem() {
    const currentPage = window.location.pathname.split('/').pop();
    const pageToMenuKey = { '1x.html': '1x', 'market.html': 'market', 'team.html': 'team', 'empire.html': 'empire', 'rankings.html': 'rankings', 'profile.html': 'profile' };
    const activeKey = pageToMenuKey[currentPage];
    if (activeKey) {
        const menuItem = document.querySelector(`.menu-item[data-menu-key="${activeKey}"]`);
        if (menuItem) {
            menuItem.classList.add('active');
        }
    }
}

// NOVO: A função de visibilidade agora mora aqui e é global.
// O script principal irá chamar esta função.
window.updateMenuVisibility = function(menuSettings) {
    const bottomMenu = document.querySelector('.bottom-menu');
    if (!bottomMenu) return; // Se o menu ainda não carregou, sai para evitar erros

    const menuItems = bottomMenu.querySelectorAll('.menu-item');
    const settingToKeyMap = { '1x': '1x', 'bank': 'bank', 'empire': 'empire', 'market': 'market', 'profile': 'profile', 'rankings': 'rankings', 'team': 'team' };
    
    menuItems.forEach(item => {
        const menuKey = item.dataset.menuKey;
        if (menuKey) {
            const settingName = settingToKeyMap[menuKey];
            const settingValue = menuSettings[settingName];
            if (settingValue === 'off') {
                item.classList.add('hidden');
            } else {
                item.classList.remove('hidden');
            }
        }
    });
}
