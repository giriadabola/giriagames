const LOGO_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'svg'];
const FALLBACK_LOGO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#8892b0" d="M32 4 8 12v16c0 16 10 27 24 33 14-6 24-17 24-33V12L32 4zm0 8 16 5v11c0 11-6 20-16 25-10-5-16-14-16-25V17l16-5z"/></svg>'
)}`;

function normaliseLogoPath(value) {
    const path = String(value || '').trim().replace(/\\/g, '/');
    if (!path) return '';
    if (/^(https?:|data:|blob:|\/\/|\/)/i.test(path) || path.startsWith('../')) return path;
    return `../${path.replace(/^\.\//, '')}`;
}

function getLogoCandidates(club) {
    const candidates = [];
    const savedImage = normaliseLogoPath(club?.imagem);
    if (savedImage) candidates.push(savedImage);

    const country = String(club?.pais || '').trim();
    const code = String(club?.codigoUrl || '').trim();
    if (country && code) {
        const folder = encodeURIComponent(country);
        const fileCode = encodeURIComponent(code);
        LOGO_EXTENSIONS.forEach(extension => {
            candidates.push(`../assets/equipalogos/${folder}/club_${fileCode}.${extension}`);
        });
    }

    return [...new Set(candidates)];
}

export function createClubLogoImage(club, alt = '') {
    const image = document.createElement('img');
    image.className = 'team-logo';
    image.alt = alt || club?.nome || 'Emblema do clube';

    const candidates = getLogoCandidates(club);
    if (candidates.length === 0) {
        image.src = FALLBACK_LOGO;
        return image;
    }

    let candidateIndex = 0;
    const handleImageError = () => {
        candidateIndex += 1;
        if (candidateIndex < candidates.length) {
            image.src = candidates[candidateIndex];
            return;
        }

        image.removeEventListener('error', handleImageError);
        image.src = FALLBACK_LOGO;
    };
    image.addEventListener('error', handleImageError);
    image.src = candidates[0] || FALLBACK_LOGO;
    return image;
}
