// Função principal que é chamada quando a página carrega
document.addEventListener('DOMContentLoaded', loadAdminMenu);

/**
 * Carrega o HTML do menu, insere-o na página e configura
 * toda a interatividade (dropdowns e item ativo).
 */
async function loadAdminMenu() {
    const menuPlaceholder = document.getElementById('menu-placeholder');
    if (!menuPlaceholder) {
        console.error("Elemento '#menu-placeholder' não encontrado.");
        return;
    }

    try {
        const response = await fetch('templates/menu-admin.html');
        if (!response.ok) {
            throw new Error(`Erro ao carregar menu-admin.html: ${response.statusText}`);
        }
        
        const menuHTML = await response.text();
        menuPlaceholder.innerHTML = menuHTML;
        
        // Configura as funcionalidades após o menu ser carregado
        setupDropdownMenus();
        setupHamburgerMenu(); // NOVA FUNÇÃO
        setActiveMenuItem();
        
    } catch (error) {
        console.error("Falha ao carregar o menu de administração:", error);
    }
}

/**
 * Adiciona os eventos de clique para abrir/fechar os menus dropdown.
 */
function setupDropdownMenus() {
    const dropdowns = document.querySelectorAll('.nav-item-dropdown');

    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.menu-item-trigger');
        trigger.addEventListener('click', (event) => {
            event.stopPropagation();
            
            // Fecha outros dropdowns no mesmo nível
            if (!dropdown.classList.contains('active')) {
                dropdowns.forEach(d => d.classList.remove('active'));
            }

            dropdown.classList.toggle('active');
        });
    });

    // Fecha os menus dropdown se clicar fora (apenas em modo desktop)
    document.addEventListener('click', () => {
        if (window.innerWidth > 768) {
            document.querySelectorAll('.nav-item-dropdown.active').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
}

/**
 * NOVO: Adiciona a lógica de clique para o botão hamburger.
 */
function setupHamburgerMenu() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const menuPlaceholder = document.getElementById('menu-placeholder');

    if (!hamburgerBtn || !menuPlaceholder) {
        console.error("Botão hamburger ou placeholder do menu não encontrados.");
        return;
    }

    hamburgerBtn.addEventListener('click', () => {
        menuPlaceholder.classList.toggle('mobile-menu-open');
    });
}

/**
 * Encontra a página atual e destaca o item de menu pai correspondente.
 */
function setActiveMenuItem() {
    const currentPage = window.location.pathname.split('/').pop();
    if (!currentPage) return;

    const activeLink = document.querySelector(`.submenu a[href$="${currentPage}"]`);
    
    if (activeLink) {
        const dropdownParent = activeLink.closest('.nav-item-dropdown');
        const parentTrigger = dropdownParent.querySelector('.menu-item-trigger');
        
        if (parentTrigger) {
            parentTrigger.classList.add('active-parent');
        }
        // Em mobile, pode querer que o submenu já apareça aberto
        if (window.innerWidth <= 768) {
            dropdownParent.classList.add('active');
        }

    } else {
        const homeIcon = document.querySelector(`.home-icon[href$="${currentPage}"]`);
        if (homeIcon) {
            homeIcon.classList.add('active');
        }
    }
}
