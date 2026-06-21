import { FILTERS } from './extrair-perfil-stats.js';

const PLAYER_ICONS = {
  lion: { bg1: '#f59e0b', bg2: '#7c2d12', glyph: '<path d="M26 25l7-9 9 5 9-5 7 9-4 27H30z"/><path d="M31 33c2-7 7-11 11-11s9 4 11 11"/><circle cx="37" cy="38" r="2.2"/><circle cx="47" cy="38" r="2.2"/><path d="M39 44l3 3 3-3"/><path d="M36 49c4 2 8 2 12 0"/>' },
  wave: { bg1: '#38bdf8', bg2: '#1d4ed8', glyph: '<path d="M18 46c6 0 6-7 12-7s6 7 12 7 6-7 12-7 6 7 12 7"/><path d="M18 35c6 0 6-7 12-7s6 7 12 7 6-7 12-7 6 7 12 7"/><path d="M42 18c6 7 6 12 0 18-6-6-6-11 0-18z"/>' },
  buffalo: { bg1: '#92400e', bg2: '#2d1606', glyph: '<path d="M18 27c8 0 9-10 18-10v7c3-3 6-5 8-5s5 2 8 5v-7c9 0 10 10 18 10-4 2-7 6-8 10H26c-1-4-4-8-8-10z"/><path d="M28 37h28l-3 17H31z"/><circle cx="38" cy="41" r="2.2"/><circle cx="46" cy="41" r="2.2"/><path d="M39 49h6"/>' },
  elephant: { bg1: '#94a3b8', bg2: '#334155', glyph: '<path d="M23 34c0-10 8-16 19-16h1c11 0 19 6 19 16v8c0 6-4 11-10 13v7h-9v-8h-2c-10 0-18-8-18-18z"/><path d="M42 35c0 5 3 7 7 9 5 2 7 5 7 9 0 3-2 6-4 8"/><path d="M33 33c2 2 4 3 6 3"/><circle cx="35" cy="30" r="2.2"/><path d="M33 42l-3 5m24-5l3 5"/>' },
  tiger: { bg1: '#fb923c', bg2: '#7c2d12', glyph: '<path d="M24 27l8-10 8 7 2-6 2 6 8-7 8 10-4 27H28z"/><path d="M31 30l3 9m8-13v16m11-12l-3 9"/><circle cx="37" cy="39" r="2.2"/><circle cx="47" cy="39" r="2.2"/><path d="M39 44l3 3 3-3"/><path d="M37 49c4 2 8 2 10 0"/>' },
  hyena: { bg1: '#a16207', bg2: '#3f2a0f', glyph: '<path d="M25 29l7-10 7 4 5-3 7 3 8-4 5 10-4 24H29z"/><circle cx="37" cy="38" r="2.2"/><circle cx="47" cy="37" r="2.2"/><path d="M37 47c4 3 10 3 14 0"/><path d="M35 48l4-1m4 1l4-1m4 1l4-1"/><path d="M31 33l-3 3m26-4l4 3"/>' },
  boa: { bg1: '#22c55e', bg2: '#14532d', glyph: '<path d="M22 44c0-8 5-13 12-13 6 0 8 4 8 7s-2 7-8 7c-4 0-6 3-6 6 0 3 3 5 6 5h16c7 0 12-5 12-11 0-7-5-12-12-12-4 0-7 2-9 5"/><circle cx="25" cy="44" r="5"/><circle cx="23.5" cy="43" r="1.4"/><circle cx="26.5" cy="43" r="1.4"/><path d="M25 48v5"/>' },
  gator: { bg1: '#16a34a', bg2: '#14532d', glyph: '<path d="M17 41c8-10 18-15 31-15 6 0 12 1 19 4-7 3-12 7-15 13l-24 1c-4 0-8-1-11-3z"/><path d="M36 33h21"/><path d="M42 38h18"/><path d="M47 44l3 3 3-3 3 3 3-3"/><circle cx="32" cy="31" r="2"/>' },
  hippo: { bg1: '#64748b', bg2: '#1e293b', glyph: '<path d="M19 36c0-11 10-18 23-18s23 7 23 18v6c0 7-5 12-12 12H31c-7 0-12-5-12-12z"/><path d="M27 39h30v11H27z"/><circle cx="37" cy="33" r="2.2"/><circle cx="47" cy="33" r="2.2"/><circle cx="37" cy="44" r="1.8"/><circle cx="47" cy="44" r="1.8"/>' },
  eagle: { bg1: '#fbbf24', bg2: '#78350f', glyph: '<path d="M22 44c7-12 16-19 29-19 7 0 12 2 18 7-5 1-8 3-12 7l-5 6H31z"/><path d="M50 35l12 2-8 6"/><circle cx="39" cy="31" r="2.1"/><path d="M25 48l8-7m10 4l8-6"/>' },
  wolf: { bg1: '#cbd5e1', bg2: '#334155', glyph: '<path d="M24 28l8-12 8 9 2-7 2 7 8-9 8 12-5 25H29z"/><circle cx="37" cy="39" r="2.2"/><circle cx="47" cy="39" r="2.2"/><path d="M39 45l3-3 3 3"/><path d="M36 50c5 2 9 2 12 0"/>' },
  rhino: { bg1: '#9ca3af', bg2: '#374151', glyph: '<path d="M20 42c0-9 8-16 21-16 9 0 16 2 24 8l-8 3v13H30c-6 0-10-3-10-8z"/><path d="M57 30l9-8-2 10"/><circle cx="34" cy="31" r="2.1"/><path d="M29 50h19"/>' },
  cobra: { bg1: '#10b981', bg2: '#064e3b', glyph: '<path d="M42 17c10 0 18 7 18 17 0 8-5 13-12 16v9H36v-9c-7-3-12-8-12-16 0-10 8-17 18-17z"/><circle cx="36" cy="32" r="2.1"/><circle cx="48" cy="32" r="2.1"/><path d="M42 38v10"/><path d="M42 48l-2 4m2-4l2 4"/>' },
  shark: { bg1: '#38bdf8', bg2: '#0f172a', glyph: '<path d="M15 43c8-11 18-17 32-17 6 0 12 2 18 5l7 2-7 4 7 6c-6 3-12 5-18 5-14 0-24-5-32-13z"/><path d="M39 27l8-12 5 13"/><path d="M23 43l-8-7v14z"/><circle cx="47" cy="35" r="2"/><path d="M54 42c-4 2-8 3-13 3"/>' },
  falcon: { bg1: '#60a5fa', bg2: '#172554', glyph: '<path d="M20 46c7-14 17-22 29-22 8 0 13 2 19 7l-14 3-5 8-6 7H27z"/><path d="M49 34l13 2-7 5"/><circle cx="39" cy="30" r="2"/><path d="M32 48l8-7"/>' },
  panther: { bg1: '#475569', bg2: '#020617', glyph: '<path d="M24 28l8-11 8 8 2-6 2 6 8-8 8 11-5 26H29z"/><circle cx="37" cy="39" r="2.2"/><circle cx="47" cy="39" r="2.2"/><path d="M39 45l3 2 3-2"/><path d="M36 50c4 1 8 1 12 0"/>' },
  bear: { bg1: '#92400e', bg2: '#422006', glyph: '<circle cx="31" cy="25" r="5"/><circle cx="53" cy="25" r="5"/><path d="M22 37c0-11 9-18 20-18s20 7 20 18v6c0 6-5 11-11 11H33c-6 0-11-5-11-11z"/><circle cx="37" cy="36" r="2.2"/><circle cx="47" cy="36" r="2.2"/><path d="M39 44l3 2 3-2"/>' },
  fox: { bg1: '#f97316', bg2: '#7c2d12', glyph: '<path d="M22 28l10-12 10 10 10-10 10 12-8 26H30z"/><circle cx="37" cy="38" r="2.2"/><circle cx="47" cy="38" r="2.2"/><path d="M39 45l3 3 3-3"/><path d="M34 50l8-5 8 5"/>' },
  owl: { bg1: '#8b5cf6', bg2: '#312e81', glyph: '<path d="M27 25l7-8 8 7 8-7 7 8v23c0 4-3 7-7 7H34c-4 0-7-3-7-7z"/><circle cx="36" cy="35" r="5"/><circle cx="48" cy="35" r="5"/><circle cx="36" cy="35" r="1.8"/><circle cx="48" cy="35" r="1.8"/><path d="M42 42l-3 4h6z"/>' },
  bull: { bg1: '#ef4444', bg2: '#450a0a', glyph: '<path d="M18 27c8 0 10-10 19-10v7c2-3 4-4 5-4s3 1 5 4v-7c9 0 11 10 19 10-5 2-8 6-9 10H27c-1-4-4-8-9-10z"/><path d="M28 37h28l-4 17H32z"/><circle cx="38" cy="41" r="2.2"/><circle cx="46" cy="41" r="2.2"/><path d="M39 49h6"/>' }
};

const ICON_ALIASES = {
  leao: 'lion', 'leão': 'lion', agua: 'wave', 'água': 'wave', bufalo: 'buffalo', 'búfalo': 'buffalo',
  elefante: 'elephant', tigre: 'tiger', hiena: 'hyena', jiboia: 'boa', jibóia: 'boa',
  jacare: 'gator', jacaré: 'gator', hipopotamo: 'hippo', hipopótamo: 'hippo', aguia: 'eagle', 'águia': 'eagle',
  lobo: 'wolf', rinoceronte: 'rhino', cobra: 'cobra', tubarao: 'shark', tubarão: 'shark',
  falcao: 'falcon', falcão: 'falcon', pantera: 'panther', urso: 'bear', raposa: 'fox', coruja: 'owl', touro: 'bull'
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function renderSelectionsData(summary) {
  if (!summary) return '<div class="empty">Sem dados.</div>';
  
  const benefitedList = summary.topBenefited && summary.topBenefited.length 
    ? summary.topBenefited.map((item, idx) => `<div>${idx + 1}. <strong>${escapeHtml(item.name)}</strong> (${item.value})</div>`).join('')
    : '<div class="muted">Ninguém</div>';
    
  const harmedList = summary.topHarmed && summary.topHarmed.length 
    ? summary.topHarmed.map((item, idx) => `<div>${idx + 1}. <strong>${escapeHtml(item.name)}</strong> (${item.value})</div>`).join('')
    : '<div class="muted">Ninguém</div>';
    
  return `
    <div class="selections-stat-layout" style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px; font-size: 0.95rem;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
        <div>
          <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 4px;">Pontos que fez ganhar</span>
          <strong style="font-size: 1.4rem; color: #10b981;">+${summary.pointsGained} Pts</strong>
        </div>
        <div>
          <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 4px;">Pontos que fez perder</span>
          <strong style="font-size: 1.4rem; color: #ef4444;">-${summary.pointsLost} Pts</strong>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: rgba(16, 185, 129, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.1);">
          <strong style="display: block; margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #34d399;">Mais Beneficiados</strong>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${benefitedList}
          </div>
        </div>
        <div style="background: rgba(239, 68, 68, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.1);">
          <strong style="display: block; margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #f87171;">Mais Prejudicados</strong>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${harmedList}
          </div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
        <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; justify-content: space-between; min-height: 84px;">
          <div>
            <strong style="display: block; font-size: 0.85rem; margin-bottom: 2px;">Golos acertados</strong>
            <span style="font-size: 0.7rem; opacity: 0.6; display: block; line-height: 1.2;">Previsões corretas do nº de golos desta seleção</span>
          </div>
          <span style="font-size: 1.35rem; font-weight: bold; color: #facc15; margin-top: 6px;">${summary.correctGoalsCount}</span>
        </div>
        
        <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; justify-content: space-between; min-height: 84px;">
          <div>
            <strong style="display: block; font-size: 0.85rem; margin-bottom: 2px;">Prognóstico mais frequente</strong>
            <span style="font-size: 0.7rem; opacity: 0.6; display: block; line-height: 1.2;">Resultado mais apostado nos jogos desta seleção</span>
          </div>
          <span style="font-size: 1.35rem; font-weight: bold; color: #38bdf8; margin-top: 6px;">${summary.mostFrequentPrediction}</span>
        </div>
        
        <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; justify-content: space-between; min-height: 84px;">
          <div>
            <strong style="display: block; font-size: 0.85rem; margin-bottom: 2px;">Prognósticos Certos / Errados</strong>
            <span style="font-size: 0.7rem; opacity: 0.6; display: block; line-height: 1.2;">Certeiros (3 pts) vs Falhas (0 pts)</span>
          </div>
          <span style="font-size: 1.2rem; font-weight: bold; color: #f8fafc; margin-top: 6px;">
            <span style="color: #10b981;">${summary.correctPredictionsCount} certas</span><br><span style="color: #ef4444;">${summary.wrongPredictionsCount} erradas</span>
          </span>
        </div>
      </div>
    </div>
  `;
}

function stadiumImageName(stadiumName) {
  const norm = String(stadiumName || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
    
  const mapping = {
    mexico_city_stadium: '01_mexico_city_stadium',
    estadio_guadalajara: '02_estadio_guadalajara',
    estadio_monterrey: '03_monterrey_stadium',
    atlanta_stadium: '04_atlanta_stadium',
    dallas_stadium: '05_dallas_stadium',
    houston_stadium: '06_houston_stadium',
    kansas_city_stadium: '07_kansas_city_stadium',
    los_angeles_stadium: '08_los_angeles_stadium',
    new_york_new_jersey_stadium: '09_new_york_new_jersey_stadium',
    san_francisco_bay_area_stadium: '10_san_francisco_bay_area_stadium',
    toronto_stadium: '11_toronto_stadium',
    bc_place: '12_bc_place',
    boston_stadium: '13_boston_stadium',
    miami_stadium: '14_miami_stadium',
    philadelphia_stadium: '15_philadelphia_stadium',
    seattle_stadium: '16_seattle_stadium'
  };
  
  return mapping[norm] || norm;
}

function renderStadiumsData(summary, isVs = false) {
  if (!summary) return '<div class="empty">Sem dados.</div>';
  
  const benefitedList = summary.topBenefited && summary.topBenefited.length 
    ? summary.topBenefited.map((item, idx) => `<div>${idx + 1}. <strong>${escapeHtml(item.name)}</strong> (${item.value})</div>`).join('')
    : '<div class="muted">Ninguém</div>';
    
  const harmedList = summary.topHarmed && summary.topHarmed.length 
    ? summary.topHarmed.map((item, idx) => `<div>${idx + 1}. <strong>${escapeHtml(item.name)}</strong> (${item.value})</div>`).join('')
    : '<div class="muted">Ninguém</div>';

  const hasImage = !isVs && summary.selectedStadium && summary.selectedStadium !== 'all';
  const imgName = stadiumImageName(summary.selectedStadium);
  
  let middleSectionHtml = '';
  if (hasImage) {
    middleSectionHtml = `
      <div style="display: grid; grid-template-columns: 1.1fr 1.3fr 1.1fr; gap: 12px; align-items: center; min-height: 180px;">
        <div style="background: rgba(16, 185, 129, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.1); height: 100%;">
          <strong style="display: block; margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #34d399;">Mais Beneficiados</strong>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${benefitedList}
          </div>
        </div>
        
        <div style="display: flex; justify-content: center; align-items: center; padding: 0 4px;">
          <img src="stadium/${imgName}.png" alt="${escapeHtml(summary.selectedStadium)}" style="width: 100%; max-height: 200px; object-fit: contain; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.55));" />
        </div>
        
        <div style="background: rgba(239, 68, 68, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.1); height: 100%;">
          <strong style="display: block; margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #f87171;">Mais Prejudicados</strong>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${harmedList}
          </div>
        </div>
      </div>
    `;
  } else {
    middleSectionHtml = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: rgba(16, 185, 129, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.1); height: 100%;">
          <strong style="display: block; margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #34d399;">Mais Beneficiados</strong>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${benefitedList}
          </div>
        </div>
        <div style="background: rgba(239, 68, 68, 0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.1); height: 100%;">
          <strong style="display: block; margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #f87171;">Mais Prejudicados</strong>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${harmedList}
          </div>
        </div>
      </div>
    `;
  }
    
  return `
    <div class="selections-stat-layout" style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px; font-size: 0.95rem;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
        <div>
          <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 4px;">Pontos que fez ganhar</span>
          <strong style="font-size: 1.4rem; color: #10b981;">+${summary.pointsGained} Pts</strong>
        </div>
        <div>
          <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 4px;">Pontos que fez perder</span>
          <strong style="font-size: 1.4rem; color: #ef4444;">-${summary.pointsLost} Pts</strong>
        </div>
      </div>
      
      ${middleSectionHtml}
      
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
        <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; justify-content: space-between; min-height: 84px;">
          <div>
            <strong style="display: block; font-size: 0.85rem; margin-bottom: 2px;">Golos acertados</strong>
            <span style="font-size: 0.7rem; opacity: 0.6; display: block; line-height: 1.2;">Previsões corretas do nº de golos das equipas</span>
          </div>
          <span style="font-size: 1.35rem; font-weight: bold; color: #facc15; margin-top: 6px;">${summary.correctGoalsCount}</span>
        </div>
        
        <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; justify-content: space-between; min-height: 84px;">
          <div>
            <strong style="display: block; font-size: 0.85rem; margin-bottom: 2px;">Prognóstico mais frequente</strong>
            <span style="font-size: 0.7rem; opacity: 0.6; display: block; line-height: 1.2;">Resultado mais apostado neste estádio</span>
          </div>
          <span style="font-size: 1.35rem; font-weight: bold; color: #38bdf8; margin-top: 6px;">${summary.mostFrequentPrediction}</span>
        </div>
        
        <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; justify-content: space-between; min-height: 84px;">
          <div>
            <strong style="display: block; font-size: 0.85rem; margin-bottom: 2px;">Prognósticos Certos / Errados</strong>
            <span style="font-size: 0.7rem; opacity: 0.6; display: block; line-height: 1.2;">Certeiros (3 pts) vs Falhas (0 pts)</span>
          </div>
          <span style="font-size: 1.2rem; font-weight: bold; color: #f8fafc; margin-top: 6px;">
            <span style="color: #10b981;">${summary.correctPredictionsCount} certas</span><br><span style="color: #ef4444;">${summary.wrongPredictionsCount} erradas</span>
          </span>
        </div>
      </div>
    </div>
  `;
}

export function renderProfile(profile, activeFilters, chartViews = {}) {
  if (!activeFilters.length) {
    return '<div class="empty">Escolhe uma ou mais opções para gerar o perfil.</div>';
  }

  const selectedPlayer = profile.selectedPlayers.length === 1 ? profile.selectedPlayers[0] : null;
  const sections = activeFilters
    .map((key) => renderSection(key, profile.summaries[key], selectedPlayer?.participantName || '', chartViews))
    .join('');
  const titleIcon = selectedPlayer ? renderParticipantIcon(selectedPlayer.icon, selectedPlayer.participantName) : '';
  return `
    <header class="profile-head">
      <div>
        <span class="report-kicker">Mundial 2026 · Perfil de prognósticos</span>
        <div class="profile-title">${titleIcon}<h2>${escapeHtml(profile.scopeLabel)}</h2></div>
        <p class="muted">Leitura dos momentos em que os golos mudaram o rumo dos prognósticos.</p>
      </div>
    </header>

    <div class="section-grid">${sections}</div>
  `;
}

export function renderVsProfile(leftProfile, rightProfile, activeFilters, chartViews = {}) {
  if (!activeFilters.length) {
    return '<div class="empty">Escolhe uma ou mais opções para gerar o VS.</div>';
  }

  const sections = activeFilters.map((key) => renderVsSection(key, leftProfile.summaries[key], rightProfile.summaries[key], chartViews)).join('');
  const leftPlayer = leftProfile.selectedPlayers[0];
  const rightPlayer = rightProfile.selectedPlayers[0];
  return `
    <header class="profile-head vs-head">
      <div class="vs-title-card">
        ${renderParticipantIcon(leftPlayer?.icon, leftProfile.scopeLabel)}
        <div>
          <span class="report-kicker">Jogador A</span>
          <h2>${escapeHtml(leftProfile.scopeLabel)}</h2>
        </div>
      </div>
      <div class="vs-mark">VS</div>
      <div class="vs-title-card right">
        ${renderParticipantIcon(rightPlayer?.icon, rightProfile.scopeLabel)}
        <div>
          <span class="report-kicker">Jogador B</span>
          <h2>${escapeHtml(rightProfile.scopeLabel)}</h2>
        </div>
      </div>
      <p class="muted vs-copy">Leitura dos momentos em que os golos mudaram o rumo dos prognósticos.</p>
    </header>

    <div class="vs-section-grid">${sections}</div>
  `;
}

function renderSection(key, summary, hiddenPlayerName = '', chartViews = {}) {
  const config = FILTERS[key];
  if (key === 'selections') {
    const selectionName = summary?.selectedSelection === 'all' ? 'Todas as Seleções' : summary?.selectedSelection;
    return `
      <article class="stat-card tone-warn" style="grid-column: span 2;">
        <h3>
          <span>Seleção: ${escapeHtml(selectionName)}</span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        ${renderSelectionsData(summary)}
      </article>
    `;
  }
  if (key === 'stadiums') {
    const stadiumName = summary?.selectedStadium === 'all' ? 'Todos os Estádios' : summary?.selectedStadium;
    return `
      <article class="stat-card tone-warn" style="grid-column: span 2;">
        <h3>
          <span>Estádio: ${escapeHtml(stadiumName)}</span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        ${renderStadiumsData(summary)}
      </article>
    `;
  }
  const rows = summary?.rows || [];
  const tone = summary?.tone || 'warn';
  const isCircularFilter = ['lost', 'dramaticLost', 'gains', 'lateGains', 'aloneInFame', 'wonWithStyle'].includes(key);
  const showCircular = isCircularFilter && !!chartViews[key];
  
  const toggleBtn = isCircularFilter 
    ? `<button class="btn-toggle-chart" data-filter="${escapeHtml(key)}" type="button" data-html2canvas-ignore="true">${showCircular ? '📋 Lista' : '📊 Gráfico'}</button>` 
    : '';

  const isPointFilter = ['lost', 'dramaticLost', 'gains', 'lateGains'].includes(key);
  const isGameFilter = ['wonWithStyle', 'aloneInFame'].includes(key);
  const pillVal = isPointFilter && summary?.points !== undefined 
    ? `${summary.points} Pts` 
    : (isGameFilter && summary?.count !== undefined 
        ? (showCircular ? `${summary.count} Jogos` : `${summary.points} Pts`) 
        : (summary?.count ?? 0));
  return `
    <article class="stat-card tone-${escapeHtml(tone)}">
      <h3>
        <span>${escapeHtml(config.title)}</span>
        <span style="display: flex; align-items: center; gap: 8px;">
          ${toggleBtn}
          <span class="pill">${escapeHtml(pillVal)}</span>
        </span>
      </h3>
      <p class="muted">${escapeHtml(config.text)}</p>
      ${rows.length 
        ? (showCircular ? renderDoughnut(rows, tone, hiddenPlayerName) : `<div class="list">${rows.map((row) => renderRow(row, tone, hiddenPlayerName)).join('')}</div>`) 
        : '<div class="empty">Sem dados para esta opção.</div>'}
    </article>
  `;
}

function renderVsSection(key, leftSummary, rightSummary, chartViews = {}) {
  const config = FILTERS[key];
  if (key === 'selections') {
    return `
      <article class="stat-card vs-card" style="grid-column: span 2;">
        <h3>
          <span>Seleções</span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        <div class="vs-columns">
          ${renderVsColumn(leftSummary, 'A', key, false)}
          ${renderVsColumn(rightSummary, 'B', key, false)}
        </div>
      </article>
    `;
  }
  if (key === 'stadiums') {
    return `
      <article class="stat-card vs-card" style="grid-column: span 2;">
        <h3>
          <span>Estádios</span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        <div class="vs-columns">
          ${renderVsColumn(leftSummary, 'A', key, false)}
          ${renderVsColumn(rightSummary, 'B', key, false)}
        </div>
      </article>
    `;
  }
  const isCircularFilter = ['lost', 'dramaticLost', 'gains', 'lateGains', 'aloneInFame', 'wonWithStyle'].includes(key);
  const showCircular = isCircularFilter && !!chartViews[key];

  const toggleBtn = isCircularFilter 
    ? `<button class="btn-toggle-chart" data-filter="${escapeHtml(key)}" type="button" data-html2canvas-ignore="true">${showCircular ? '📋 Lista' : '📊 Gráfico'}</button>` 
    : '';

  const isPointFilter = ['lost', 'dramaticLost', 'gains', 'lateGains'].includes(key);
  const isGameFilter = ['wonWithStyle', 'aloneInFame'].includes(key);
  const leftPill = isPointFilter && leftSummary?.points !== undefined 
    ? `${leftSummary.points} Pts` 
    : (isGameFilter && leftSummary?.count !== undefined 
        ? (showCircular ? `${leftSummary.count} Jogos` : `${leftSummary.points} Pts`) 
        : (leftSummary?.count ?? 0));
  const rightPill = isPointFilter && rightSummary?.points !== undefined 
    ? `${rightSummary.points} Pts` 
    : (isGameFilter && rightSummary?.count !== undefined 
        ? (showCircular ? `${rightSummary.count} Jogos` : `${rightSummary.points} Pts`) 
        : (rightSummary?.count ?? 0));
  return `
    <article class="stat-card vs-card">
      <h3>
        <span>${escapeHtml(config.title)}</span>
        <span style="display: flex; align-items: center; gap: 8px;">
          ${toggleBtn}
          <span class="pill">${escapeHtml(leftPill)} · ${escapeHtml(rightPill)}</span>
        </span>
      </h3>
      <p class="muted">${escapeHtml(config.text)}</p>
      <div class="vs-columns">
        ${renderVsColumn(leftSummary, 'A', key, showCircular)}
        ${renderVsColumn(rightSummary, 'B', key, showCircular)}
      </div>
    </article>
  `;
}

function renderVsColumn(summary, label, key, showCircular = false) {
  if (key === 'selections') {
    return `
      <section class="vs-column">
        <div class="vs-column-head"><strong>Jogador ${label}</strong></div>
        ${renderSelectionsData(summary)}
      </section>
    `;
  }
  if (key === 'stadiums') {
    return `
      <section class="vs-column">
        <div class="vs-column-head"><strong>Jogador ${label}</strong></div>
        ${renderStadiumsData(summary)}
      </section>
    `;
  }
  const rows = summary?.rows || [];
  const tone = summary?.tone || 'warn';
  const isPointFilter = ['lost', 'dramaticLost', 'gains', 'lateGains'].includes(key);
  const isGameFilter = ['wonWithStyle', 'aloneInFame'].includes(key);
  const colPill = isPointFilter && summary?.points !== undefined 
    ? `${summary.points} Pts` 
    : (isGameFilter && summary?.count !== undefined 
        ? (showCircular ? `${summary.count} Jogos` : `${summary.points} Pts`) 
        : (summary?.count ?? 0));
  return `
    <section class="vs-column">
      <div class="vs-column-head"><strong>Jogador ${label}</strong><span>${escapeHtml(colPill)}</span></div>
      ${rows.length 
        ? (showCircular ? renderDoughnut(rows, tone, '') : `<div class="list compact">${rows.slice(0, 5).map((row) => renderRow(row, tone)).join('')}</div>`) 
        : '<div class="empty small">Sem dados.</div>'}
    </section>
  `;
}

function renderRow(row, tone, hiddenPlayerName = '') {
  const valueNumber = Number(String(row.value).match(/-?\d+/)?.[0] || 0);
  const metricTone = metricToneForValue(valueNumber, tone);
  const impact = Math.min(100, Math.max(14, Math.abs(valueNumber) * 22));
  const title = titleWithoutPlayer(row.title, hiddenPlayerName);
  return `
    <div class="row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(row.meta || '')}</small>
      </div>
      <div class="row-metric">
        <strong class="points ${metricTone}">${escapeHtml(row.value)}</strong>
        <span class="impact-track"><i style="width:${impact}%"></i></span>
      </div>
    </div>
  `;
}

function titleWithoutPlayer(title, playerName) {
  if (!playerName) return title;
  const prefix = `${playerName} · `;
  return String(title || '').startsWith(prefix) ? String(title).slice(prefix.length) : title;
}

function metricToneForValue(value, fallback) {
  if (fallback === 'bad' && value > 0) return value >= 3 ? 'bad' : 'orange';
  if (fallback === 'warn') return 'warn';
  if (value <= -3) return 'bad';
  if (value < 0) return 'orange';
  if (value > 0) return 'good';
  return fallback || 'warn';
}

function renderParticipantIcon(iconKey, label) {
  const key = normalizeIconKey(iconKey) || autoIconKeyFromName(label);
  const meta = PLAYER_ICONS[key];
  if (!meta) {
    const initials = String(label || '?').split(/\s+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase();
    return `<span class="profile-icon fallback">${escapeHtml(initials)}</span>`;
  }
  const gradientId = `profile-icon-${escapeHtml(key)}`;
  return `<span class="profile-icon" title="${escapeHtml(label)}"><svg viewBox="0 0 84 84" aria-hidden="true" focusable="false"><defs><linearGradient id="${gradientId}" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="${meta.bg1}"/><stop offset="100%" stop-color="${meta.bg2}"/></linearGradient></defs><rect x="4" y="4" width="76" height="76" rx="24" fill="url(#${gradientId})"/><circle cx="42" cy="42" r="31" fill="rgba(255,255,255,.08)"/><g fill="none" stroke="#f8fbff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${meta.glyph}</g></svg></span>`;
}

function normalizeIconKey(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/^fa-/, '').replace(/\s+/g, '-').replace(/_/g, '-');
  return ICON_ALIASES[raw] || raw;
}

function autoIconKeyFromName(name) {
  const keys = Object.keys(PLAYER_ICONS);
  const text = String(name || 'Participante').trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  return keys[Math.abs(hash) % keys.length] || 'lion';
}

function renderDoughnut(rows, tone, hiddenPlayerName = '') {
  if (!rows || !rows.length) return '<div class="empty">Sem dados.</div>';

  const isPlayerRanking = !rows.some(r => r.title.includes(' · '));

  let chartData = [];
  let totalSum = 0;

  if (isPlayerRanking) {
    const groupMap = new Map();
    rows.forEach(row => {
      const num = Math.abs(Number(String(row.value).match(/-?\d+/)?.[0] || 1));
      const cur = groupMap.get(row.title) || { label: row.title, val: 0 };
      cur.val += num;
      totalSum += num;
      groupMap.set(row.title, cur);
    });
    chartData = [...groupMap.values()].sort((a, b) => b.val - a.val);

    const maxSlices = 6;
    if (chartData.length > maxSlices) {
      const topGroups = chartData.slice(0, maxSlices - 1);
      const otherGroups = chartData.slice(maxSlices - 1);
      const otherVal = otherGroups.reduce((sum, g) => sum + g.val, 0);
      topGroups.push({ label: 'Outros', val: otherVal });
      chartData = topGroups;
    }
  } else {
    rows.forEach(row => {
      const num = Math.abs(Number(String(row.value).match(/-?\d+/)?.[0] || 1));
      totalSum += num;

      let label = row.title;
      const parts = row.title.split(' · ');
      if (parts.length >= 3) {
        const hasPlayer = parts[0] === hiddenPlayerName || rows.some(r => r.title.startsWith(parts[0] + ' · '));
        const startIndex = hasPlayer ? 1 : 0;
        const matchPart = parts[startIndex].replace('Jogo ', 'J ');
        label = `${matchPart} · ${parts[startIndex + 1]}`;
      }

      chartData.push({
        label,
        val: num,
        displayVal: row.value
      });
    });
  }

  let colors = [];
  if (tone === 'bad') {
    colors = ['#ef4444', '#f43f5e', '#f97316', '#fb7185', '#fda4af', '#fca5a5', '#ec4899', '#f472b6'];
  } else if (tone === 'good') {
    colors = ['#10b981', '#06b6d4', '#22c55e', '#34d399', '#67e8f9', '#a7f3d0', '#059669', '#0891b2'];
  } else {
    colors = ['#f59e0b', '#fb923c', '#facc15', '#fef08a', '#ffedd5', '#fed7aa', '#d97706', '#b45309'];
  }

  let cumulativePercent = 0;
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 10;
  
  const slicesSvg = chartData.map((slice, i) => {
    const percent = totalSum > 0 ? (slice.val / totalSum) : 0;
    const dashArray = `${percent * circumference} ${circumference}`;
    const dashOffset = -cumulativePercent * circumference;
    cumulativePercent += percent;
    const color = colors[i % colors.length];
    
    return `<circle cx="35" cy="35" r="${radius}" fill="transparent" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}" />`;
  }).join('');

  let displayValue = `${totalSum}`;
  if (tone === 'bad') {
    displayValue = `-${totalSum}`;
  } else if (tone === 'good' && !isPlayerRanking) {
    displayValue = `+${totalSum}`;
  }
  
  const sampleValue = rows[0]?.value || '';
  let suffix = '';
  if (sampleValue.toLowerCase().includes('pts')) {
    suffix = ' Pts';
  } else if (sampleValue.toLowerCase().includes('x')) {
    suffix = 'x';
  }
  
  const centerValue = `${displayValue}${suffix}`;
  const centerLabel = isPlayerRanking ? 'Partilhado' : 'Total';

  const legendHtml = chartData.map((slice, i) => {
    const color = colors[i % colors.length];
    const valText = slice.displayVal || `${slice.val}${suffix}`;
    return `
      <div class="doughnut-legend-item">
        <span class="doughnut-legend-item-label">
          <i class="doughnut-legend-item-dot" style="background:${color}"></i>
          ${escapeHtml(slice.label)}
        </span>
        <span class="doughnut-legend-item-value">${escapeHtml(valText)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="doughnut-chart-container">
      <div class="doughnut-svg-wrap">
        <svg viewBox="0 0 70 70">
          <circle cx="35" cy="35" r="${radius}" fill="transparent" stroke="rgba(255,255,255,0.06)" stroke-width="${strokeWidth}" />
          ${slicesSvg}
        </svg>
        <div class="doughnut-center-text">
          <span class="val">${escapeHtml(centerValue)}</span>
          <span class="lbl">${escapeHtml(centerLabel)}</span>
        </div>
      </div>
      <div class="doughnut-legend">
        ${legendHtml}
      </div>
    </div>
  `;
}
