import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Guard function to check if page content should be visible.
 * If page toggle is 'off' in Firestore 'paineis/paineis paginas' AND user is not 'ruler',
 * the main content is hidden and an indisponibility banner is shown.
 *
 * @param {string} pageKey - Key of the page (e.g. '1x', 'market', 'banca', 'bank', etc.)
 * @param {string} userStatus - Status/role of the user (e.g. 'ruler', 'user', etc.)
 * @param {object} db - Firestore database instance
 * @returns {Promise<boolean>} True if allowed, false if blocked
 */
export async function checkPageContentAccess(pageKey, userStatus, db) {
    if (userStatus === 'ruler') {
        return true; // Ruler always has full access
    }

    try {
        const pagesDocRef = doc(db, 'paineis', 'paineis paginas');
        const pagesDocSnap = await getDoc(pagesDocRef);
        
        if (pagesDocSnap.exists()) {
            const pagesData = pagesDocSnap.data();
            if (pagesData[pageKey] === 'off') {
                showContentBlockedOverlay();
                return false;
            }
        }
    } catch (error) {
        console.error("Error checking page content access:", error);
    }
    return true;
}

/**
 * Hides page main containers and displays a friendly blocked overlay banner.
 */
export function showContentBlockedOverlay() {
    // Hide main content elements
    const mainContentElements = document.querySelectorAll('main, .content, #content, .container, .main-container, #main-content-wrapper');
    mainContentElements.forEach(el => {
        if (!el.classList.contains('top-menu') && !el.classList.contains('bottom-menu')) {
            el.style.display = 'none';
        }
    });

    // Create & append blocked overlay if not already present
    if (!document.getElementById('page-content-blocked-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'page-content-blocked-overlay';
        overlay.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 65vh;
            padding: 40px 20px;
            text-align: center;
            color: #8892b0;
            font-family: 'Poppins', Arial, sans-serif;
            margin-top: 60px;
            z-index: 999;
        `;
        overlay.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 50%; width: 84px; height: 84px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.2);">
                <i class="fas fa-lock" style="font-size: 38px; color: #ef4444;"></i>
            </div>
            <h2 style="color: #ffffff; font-size: 26px; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.02em;">Conteúdo Indisponível</h2>
            <p style="color: #8892b0; font-size: 15px; max-width: 480px; line-height: 1.6;">O conteúdo desta página encontra-se temporariamente desativado pela administração.</p>
        `;
        document.body.appendChild(overlay);
    }
}
