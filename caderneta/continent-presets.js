const CONTINENT_MAP_PRESETS = {
    europa: {
        label: 'Europa',
        focus: { x: 0.205, y: 0.015, scale: 2.72 },
        paddingRatio: 0.11,
        zoomBoost: 1.22,
        subpathViewportMarginX: 16,
        subpathViewportMarginY: 12,
        subpathKeepBounds: {
            minX: 330,
            maxX: 640,
            minY: 60,
            maxY: 235
        },
        keepLargestSubpathsByIso: {
            FR: 2,
            PT: 1,
            ES: 1
        },
        viewportIsoCodes: [
            'PT', 'ES', 'FR', 'GB', 'IE', 'BE', 'NL', 'LU', 'DE', 'CH', 'AT',
            'IT', 'DK', 'NO', 'SE', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO',
            'BG', 'GR', 'HR', 'RS', 'SI', 'BA', 'ME', 'AL', 'MK', 'UA', 'BY',
            'LT', 'LV', 'EE', 'MD', 'CY', 'MT', 'TR'
        ]
    },
    america_norte: {
        label: 'America do Norte',
        focus: { x: 0.18, y: 0.28, scale: 2.8 },
        paddingRatio: 0.1,
        zoomBoost: 1.08,
        viewportIsoCodes: [
            'US', 'CA', 'MX', 'CR', 'PA', 'JM', 'HT', 'HN', 'SV', 'GT', 'NI',
            'DO', 'CU', 'TT'
        ]
    },
    america_sul: {
        label: 'America do Sul',
        focus: { x: 0.28, y: 0.66, scale: 3.1 },
        paddingRatio: 0.1,
        zoomBoost: 1.08,
        viewportIsoCodes: [
            'BR', 'AR', 'UY', 'PY', 'CL', 'BO', 'PE', 'EC', 'CO', 'VE'
        ]
    },
    africa: {
        label: 'Africa',
        focus: { x: 0.53, y: 0.54, scale: 3.2 },
        paddingRatio: 0.1,
        zoomBoost: 1.08,
        viewportIsoCodes: [
            'MA', 'DZ', 'TN', 'EG', 'LY', 'SD', 'SN', 'CI', 'GH', 'NG', 'CM',
            'ML', 'BF', 'GN', 'GA', 'CD', 'CG', 'AO', 'ZA', 'MZ', 'ZM', 'KE',
            'ET', 'UG', 'TZ', 'RW', 'BI', 'MG'
        ]
    },
    asia: {
        label: 'Asia',
        focus: { x: 0.74, y: 0.33, scale: 2.6 },
        paddingRatio: 0.1,
        zoomBoost: 1.08,
        viewportIsoCodes: [
            'JP', 'KR', 'KP', 'CN', 'TW', 'HK', 'MN', 'VN', 'TH', 'MY', 'SG',
            'ID', 'PH', 'IN', 'PK', 'BD', 'LK', 'NP', 'IR', 'IQ', 'SA', 'QA',
            'AE', 'OM', 'JO', 'IL', 'LB', 'SY', 'KZ', 'UZ', 'TM', 'KG', 'TJ'
        ]
    },
    oceania: {
        label: 'Oceania',
        focus: { x: 0.86, y: 0.73, scale: 4.4 },
        paddingRatio: 0.1,
        zoomBoost: 1.08,
        viewportIsoCodes: ['AU', 'NZ', 'FJ', 'PG', 'NC']
    }
};

export { CONTINENT_MAP_PRESETS };
