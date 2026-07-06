import { FILTERS } from './extrair-perfil-stats.js?v=20260629perfil4';

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
            <span style="font-size: 0.7rem; opacity: 0.6; display: block; line-height: 1.2;">Com pontos vs Falhas (0 pts)</span>
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
            <span style="font-size: 0.7rem; opacity: 0.6; display: block; line-height: 1.2;">Com pontos vs Falhas (0 pts)</span>
          </div>
          <span style="font-size: 1.2rem; font-weight: bold; color: #f8fafc; margin-top: 6px;">
            <span style="color: #10b981;">${summary.correctPredictionsCount} certas</span><br><span style="color: #ef4444;">${summary.wrongPredictionsCount} erradas</span>
          </span>
        </div>
      </div>
    </div>
  `;
}

export function renderProfile(profile, activeFilters, chartViews = {}, excludedMatches = new Set()) {
  if (!activeFilters.length) {
    return '<div class="empty">Escolhe uma ou mais opções para gerar o perfil.</div>';
  }

  const selectedPlayer = profile.selectedPlayers.length === 1 ? profile.selectedPlayers[0] : null;
  const sections = activeFilters
    .map((key) => renderSection(key, profile.summaries[key], selectedPlayer?.participantName || '', chartViews, excludedMatches))
    .join('');
  const titleIcon = selectedPlayer ? renderParticipantIcon(selectedPlayer.icon, selectedPlayer.participantName) : '';
    const headerDesc = activeFilters.includes('afterMatch')
      ? 'Recolha de dados após o jogo, para exibir os pontos obtidos.'
      : 'Leitura dos momentos em que os golos mudaram o rumo dos prognósticos.';
    return `
      <header class="profile-head">
        <div>
          <span class="report-kicker">Mundial 2026 · Perfil de prognósticos</span>
          <div class="profile-title">${titleIcon}<h2>${escapeHtml(profile.scopeLabel)}</h2></div>
          <p class="muted">${escapeHtml(headerDesc)}</p>
        </div>
      </header>

    <div class="section-grid">${sections}</div>
  `;
}

export function renderVsProfile(leftProfile, rightProfile, activeFilters, chartViews = {}, excludedMatches = new Set()) {
  if (!activeFilters.length) {
    return '<div class="empty">Escolhe uma ou mais opções para gerar o VS.</div>';
  }

  const sections = activeFilters.map((key) => renderVsSection(key, leftProfile.summaries[key], rightProfile.summaries[key], chartViews, excludedMatches)).join('');
  const leftPlayer = leftProfile.selectedPlayers[0];
  const rightPlayer = rightProfile.selectedPlayers[0];
    const headerDesc = activeFilters.includes('afterMatch')
      ? 'Recolha de dados após o jogo, para exibir os pontos obtidos.'
      : 'Leitura dos momentos em que os golos mudaram o rumo dos prognósticos.';
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
        <p class="muted vs-copy">${escapeHtml(headerDesc)}</p>
      </header>

    <div class="vs-section-grid">${sections}</div>
  `;
}

function renderSection(key, summary, hiddenPlayerName = '', chartViews = {}, excludedMatches = new Set()) {
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
  if (key === 'starsPath') {
    return `
      <article class="stat-card tone-good" style="grid-column: span 2;">
        <h3>
          <span>${escapeHtml(config.title)}</span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        ${renderStarsPathChart(summary)}
      </article>
    `;
  }
  if (key === 'leaderboard') {
    return `
      <article class="stat-card tone-good" style="grid-column: span 2;">
        <h3>
          <span>${escapeHtml(config.title)}</span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        ${renderLeaderboardTable(summary)}
      </article>
    `;
  }
  if (key === 'sequence') {
    return renderSequenceSection(summary, hiddenPlayerName, chartViews, excludedMatches);
  }
  if (key === 'afterMatch') {
    const currentView = chartViews['afterMatch'] || 'podium';
    const btnPodium = `<button class="btn-toggle-chart ${currentView === 'podium' ? 'active' : ''}" data-filter="afterMatch" data-view="podium" type="button" data-html2canvas-ignore="true">🏆 Pódio</button>`;
    const btnBars = `<button class="btn-toggle-chart ${currentView === 'bars' ? 'active' : ''}" data-filter="afterMatch" data-view="bars" type="button" data-html2canvas-ignore="true">📊 Bars</button>`;
    
    const navHtml = `<div class="chart-tab-group" style="display: inline-flex; background: rgba(255, 255, 255, 0.04); padding: 3px; border-radius: 8px; gap: 4px;">
      ${btnPodium}
      ${btnBars}
    </div>`;

    let contentHtml = '';
    if (currentView === 'podium') {
      contentHtml = renderGamePodiumSection(summary);
    } else if (currentView === 'bars') {
      contentHtml = renderAfterMatchBars(summary);
    } else {
      contentHtml = renderGamePodiumSection(summary);
    }

    return `
      <article class="stat-card tone-good" style="grid-column: span 2;">
        <h3>
          <span>After Match</span>
          <span style="display: flex; align-items: center; gap: 8px;">
            ${navHtml}
          </span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        ${contentHtml}
      </article>
    `;
  }
  if (key === 'prediction') {
    const currentView = chartViews['prediction'] || 'table';
    const btnTable = `<button class="btn-toggle-chart ${currentView === 'table' ? 'active' : ''}" data-filter="prediction" data-view="table" type="button" data-html2canvas-ignore="true">📋 Tabela</button>`;
    const btnRadar = `<button class="btn-toggle-chart ${currentView === 'radar' ? 'active' : ''}" data-filter="prediction" data-view="radar" type="button" data-html2canvas-ignore="true">📊 Radar</button>`;
    const btnScatter = `<button class="btn-toggle-chart ${currentView === 'scatter' ? 'active' : ''}" data-filter="prediction" data-view="scatter" type="button" data-html2canvas-ignore="true">🎯 Dispersão</button>`;
    const btnProfile = `<button class="btn-toggle-chart ${currentView === 'profile' ? 'active' : ''}" data-filter="prediction" data-view="profile" type="button" data-html2canvas-ignore="true">👥 Perfil</button>`;
    const btnPitch = `<button class="btn-toggle-chart ${currentView === 'pitch' ? 'active' : ''}" data-filter="prediction" data-view="pitch" type="button" data-html2canvas-ignore="true">🏟️ Relvado</button>`;
    const btnSonar = `<button class="btn-toggle-chart ${currentView === 'sonar' ? 'active' : ''}" data-filter="prediction" data-view="sonar" type="button" data-html2canvas-ignore="true">📡 Sonar</button>`;
    const btnMountain = `<button class="btn-toggle-chart ${currentView === 'mountain' ? 'active' : ''}" data-filter="prediction" data-view="mountain" type="button" data-html2canvas-ignore="true">⛰️ Montanha</button>`;
    const btnBars = `<button class="btn-toggle-chart ${currentView === 'bars' ? 'active' : ''}" data-filter="prediction" data-view="bars" type="button" data-html2canvas-ignore="true">📊 Barras</button>`;
    
    const navHtml = `<div class="chart-tab-group" style="display: inline-flex; background: rgba(255, 255, 255, 0.04); padding: 3px; border-radius: 8px; gap: 4px;">
      ${btnTable}
      ${btnRadar}
      ${btnScatter}
      ${btnProfile}
      ${btnPitch}
      ${btnSonar}
      ${btnMountain}
      ${btnBars}
    </div>`;

    let contentHtml = '';
    if (currentView === 'radar') {
      contentHtml = renderPredictionRadar(summary);
    } else if (currentView === 'scatter') {
      contentHtml = renderPredictionScatter(summary);
    } else if (currentView === 'profile') {
      contentHtml = renderPredictionProfile(summary);
    } else if (currentView === 'pitch') {
      contentHtml = renderPredictionPitch(summary);
    } else if (currentView === 'sonar') {
      contentHtml = renderPredictionSonar(summary);
    } else if (currentView === 'mountain') {
      contentHtml = renderPredictionMountain(summary);
    } else if (currentView === 'bars') {
      contentHtml = renderPredictionBars(summary);
    } else {
      contentHtml = renderPredictionData(summary);
    }

    return `
      <article class="stat-card tone-good" style="grid-column: span 2;">
        <h3>
          <span>Prognóstico</span>
          <span style="display: flex; align-items: center; gap: 8px;">
            ${navHtml}
          </span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        ${contentHtml}
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
    const selectionName = leftSummary?.selectedSelection === 'all' ? 'Todas as Seleções' : leftSummary?.selectedSelection;
    return `
      <article class="stat-card vs-card" style="grid-column: span 2;">
        <h3>
          <span>Seleções: ${escapeHtml(selectionName)}</span>
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
    const stadiumName = leftSummary?.selectedStadium === 'all' ? 'Todos os Estádios' : leftSummary?.selectedStadium;
    return `
      <article class="stat-card vs-card" style="grid-column: span 2;">
        <h3>
          <span>Estádios: ${escapeHtml(stadiumName)}</span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        <div class="vs-columns">
          ${renderVsColumn(leftSummary, 'A', key, false)}
          ${renderVsColumn(rightSummary, 'B', key, false)}
        </div>
      </article>
    `;
  }
  if (key === 'starsPath') {
    return `
      <article class="stat-card vs-card" style="grid-column: span 2;">
        <h3>
          <span>${escapeHtml(config.title)}</span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        ${renderStarsPathChart(leftSummary, rightSummary)}
      </article>
    `;
  }
  if (key === 'leaderboard') {
    return `
      <article class="stat-card vs-card" style="grid-column: span 2;">
        <h3>
          <span>${escapeHtml(config.title)}</span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        ${renderLeaderboardTable(leftSummary)}
      </article>
    `;
  }
  if (key === 'sequence') {
    return `
      <article class="stat-card vs-card" style="grid-column: span 2;">
        <h3>
          <span>Sequência</span>
        </h3>
        <p class="muted">A visualização de Sequência é recomendada apenas para a vista individual de jogador (Perfil).</p>
      </article>
    `;
  }
  if (key === 'afterMatch') {
    const leftPlayerId = leftSummary.predictions?.find(p => p.isSelected)?.player?.id;
    const rightPlayerId = rightSummary.predictions?.find(p => p.isSelected)?.player?.id;
    const currentView = chartViews['afterMatch'] || 'podium';
    const btnPodium = `<button class="btn-toggle-chart ${currentView === 'podium' ? 'active' : ''}" data-filter="afterMatch" data-view="podium" type="button" data-html2canvas-ignore="true">🏆 Pódio</button>`;
    const btnBars = `<button class="btn-toggle-chart ${currentView === 'bars' ? 'active' : ''}" data-filter="afterMatch" data-view="bars" type="button" data-html2canvas-ignore="true">📊 Bars</button>`;
    
    const navHtml = `<div class="chart-tab-group" style="display: inline-flex; background: rgba(255, 255, 255, 0.04); padding: 3px; border-radius: 8px; gap: 4px;">
      ${btnPodium}
      ${btnBars}
    </div>`;

    let contentHtml = '';
    if (currentView === 'podium') {
      contentHtml = renderGamePodiumSection(leftSummary, leftPlayerId, rightPlayerId);
    } else if (currentView === 'bars') {
      contentHtml = renderAfterMatchBars(leftSummary, leftPlayerId, rightPlayerId);
    } else {
      contentHtml = renderGamePodiumSection(leftSummary, leftPlayerId, rightPlayerId);
    }
    return `
      <article class="stat-card vs-card" style="grid-column: span 2;">
        <h3>
          <span>After Match</span>
          <span style="display: flex; align-items: center; gap: 8px;">
            ${navHtml}
          </span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        ${contentHtml}
      </article>
    `;
  }
  if (key === 'prediction') {
    const leftPlayerId = leftSummary.predictions?.find(p => p.isSelected)?.player?.id;
    const rightPlayerId = rightSummary.predictions?.find(p => p.isSelected)?.player?.id;
    
    const combinedPredictions = (leftSummary.predictions || [])
      .filter(p => p.player.id === leftPlayerId || p.player.id === rightPlayerId)
      .map(p => ({
        ...p,
        isSelected: true
      }));
    
    const combinedSummary = {
      ...leftSummary,
      predictions: combinedPredictions
    };
    const currentView = chartViews['prediction'] || 'table';
    const btnTable = `<button class="btn-toggle-chart ${currentView === 'table' ? 'active' : ''}" data-filter="prediction" data-view="table" type="button" data-html2canvas-ignore="true">📋 Tabela</button>`;
    const btnRadar = `<button class="btn-toggle-chart ${currentView === 'radar' ? 'active' : ''}" data-filter="prediction" data-view="radar" type="button" data-html2canvas-ignore="true">📊 Radar</button>`;
    const btnScatter = `<button class="btn-toggle-chart ${currentView === 'scatter' ? 'active' : ''}" data-filter="prediction" data-view="scatter" type="button" data-html2canvas-ignore="true">🎯 Dispersão</button>`;
    const btnProfile = `<button class="btn-toggle-chart ${currentView === 'profile' ? 'active' : ''}" data-filter="prediction" data-view="profile" type="button" data-html2canvas-ignore="true">👥 Perfil</button>`;
    const btnPitch = `<button class="btn-toggle-chart ${currentView === 'pitch' ? 'active' : ''}" data-filter="prediction" data-view="pitch" type="button" data-html2canvas-ignore="true">🏟️ Relvado</button>`;
    const btnSonar = `<button class="btn-toggle-chart ${currentView === 'sonar' ? 'active' : ''}" data-filter="prediction" data-view="sonar" type="button" data-html2canvas-ignore="true">📡 Sonar</button>`;
    const btnMountain = `<button class="btn-toggle-chart ${currentView === 'mountain' ? 'active' : ''}" data-filter="prediction" data-view="mountain" type="button" data-html2canvas-ignore="true">⛰️ Montanha</button>`;
    const btnBars = `<button class="btn-toggle-chart ${currentView === 'bars' ? 'active' : ''}" data-filter="prediction" data-view="bars" type="button" data-html2canvas-ignore="true">📊 Barras</button>`;
    
    const navHtml = `<div class="chart-tab-group" style="display: inline-flex; background: rgba(255, 255, 255, 0.04); padding: 3px; border-radius: 8px; gap: 4px;">
      ${btnTable}
      ${btnRadar}
      ${btnScatter}
      ${btnProfile}
      ${btnPitch}
      ${btnSonar}
      ${btnMountain}
      ${btnBars}
    </div>`;

    let contentHtml = '';
    if (currentView === 'radar') {
      contentHtml = renderPredictionRadar(combinedSummary);
    } else if (currentView === 'scatter') {
      contentHtml = renderPredictionScatter(combinedSummary);
    } else if (currentView === 'profile') {
      contentHtml = renderPredictionProfile(combinedSummary);
    } else if (currentView === 'pitch') {
      contentHtml = renderPredictionPitch(combinedSummary);
    } else if (currentView === 'sonar') {
      contentHtml = renderPredictionSonar(combinedSummary);
    } else if (currentView === 'mountain') {
      contentHtml = renderPredictionMountain(combinedSummary);
    } else if (currentView === 'bars') {
      contentHtml = renderPredictionBars(combinedSummary);
    } else {
      contentHtml = renderPredictionData(combinedSummary);
    }
    return `
      <article class="stat-card vs-card" style="grid-column: span 2;">
        <h3>
          <span>Prognósticos do Jogo</span>
          <span style="display: flex; align-items: center; gap: 8px;">
            ${navHtml}
          </span>
        </h3>
        <p class="muted">${escapeHtml(config.text)}</p>
        ${contentHtml}
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

export function renderStarsPathChart(summary, vsSummary = null) {
  const { playedMatches, selectedIds, allHistories, totalPlayers } = summary;
  if (!playedMatches || playedMatches.length === 0) {
    return '<div class="empty">Nenhum jogo oficial realizado ainda.</div>';
  }

  const activeSelectedIds = new Set(selectedIds);
  if (vsSummary && vsSummary.selectedIds) {
    vsSummary.selectedIds.forEach(id => activeSelectedIds.add(id));
  }

  const width = 900;
  const height = 450;
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 60;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (index) => paddingLeft + (playedMatches.length > 1 ? (index / (playedMatches.length - 1)) * chartWidth : chartWidth / 2);
  const getY = (rank) => paddingTop + (totalPlayers > 1 ? ((rank - 1) / (totalPlayers - 1)) * chartHeight : 0);

  const yTicks = [];
  const tickStep = totalPlayers <= 10 ? 1 : totalPlayers <= 20 ? 2 : 5;
  for (let r = 1; r <= totalPlayers; r++) {
    if (r === 1 || r === totalPlayers || r % tickStep === 0) {
      if (!yTicks.includes(r)) yTicks.push(r);
    }
  }
  yTicks.sort((a, b) => a - b);

  let yAxisHtml = yTicks.map(rank => {
    const y = getY(rank);
    return `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
      <text x="${paddingLeft - 15}" y="${y + 4}" fill="#a9b2c2" font-size="11" text-anchor="end">${rank}º</text>
    `;
  }).join('');

  const labelInterval = Math.max(1, Math.ceil(playedMatches.length / 12));
  let xAxisHtml = playedMatches.map((m, index) => {
    const x = getX(index);
    const showLabel = index === 0 || index === playedMatches.length - 1 || index % labelInterval === 0;
    return `
      <line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${height - paddingBottom}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="2,2" stroke-width="1" />
      ${showLabel ? `
        <text x="${x}" y="${height - paddingBottom + 20}" fill="#a9b2c2" font-size="10" text-anchor="middle" transform="rotate(-30, ${x}, ${height - paddingBottom + 20})">J${m.id}</text>
      ` : ''}
    `;
  }).join('');

  let backgroundLinesHtml = '';
  let foregroundLinesHtml = '';
  let legendHtml = [];

  const colors = ['#38bdf8', '#10b981', '#f59e0b', '#ec4899', '#a855f7', '#f97316', '#06b6d4', '#14b8a6'];
  let colorIndex = 0;

  allHistories.forEach((pHist) => {
    const isSelected = activeSelectedIds.has(pHist.id);
    const points = pHist.history.map((h, idx) => `${getX(idx)},${getY(h.position)}`).join(' ');

    if (!points) return;

    if (isSelected) {
      const color = colors[colorIndex % colors.length];
      colorIndex++;
      const currentPos = pHist.history[pHist.history.length - 1]?.position || '-';
      legendHtml.push(`
        <div style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; background: rgba(255,255,255,0.03); padding: 4px 10px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.06);">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color}; box-shadow: 0 0 6px ${color};"></span>
          <strong>${escapeHtml(pHist.name)}</strong>
          <span class="muted" style="font-size: 0.75rem;">(Atual: ${currentPos}º)</span>
        </div>
      `);

      foregroundLinesHtml += `
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" filter="url(#glow)" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ${pHist.history.map((h, idx) => `
          <circle cx="${getX(idx)}" cy="${getY(h.position)}" r="4.5" fill="#090b10" stroke="${color}" stroke-width="2" class="chart-marker">
            <title>${escapeHtml(pHist.name)}&#10;Jogo ${h.matchId}&#10;Posição: ${h.position}º&#10;Pontos: ${h.accumulated} pts</title>
          </circle>
        `).join('')}
      `;
    } else if (activeSelectedIds.size > 0) {
      backgroundLinesHtml += `
        <polyline points="${points}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      `;
    } else {
      const color = 'rgba(56, 189, 248, 0.2)';
      backgroundLinesHtml += `
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      `;
    }
  });

  return `
    <div class="stars-path-wrapper" style="margin-top: 16px;">
      ${legendHtml.length ? `<div class="stars-path-legend" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">${legendHtml.join('')}</div>` : ''}
      <div class="stars-path-scroll-container" style="overflow-x: auto; width: 100%; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; background: rgba(18,23,34,0.3); padding: 12px 6px;">
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; min-width: 750px; height: auto; display: block;">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g class="grid-y">${yAxisHtml}</g>
          <g class="grid-x">${xAxisHtml}</g>
          <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
          <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
          <g class="background-paths">${backgroundLinesHtml}</g>
          <g class="foreground-paths">${foregroundLinesHtml}</g>
        </svg>
      </div>
    </div>
  `;
}

export function renderSequenceSection(summary, playerName, chartViews, excludedMatches = new Set()) {
  if (!summary || !summary.rows || summary.rows.length === 0) {
    return `
      <article class="stat-card tone-warn" style="grid-column: span 2;">
        <h3><span>Sequência</span></h3>
        <p class="muted">Nenhum jogo oficial realizado ainda para este jogador.</p>
      </article>
    `;
  }

  if (!playerName) {
    return `
      <article class="stat-card tone-warn" style="grid-column: span 2;">
        <h3><span>Sequência de Prognósticos</span></h3>
        <div class="empty" style="padding: 24px; text-align: center;">
          <p>Por favor, selecione um jogador específico no menu de Perfil para visualizar a sequência de prognósticos.</p>
        </div>
      </article>
    `;
  }

  const allRows = summary.rows;
  const visibleRows = allRows.filter(r => !excludedMatches.has(r.matchId));

  const restoreAllBtn = excludedMatches.size > 0 
    ? `<button class="btn-restore-sequence" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;" data-html2canvas-ignore="true">Repor Todos</button>` 
    : '';

  const removeAllBtn = visibleRows.length > 0
    ? `<button class="btn-remove-all-sequence" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;" data-html2canvas-ignore="true">Remover Tudo</button>`
    : '';

  const quickSelectorHtml = `
    <div class="sequence-quick-selector" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); align-items: center;" data-html2canvas-ignore="true">
      <span style="font-size: 0.8rem; color: var(--muted); display: flex; align-items: center; margin-right: 4px;">Selecionar jogos:</span>
      ${allRows.map(r => {
        const isChecked = !excludedMatches.has(r.matchId);
        const bg = isChecked ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)';
        const border = isChecked ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255,255,255,0.06)';
        const color = isChecked ? '#38bdf8' : '#a9b2c2';
        return `
          <button class="btn-toggle-match" data-match-id="${r.matchId}" style="background: ${bg}; border: ${border}; color: ${color}; padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; cursor: pointer; transition: all 0.15s ease;" type="button">
            J${r.matchId}
          </button>
        `;
      }).join('')}
      ${restoreAllBtn}
      ${removeAllBtn}
    </div>
  `;

  const cardsHtml = visibleRows.map(r => {
    let toneClass = 'warn';
    let pointsColor = 'var(--warn)';
    
    if (r.points === 0) {
      toneClass = 'bad';
      pointsColor = 'var(--bad)';
    } else if (r.exact) {
      toneClass = 'good';
      pointsColor = 'var(--good)';
    } else {
      toneClass = 'warn';
      pointsColor = 'var(--warn)';
    }

    const homeTeam = r.match.home || r.match.homeTeam || 'Casa';
    const awayTeam = r.match.away || r.match.awayTeam || 'Fora';
    const stageLabel = {
      groups: 'Grupos',
      round32: '16 avos',
      round16: 'Oitavos',
      quarterfinals: 'Quartos',
      semifinals: 'Meias',
      third_place: '3º Lugar',
      final: 'Final'
    }[r.match.stage] || r.match.stage || 'Jogo';

    const cardBorderColor = r.points === 0 
      ? 'rgba(239, 68, 68, 0.25)' 
      : r.exact 
        ? 'rgba(22, 163, 74, 0.25)' 
        : 'rgba(217, 119, 6, 0.25)';

    const cardBgColor = r.points === 0 
      ? 'rgba(239, 68, 68, 0.04)' 
      : r.exact 
        ? 'rgba(22, 163, 74, 0.04)' 
        : 'rgba(217, 119, 6, 0.04)';

    return `
      <div class="sequence-card tone-${toneClass}" style="position: relative; border-radius: 12px; border: 1px solid ${cardBorderColor}; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; background: ${cardBgColor}; min-width: 140px; flex: 1 1 180px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.15); transition: transform 0.2s ease;">
        <button class="btn-remove-card" data-match-id="${r.matchId}" style="position: absolute; top: 6px; right: 6px; background: transparent; border: none; color: rgba(255,255,255,0.4); font-size: 1.1rem; cursor: pointer; padding: 2px 6px; line-height: 1;" title="Remover este jogo" type="button" data-html2canvas-ignore="true">
          &times;
        </button>
        
        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--muted); opacity: 0.8; margin-bottom: 6px; font-weight: bold; letter-spacing: 0.03em;">
          ${stageLabel} · J${r.matchId}
        </div>
        
        <div style="font-weight: bold; font-size: 0.88rem; display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
          <span style="display: flex; justify-content: space-between; align-items: center;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px;">${escapeHtml(homeTeam)}</span>
            <span style="opacity: 0.8; font-weight: bold; margin-left: 6px;">${r.prediction.homeGoals}</span>
          </span>
          <span style="display: flex; justify-content: space-between; align-items: center;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px;">${escapeHtml(awayTeam)}</span>
            <span style="opacity: 0.8; font-weight: bold; margin-left: 6px;">${r.prediction.awayGoals}</span>
          </span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; font-size: 0.78rem;">
          <div style="opacity: 0.75;">
            Res: <strong style="color: #fff;">${r.official.homeGoals}-${r.official.awayGoals}</strong>
          </div>
          <div style="color: ${pointsColor}; font-weight: 800; font-size: 0.88rem;">
            +${r.points} Pts
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <article class="stat-card tone-warn" style="grid-column: span 2;">
      <h3>
        <span>Sequência de Prognósticos</span>
      </h3>
      <p class="muted">Desempenho obtido jogo a jogo.</p>
      
      ${quickSelectorHtml}
      
      <div class="sequence-cards-container" style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px;">
        ${cardsHtml || '<div class="empty" style="width: 100%; text-align: center; padding: 24px;">Nenhum jogo selecionado para exibição.</div>'}
      </div>
    </article>
  `;
}

function renderPredictionData(summary) {
  if (!summary || !summary.match) return '<div class="empty">Sem dados.</div>';

  const m = summary.match;
  const official = summary.official;
  const home = m.home || m.homeTeam || 'Casa';
  const away = m.away || m.awayTeam || 'Fora';
  const officialScore = official && official.homeGoals != null && official.awayGoals != null
    ? `${official.homeGoals} - ${official.awayGoals}`
    : 'Pendente';

  const stageLabel = {
    groups: 'Fase de grupos',
    round32: '16 avos',
    round16: 'Oitavos',
    quarterfinals: 'Quartos',
    semifinals: 'Meias-finais',
    third_place: '3º Lugar',
    final: 'Final'
  }[m.stage] || m.stage || 'Jogo';

  const predictionsList = summary.predictions || [];
  
  const selectedList = predictionsList.filter(p => p.isSelected);
  const othersList = predictionsList.filter(p => !p.isSelected);

  const renderPredictionRow = (item) => {
    const p = item.prediction;
    const score = item.score;
    const name = item.player.participantName;
    const icon = renderParticipantIcon(item.player.icon, name);
    
    let predText = '-';
    let ptsText = '-';
    let rowStyle = '';
    
    if (p && p.homeGoals != null && p.awayGoals != null) {
      predText = `${p.homeGoals} - ${p.awayGoals}`;
      if (score) {
        ptsText = `+${score.points} Pts`;
        rowStyle = score.exact ? 'color: #facc15;' : (score.points > 0 ? 'color: #34d399;' : 'color: #f87171;');
      } else {
        ptsText = 'Pendente';
        rowStyle = 'color: var(--muted);';
      }
    }
    
    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); height: 42px;">
        <td style="padding: 6px 12px; display: flex; align-items: center; gap: 8px; font-weight: 500;">
          ${icon} <span>${escapeHtml(name)}</span>
        </td>
        <td style="padding: 6px 12px; font-family: monospace; font-size: 1.05rem; font-weight: bold; text-align: center;">
          ${predText}
        </td>
        <td style="padding: 6px 12px; text-align: right; font-weight: bold; ${rowStyle}">
          ${ptsText}
        </td>
      </tr>
    `;
  };

  const selectedRows = selectedList.map(renderPredictionRow).join('');
  const otherRows = othersList.map(renderPredictionRow).join('');

  return `
    <div class="prediction-view-layout" style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px; font-size: 0.95rem;">
      <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Jogo ${m.id} · ${stageLabel}</span>
          <strong style="font-size: 1.25rem;">${escapeHtml(home)} <span style="color: var(--accent);">vs</span> ${escapeHtml(away)}</strong>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Resultado Oficial</span>
          <strong style="font-size: 1.4rem; color: #facc15;">${officialScore}</strong>
        </div>
      </div>
      
      <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; background: rgba(0,0,0,0.15);">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.8rem; text-transform: uppercase; opacity: 0.7; letter-spacing: 0.05em;">
              <th style="padding: 10px 12px;">Jogador</th>
              <th style="padding: 10px 12px; text-align: center;">Prognóstico</th>
              <th style="padding: 10px 12px; text-align: right;">Pontos</th>
            </tr>
          </thead>
          <tbody>
            ${selectedRows ? `
              <tr style="background: rgba(56, 189, 248, 0.06); font-weight: bold; border-bottom: 2px solid rgba(56, 189, 248, 0.2);">
                <td colspan="3" style="padding: 6px 12px; font-size: 0.75rem; text-transform: uppercase; color: var(--accent); letter-spacing: 0.05em;">Selecionado(s)</td>
              </tr>
              ${selectedRows}
            ` : ''}
            
            ${otherRows ? `
              <tr style="background: rgba(255, 255, 255, 0.02); font-weight: bold; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                <td colspan="3" style="padding: 6px 12px; font-size: 0.75rem; text-transform: uppercase; opacity: 0.6; letter-spacing: 0.05em;">Outros Jogadores</td>
              </tr>
              ${otherRows}
            ` : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderLeaderboardTable(summary) {
  if (!summary || !summary.rows || summary.rows.length === 0) {
    return '<div class="empty">Sem dados para a tabela.</div>';
  }

  const hasMovement = summary.rows.some(r => r.movement !== undefined);
  const tieBreakNote = 'Desempate aplicado: pontos, acertados, GM, menos GF e, no limite, ordem alfabética.';
  
  const headers = `
    <thead>
      <tr style="background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.8rem; text-transform: uppercase; opacity: 0.7; letter-spacing: 0.05em;">
        <th style="padding: 10px 12px; width: 60px;">#</th>
        <th style="padding: 10px 12px;">Jogador</th>
        <th style="padding: 10px 12px; text-align: center; width: 90px;">Pontos</th>
        ${summary.includeBw ? '<th style="padding: 10px 12px; text-align: center; width: 50px;" title="Battle Wins">BW</th>' : ''}
        ${summary.includePp ? '<th style="padding: 10px 12px; text-align: center; width: 50px;" title="Prognósticos Pontos">PP</th>' : ''}
        <th style="padding: 10px 12px; text-align: center; width: 40px;" title="Acertados">A</th>
        <th style="padding: 10px 12px; text-align: center; width: 40px;" title="Errados">E</th>
        <th style="padding: 10px 12px; text-align: center; width: 45px;" title="Golos marcados">GM</th>
        <th style="padding: 10px 12px; text-align: center; width: 45px;" title="Golos falhados">GF</th>
        <th style="padding: 10px 12px; text-align: center; width: 40px;" title="Vitórias desfechos certos">V</th>
        <th style="padding: 10px 12px; text-align: center; width: 40px;" title="Empates certos">E</th>
        <th style="padding: 10px 12px; text-align: center; width: 40px;" title="Derrotas desfechos certos">D</th>
      </tr>
    </thead>
  `;
  
  const tbody = summary.rows.map(row => {
    let moveHtml = '';
    if (hasMovement && row.movement !== undefined) {
      if (row.movement > 0) {
        moveHtml = `<span style="color: var(--good); margin-left: 4px; font-size: 0.8rem; font-weight: bold;">▲${row.movement}</span>`;
      } else if (row.movement < 0) {
        moveHtml = `<span style="color: var(--bad); margin-left: 4px; font-size: 0.8rem; font-weight: bold;">▼${Math.abs(row.movement)}</span>`;
      } else {
        moveHtml = `<span style="color: var(--muted); margin-left: 4px; font-size: 0.8rem; font-weight: bold;">•</span>`;
      }
    }
    
    const bwCol = summary.includeBw ? `<td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">${row.battleWins || 0}</td>` : '';
    const ppCol = summary.includePp ? `<td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">${row.matchupPoints || 0}</td>` : '';
    const nameHtml = escapeHtml(row.name);
    const iconHtml = renderParticipantIcon(row.icon, row.name);
    
    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <div style="display: flex; align-items: center; gap: 2px;">
            <strong>${row.rank}</strong>
            ${moveHtml}
          </div>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${iconHtml}
            <span>${nameHtml}</span>
          </div>
        </td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <strong style="color: var(--accent); font-size: 1.05rem;">${row.points}</strong>
          ${summary.includeBw && row.battleBonusPoints ? `<small style="display: block; font-size: 0.72rem; color: var(--gold); font-weight: bold;">+${row.battleBonusPoints} BW</small>` : ''}
        </td>
        ${bwCol}
        ${ppCol}
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">${row.correctPredictions || 0}</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">${row.failedPredictions || 0}</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">${row.goalsHit || 0}</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">${row.goalsMissed || 0}</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">${row.winsHit || 0}</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">${row.drawsHit || 0}</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">${row.lossesHit || 0}</td>
      </tr>
    `;
  }).join('');
  
  return `
    <div style="margin-top: 14px;">
      <div style="overflow-x: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; background: rgba(0,0,0,0.22); padding: 4px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
          ${headers}
          <tbody class="leaderboard-body-rows">
            ${tbody}
          </tbody>
        </table>
      </div>
      <p style="margin: 10px 4px 0; font-size: 0.78rem; color: var(--muted); line-height: 1.45;">${tieBreakNote}</p>
    </div>
  `;
}

function renderPredictionRadar(summary) {
  if (!summary || !summary.match || !summary.predictions || summary.predictions.length === 0) {
    return '<div class="empty">Sem dados para o gráfico radar.</div>';
  }

  const m = summary.match;
  const home = m.home || m.homeTeam || 'Equipa A';
  const away = m.away || m.awayTeam || 'Equipa B';

  // Collect predictions per outcome
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  const playerOutcomes = [];

  (summary.predictions || []).forEach(item => {
    const p = item.prediction;
    if (!p || p.homeGoals == null || p.awayGoals == null) return;
    const h = Number(p.homeGoals);
    const a = Number(p.awayGoals);
    let outcome;
    const diff = Math.abs(h - a);
    if (h > a) {
      outcome = 'home';
      homeWins++;
    } else if (a > h) {
      outcome = 'away';
      awayWins++;
    } else {
      outcome = 'draw';
      draws++;
    }
    playerOutcomes.push({
      name: item.player.participantName,
      icon: item.player.icon,
      outcome,
      diff,
      pred: `${h}-${a}`,
      isSelected: item.isSelected
    });
  });

  const total = homeWins + awayWins + draws;
  if (total === 0) {
    return '<div class="empty">Nenhum prognostico disponivel.</div>';
  }

  const maxVal = Math.max(1, homeWins, awayWins, draws);

  // Standing standalone Radar chart (width 900, height 800)
  const svgWidth = 900;
  const svgHeight = 800;
  const cx = 450;
  const cy = 390;
  const maxR = 210;
  const levels = 5;
  const axes = [
    { label: home, angle: -90, count: homeWins },
    { label: away, angle: 30, count: awayWins },
    { label: 'Empate', angle: 150, count: draws }
  ];

  const toRad = (deg) => (deg * Math.PI) / 180;
  const axisPoint = (axisIdx, radius) => {
    const angle = toRad(axes[axisIdx].angle);
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    };
  };

  // Grid levels (Radar)
  let gridSvg = '';
  for (let lv = 1; lv <= levels; lv++) {
    const r = (lv / levels) * maxR;
    const pts = axes.map((_, i) => {
      const p = axisPoint(i, r);
      return `${p.x},${p.y}`;
    }).join(' ');
    const opacity = lv === levels ? 0.15 : 0.05;
    const width = lv === levels ? 1.5 : 1;
    // Triangular grid
    gridSvg += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="${width}" />`;
    // Circular accent ring
    gridSvg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.02)" stroke-dasharray="3,3" />`;
  }

  // Axis lines (Radar)
  let axisLinesSvg = '';
  axes.forEach((_, i) => {
    const p = axisPoint(i, maxR + 10);
    axisLinesSvg += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-dasharray="4,4" />`;
  });

  // Axis labels with counts (Radar)
  const values = [homeWins, awayWins, draws];
  const axisColors = ['#38bdf8', '#f59e0b', '#10b981'];
  let labelsSvg = '';
  axes.forEach((axis, i) => {
    const labelR = maxR + 25;
    const p = axisPoint(i, labelR);
    const anchor = i === 0 ? 'middle' : (i === 1 ? 'start' : 'end');
    const valPct = total > 0 ? Math.round((values[i] / total) * 100) : 0;
    labelsSvg += `
      <text x="${p.x}" y="${p.y - 8}" fill="${axisColors[i]}" font-size="14" font-weight="800" text-anchor="${anchor}" dominant-baseline="middle" font-family="system-ui, sans-serif">${escapeHtml(axis.label)}</text>
      <text x="${p.x}" y="${p.y + 10}" fill="rgba(255,255,255,0.6)" font-size="11.5" font-weight="600" text-anchor="${anchor}" dominant-baseline="middle" font-family="system-ui, sans-serif">${values[i]} jog. (${valPct}%)</text>
    `;
  });

  // Calculate player coordinates and distribute to left/right sidebars (Radar)
  const outcomeAxisMap = { home: 0, away: 1, draw: 2 };
  
  // First calculate positions for all predictions
  ['home', 'away', 'draw'].forEach(outcome => {
    const axisIdx = outcomeAxisMap[outcome];
    const players = playerOutcomes.filter(p => p.outcome === outcome);
    const color = axisColors[axisIdx];
    const axisAngle = toRad(axes[axisIdx].angle);
    const count = players.length;

    players.forEach((player, idx) => {
      const minFrac = 0.35;
      const maxFrac = 0.90;
      const frac = count === 1
        ? 0.65
        : minFrac + (idx / (count - 1)) * (maxFrac - minFrac);
      const baseR = frac * maxR;

      // Perpendicular offset to spread dots slightly off-axis
      const perpAngle = axisAngle + Math.PI / 2;
      const spreadAmount = count > 1 ? (idx % 2 === 0 ? 1 : -1) * (10 + Math.floor(idx / 2) * 5) : 0;

      const dotX = cx + baseR * Math.cos(axisAngle) + spreadAmount * Math.cos(perpAngle);
      const dotY = cy + baseR * Math.sin(axisAngle) + spreadAmount * Math.sin(perpAngle);

      player.dotX = dotX;
      player.dotY = dotY;
      player.color = color;
    });
  });

  // Distribute players to sidebars
  const leftPlayers = [];
  const rightPlayers = [];

  // Home (top axis) split between left and right sidebar
  const homePlayers = playerOutcomes.filter(p => p.outcome === 'home');
  homePlayers.forEach((player, idx) => {
    if (idx % 2 === 0) {
      leftPlayers.push(player);
    } else {
      rightPlayers.push(player);
    }
  });

  // Draws (bottom-left) go to left sidebar
  playerOutcomes.filter(p => p.outcome === 'draw').forEach(p => leftPlayers.push(p));
  // Away wins (bottom-right) go to right sidebar
  playerOutcomes.filter(p => p.outcome === 'away').forEach(p => rightPlayers.push(p));

  // Sort lists by y-coordinate to prevent connection lines from crossing
  leftPlayers.sort((a, b) => a.dotY - b.dotY);
  rightPlayers.sort((a, b) => a.dotY - b.dotY);

  // Setup sidebar sizes & scales dynamically to fit any number of players
  const maxSidebarCount = Math.max(leftPlayers.length, rightPlayers.length, 1);
  const sidebarHeight = 680; // range from y=60 to y=740
  const spacing = Math.min(24, sidebarHeight / maxSidebarCount);
  const fontSize = Math.min(12, Math.max(9, spacing * 0.45));
  const smallFontSize = fontSize * 0.85;

  const leftStart = cy - ((leftPlayers.length - 1) * spacing) / 2;
  const rightStart = cy - ((rightPlayers.length - 1) * spacing) / 2;

  let playerDotsSvg = '';
  let connectionLinesSvg = '';
  let sidebarTextSvg = '';

  // Draw player dots on the chart
  playerOutcomes.forEach(player => {
    const selectedGlow = player.isSelected ? `filter="url(#selectedGlow)"` : '';
    const dotRadius = player.isSelected ? 7 : 5;
    const strokeW = player.isSelected ? 2.5 : 1.5;
    playerDotsSvg += `
      <circle cx="${player.dotX}" cy="${player.dotY}" r="${dotRadius}" fill="${player.color}" stroke="#0b0f19" stroke-width="${strokeW}" ${selectedGlow}>
        <title>${escapeHtml(player.name)} — ${player.pred}</title>
      </circle>
    `;
  });

  // Draw left sidebar connections and labels (using lineX = 150)
  leftPlayers.forEach((player, idx) => {
    const yText = leftStart + idx * spacing;
    const lineX = 150;
    const color = player.color;
    
    // Smooth bezier curve from text column to player dot on the axis
    const pathD = `M ${lineX} ${yText} C ${lineX + 50} ${yText}, ${player.dotX - 55} ${player.dotY}, ${player.dotX} ${player.dotY}`;
    connectionLinesSvg += `
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.3" />
      <circle cx="${lineX}" cy="${yText}" r="2" fill="${color}" opacity="0.7" />
    `;

    const nameWeight = player.isSelected ? '700' : '500';
    const nameColor = player.isSelected ? '#ffffff' : 'rgba(255,255,255,0.8)';
    sidebarTextSvg += `
      <text x="${lineX - 8}" y="${yText}" fill="${nameColor}" font-size="${fontSize}" font-weight="${nameWeight}" text-anchor="end" dominant-baseline="middle" font-family="system-ui, sans-serif">
        ${escapeHtml(player.name)}
        <tspan fill="${color}" font-weight="700" font-size="${smallFontSize}" font-family="monospace" dx="4">${player.pred}</tspan>
      </text>
    `;
  });

  // Draw right sidebar connections and labels (using lineX = 750)
  rightPlayers.forEach((player, idx) => {
    const yText = rightStart + idx * spacing;
    const lineX = 750;
    const color = player.color;
    
    // Smooth bezier curve from text column to player dot on the axis
    const pathD = `M ${lineX} ${yText} C ${lineX - 50} ${yText}, ${player.dotX + 55} ${player.dotY}, ${player.dotX} ${player.dotY}`;
    connectionLinesSvg += `
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.3" />
      <circle cx="${lineX}" cy="${yText}" r="2" fill="${color}" opacity="0.7" />
    `;

    const nameWeight = player.isSelected ? '700' : '500';
    const nameColor = player.isSelected ? '#ffffff' : 'rgba(255,255,255,0.8)';
    sidebarTextSvg += `
      <text x="${lineX + 8}" y="${yText}" fill="${nameColor}" font-size="${fontSize}" font-weight="${nameWeight}" text-anchor="start" dominant-baseline="middle" font-family="system-ui, sans-serif">
        ${escapeHtml(player.name)}
        <tspan fill="${color}" font-weight="700" font-size="${smallFontSize}" font-family="monospace" dx="4">${player.pred}</tspan>
      </text>
    `;
  });

  // Level value markers on top axis
  let valueLabelsSvg = '';
  for (let lv = 1; lv <= levels; lv++) {
    const val = Math.round((lv / levels) * maxVal);
    const r = (lv / levels) * maxR;
    const p = axisPoint(0, r);
    valueLabelsSvg += `<text x="${p.x + 8}" y="${p.y + 4}" fill="rgba(255,255,255,0.35)" font-size="9.5" font-family="system-ui, sans-serif" text-anchor="start">${val}</text>`;
  }

  // Data polygon outline and glowing shadow
  const dataPoints = values.map((val, i) => {
    const r = (val / maxVal) * maxR;
    const p = axisPoint(i, Math.max(r, 8));
    return `${p.x},${p.y}`;
  }).join(' ');

  const dataSvg = `
    <polygon points="${dataPoints}" fill="url(#radarGradient)" stroke="#38bdf8" stroke-width="2.5" stroke-linejoin="round" />
  `;

  // Polygon vertex indicator dots
  let vertexDotsSvg = '';
  values.forEach((val, i) => {
    const r = (val / maxVal) * maxR;
    const p = axisPoint(i, Math.max(r, 8));
    vertexDotsSvg += `
      <circle cx="${p.x}" cy="${p.y}" r="6" fill="${axisColors[i]}" stroke="#0b0f19" stroke-width="2" />
      <circle cx="${p.x}" cy="${p.y}" r="11" fill="none" stroke="${axisColors[i]}" stroke-width="1" opacity="0.4" />
    `;
  });

  // Summary cards HTML below the chart
  const stageLabel = {
    groups: 'Fase de grupos',
    round32: '16 avos',
    round16: 'Oitavos',
    quarterfinals: 'Quartos',
    semifinals: 'Meias-finais',
    third_place: '3.o Lugar',
    final: 'Final'
  }[m.stage] || m.stage || 'Jogo';

  return `
    <div class="prediction-radar-full" style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px;">

      <div style="background: rgba(255,255,255,0.03); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Jogo ${m.id} · ${escapeHtml(stageLabel)}</span>
          <strong style="font-size: 1.15rem;">${escapeHtml(home)} <span style="color: var(--accent);">vs</span> ${escapeHtml(away)}</strong>
        </div>
        <div style="display: flex; gap: 12px;">
          <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px; padding: 8px 16px; text-align: center;">
            <div style="font-size: 1.4rem; font-weight: 800; color: #38bdf8;">${homeWins}</div>
            <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--muted); margin-top: 1px;">${escapeHtml(home)}</div>
          </div>
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; padding: 8px 16px; text-align: center;">
            <div style="font-size: 1.4rem; font-weight: 800; color: #10b981;">${draws}</div>
            <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--muted); margin-top: 1px;">Empate</div>
          </div>
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 10px; padding: 8px 16px; text-align: center;">
            <div style="font-size: 1.4rem; font-weight: 800; color: #f59e0b;">${awayWins}</div>
            <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--muted); margin-top: 1px;">${escapeHtml(away)}</div>
          </div>
        </div>
      </div>

      <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px; display: flex; justify-content: center; overflow-x: auto;">
        <svg viewBox="0 0 900 800" style="width: 100%; max-width: 900px; height: auto; min-width: 640px; display: block;">
          <defs>
            <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0b0f19" />
              <stop offset="50%" stop-color="#111827" />
              <stop offset="100%" stop-color="#070a10" />
            </linearGradient>
            <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(56, 189, 248, 0.22)" />
              <stop offset="100%" stop-color="rgba(56, 189, 248, 0.01)" />
            </radialGradient>
            <filter id="selectedGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#bgGradient)" rx="14" />
          
          <text x="450" y="60" fill="#ffffff" font-size="14" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif" letter-spacing="0.08em" opacity="0.9">DISTRIBUIÇÃO POR DESFECHO (RADAR)</text>
          
          ${gridSvg}
          ${axisLinesSvg}
          ${valueLabelsSvg}
          ${dataSvg}
          ${vertexDotsSvg}
          ${connectionLinesSvg}
          ${playerDotsSvg}
          ${sidebarTextSvg}
          ${labelsSvg}
          <text x="${cx}" y="${cy + 2}" fill="rgba(255,255,255,0.4)" font-size="11.5" font-weight="600" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif">${total} prog.</text>
        </svg>
      </div>
    </div>
  `;
}

function renderPredictionScatter(summary) {
  if (!summary || !summary.match || !summary.predictions || summary.predictions.length === 0) {
    return '<div class="empty">Sem dados para o gráfico de dispersão.</div>';
  }

  const m = summary.match;
  const home = m.home || m.homeTeam || 'Equipa A';
  const away = m.away || m.awayTeam || 'Equipa B';

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  const scoreCounts = {};

  (summary.predictions || []).forEach(item => {
    const p = item.prediction;
    if (!p || p.homeGoals == null || p.awayGoals == null) return;
    const h = Number(p.homeGoals);
    const a = Number(p.awayGoals);
    if (h > a) homeWins++;
    else if (a > h) awayWins++;
    else draws++;

    const keyH = Math.min(5, h);
    const keyA = Math.min(5, a);
    const key = `${keyH}-${keyA}`;
    if (!scoreCounts[key]) {
      scoreCounts[key] = { h: keyH, a: keyA, count: 0 };
    }
    scoreCounts[key].count++;
  });

  const total = homeWins + awayWins + draws;

  let scatterGridSvg = '';
  // Grid outer border centered at 450
  // startX = 200, endX = 700 (width 500)
  // startY = 170, endY = 670 (height 500)
  scatterGridSvg += `<rect x="200" y="170" width="500" height="500" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1" />`;
  // Diagonal line representing Draws (x = y)
  scatterGridSvg += `<line x1="200" y1="670" x2="700" y2="170" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4,4" />`;

  // Draw vertical grid lines & X-axis labels (Home goals)
  for (let h = 0; h <= 5; h++) {
    const gx = 200 + h * 100;
    scatterGridSvg += `<line x1="${gx}" y1="170" x2="${gx}" y2="670" stroke="rgba(255,255,255,0.06)" stroke-width="1" />`;
    scatterGridSvg += `<text x="${gx}" y="695" fill="rgba(255,255,255,0.5)" font-size="12" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">${h === 5 ? '5+' : h}</text>`;
  }

  // Draw horizontal grid lines & Y-axis labels (Away goals)
  for (let a = 0; a <= 5; a++) {
    const gy = 670 - a * 100;
    scatterGridSvg += `<line x1="200" y1="${gy}" x2="700" y2="${gy}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />`;
    scatterGridSvg += `<text x="175" y="${gy + 4}" fill="rgba(255,255,255,0.5)" font-size="12" font-weight="600" text-anchor="end" dominant-baseline="middle" font-family="system-ui, sans-serif">${a === 5 ? '5+' : a}</text>`;
  }

  // Axis titles
  scatterGridSvg += `
    <text x="450" y="735" fill="#38bdf8" font-size="13" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">Golos ${escapeHtml(home)} (Casa)</text>
    <text x="120" y="420" fill="#f59e0b" font-size="13" font-weight="700" text-anchor="middle" transform="rotate(-90 120 420)" font-family="system-ui, sans-serif">Golos ${escapeHtml(away)} (Fora)</text>
  `;

  // Draw scatter bubbles representing the score counts
  let scatterBubblesSvg = '';
  const scoreKeys = Object.keys(scoreCounts);
  if (scoreKeys.length > 0) {
    const counts = scoreKeys.map(k => scoreCounts[k].count);
    const maxCount = Math.max(...counts, 1);
    
    scoreKeys.forEach(key => {
      const cell = scoreCounts[key];
      const gridX = 200 + cell.h * 100;
      const gridY = 670 - cell.a * 100;
      
      let bubbleColor = '#10b981'; // Green for Draw
      if (cell.h > cell.a) {
        bubbleColor = '#38bdf8'; // Blue for Home Win
      } else if (cell.a > cell.h) {
        bubbleColor = '#f59e0b'; // Orange/Yellow for Away Win
      }
      
      const radius = 15 + (cell.count / maxCount) * 17;
      
      scatterBubblesSvg += `
        <g>
          <circle cx="${gridX}" cy="${gridY}" r="${radius}" fill="${bubbleColor}" fill-opacity="0.8" stroke="#0b0f19" stroke-width="2" />
          <circle cx="${gridX}" cy="${gridY}" r="${radius + 5}" fill="none" stroke="${bubbleColor}" stroke-width="1.5" opacity="0.25" />
          <text x="${gridX}" y="${gridY + 4}" fill="#ffffff" font-size="11.5" font-weight="900" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif">${cell.count}</text>
          <text x="${gridX}" y="${gridY - radius - 5}" fill="#ffffff" font-size="10.5" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">${cell.h}-${cell.a}</text>
        </g>
      `;
    });
  }

  const stageLabel = {
    groups: 'Fase de grupos',
    round32: '16 avos',
    round16: 'Oitavos',
    quarterfinals: 'Quartos',
    semifinals: 'Meias-finais',
    third_place: '3.o Lugar',
    final: 'Final'
  }[m.stage] || m.stage || 'Jogo';

  return `
    <div class="prediction-radar-full" style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px;">
      <div style="background: rgba(255,255,255,0.03); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Jogo ${m.id} · ${escapeHtml(stageLabel)}</span>
          <strong style="font-size: 1.15rem;">${escapeHtml(home)} <span style="color: var(--accent);">vs</span> ${escapeHtml(away)}</strong>
        </div>
        <div style="display: flex; gap: 12px;">
          <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px; padding: 8px 16px; text-align: center;">
            <div style="font-size: 1.4rem; font-weight: 800; color: #38bdf8;">${homeWins}</div>
            <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--muted); margin-top: 1px;">${escapeHtml(home)}</div>
          </div>
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; padding: 8px 16px; text-align: center;">
            <div style="font-size: 1.4rem; font-weight: 800; color: #10b981;">${draws}</div>
            <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--muted); margin-top: 1px;">Empate</div>
          </div>
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 10px; padding: 8px 16px; text-align: center;">
            <div style="font-size: 1.4rem; font-weight: 800; color: #f59e0b;">${awayWins}</div>
            <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--muted); margin-top: 1px;">${escapeHtml(away)}</div>
          </div>
        </div>
      </div>

      <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px; display: flex; justify-content: center; overflow-x: auto;">
        <svg viewBox="0 0 900 800" style="width: 100%; max-width: 900px; height: auto; min-width: 640px; display: block;">
          <defs>
            <linearGradient id="bgGradientScatter" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0b0f19" />
              <stop offset="50%" stop-color="#111827" />
              <stop offset="100%" stop-color="#070a10" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#bgGradientScatter)" rx="14" />
          <text x="450" y="60" fill="#ffffff" font-size="14" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif" letter-spacing="0.08em" opacity="0.9">GRÁFICO DE DISPERSÃO (RESULTADOS)</text>
          
          ${scatterGridSvg}
          ${scatterBubblesSvg}
          
          <text x="450" y="760" fill="rgba(255,255,255,0.4)" font-size="11.5" font-family="system-ui, sans-serif" text-anchor="middle">O tamanho da bolha representa a frequência do resultado</text>
        </svg>
      </div>
    </div>
  `;
}

function getArchetype(h, a) {
  const diff = h - a;
  const total = h + a;
  if (diff > 0) {
    return total >= 3 
      ? { id: 'hero', name: 'O Herói', color: '#f59e0b', desc: 'Vitória em Casa (Aberto, 3+ golos)' }
      : { id: 'sage', name: 'O Sábio', color: '#10b981', desc: 'Vitória em Casa (Fechado, <3 golos)' };
  } else if (diff < 0) {
    return total >= 3 
      ? { id: 'rebel', name: 'O Rebelde', color: '#f43f5e', desc: 'Vitória Fora (Aberto, 3+ golos)' }
      : { id: 'caregiver', name: 'O Cuidador', color: '#a855f7', desc: 'Vitória Fora (Fechado, <3 golos)' };
  } else {
    return total >= 3 
      ? { id: 'open_draw', name: 'Empate Aberto', color: '#38bdf8', desc: 'Empate (Aberto, 3+ golos)' }
      : { id: 'pragmatic', name: 'O Pragmático', color: '#cbd5e1', desc: 'Empate (Fechado, <3 golos)' };
  }
}

function getShortName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastPart = parts[parts.length - 1];
  const lastInitial = lastPart ? lastPart[0] : '';
  return lastInitial ? `${firstName} ${lastInitial}.` : firstName;
}

function renderSvgParticipantIcon(iconKey, label, size = 26) {
  const key = normalizeIconKey(iconKey) || autoIconKeyFromName(label);
  const meta = PLAYER_ICONS[key];
  const radius = size / 2;
  if (!meta) {
    const initials = String(label || '?').split(/\s+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase();
    return `
      <g>
        <circle cx="${radius}" cy="${radius}" r="${radius}" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
        <text x="${radius}" y="${radius + 3}" fill="#ffffff" font-size="${size * 0.45}" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">${escapeHtml(initials)}</text>
      </g>
    `;
  }
  const gradientId = `svg-profile-icon-${escapeHtml(key)}`;
  return `
    <g>
      <defs>
        <linearGradient id="${gradientId}" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${meta.bg1}"/>
          <stop offset="100%" stop-color="${meta.bg2}"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.28}" fill="url(#${gradientId})"/>
      <circle cx="${radius}" cy="${radius}" r="${radius * 0.74}" fill="rgba(255,255,255,.08)"/>
      <g fill="none" stroke="#f8fbff" stroke-width="${3.4 * (size / 84)}" stroke-linecap="round" stroke-linejoin="round" transform="scale(${size / 84})">
        ${meta.glyph}
      </g>
    </g>
  `;
}

function renderPredictionProfile(summary) {
  if (!summary || !summary.match || !summary.predictions || summary.predictions.length === 0) {
    return '<div class="empty">Sem dados para o gráfico de perfil.</div>';
  }

  const m = summary.match;
  const home = m.home || m.homeTeam || 'Equipa A';
  const away = m.away || m.awayTeam || 'Equipa B';

  const predictions = summary.predictions || [];

  const groups = {
    hero: { id: 'hero', name: 'O Herói', color: '#f59e0b', gradient: '#heroGrad', desc: 'Vitória em Casa (3+ golos totais)', players: [] },
    rebel: { id: 'rebel', name: 'O Rebelde', color: '#f43f5e', gradient: '#rebelGrad', desc: 'Vitória Fora (3+ golos totais)', players: [] },
    sage: { id: 'sage', name: 'O Sábio', color: '#10b981', gradient: '#sageGrad', desc: 'Vitória em Casa (<3 golos totais)', players: [] },
    caregiver: { id: 'caregiver', name: 'O Cuidador', color: '#a855f7', gradient: '#caregiverGrad', desc: 'Vitória Fora (<3 golos totais)', players: [] },
    open_draw: { id: 'open_draw', name: 'Empate Aberto', color: '#38bdf8', gradient: '#openDrawGrad', desc: 'Empate com golos (3+ golos)', players: [] },
    pragmatic: { id: 'pragmatic', name: 'O Pragmático', color: '#cbd5e1', gradient: '#pragmaticGrad', desc: 'Empate sem golos ou 1-1 (<3 golos)', players: [] }
  };

  const cx = 450;
  const cy = 410;
  const startX = 170;
  const endX = 730;
  const bottomY = 650;
  const stepX = 70;
  const stepY = 80;

  const coordCounts = {};

  predictions.forEach(item => {
    const p = item.prediction;
    if (!p || p.homeGoals == null || p.awayGoals == null) return;
    const h = Number(p.homeGoals);
    const a = Number(p.awayGoals);
    
    const arch = getArchetype(h, a);
    groups[arch.id].players.push(item);

    const diff = h - a;
    const totalG = h + a;

    let bx = cx;
    if (diff < 0) {
      if (diff === -1) bx = 415 - 50;
      else if (diff === -2) bx = 415 - 110;
      else if (diff === -3) bx = 415 - 170;
      else bx = 415 - 230;
    } else if (diff > 0) {
      if (diff === 1) bx = 485 + 50;
      else if (diff === 2) bx = 485 + 110;
      else if (diff === 3) bx = 485 + 170;
      else bx = 485 + 230;
    }

    let by = cy;
    if (totalG === 0) by = 650 - 30;
    else if (totalG === 1) by = 650 - 75;
    else if (totalG === 2) by = 650 - 120;
    else if (totalG === 3) by = 425 - 35;
    else if (totalG === 4) by = 425 - 90;
    else if (totalG === 5) by = 425 - 145;
    else by = 425 - 200;

    const coordKey = `${h}-${a}`;
    if (!coordCounts[coordKey]) {
      coordCounts[coordKey] = 0;
    }
    const index = coordCounts[coordKey]++;
    
    let x = bx;
    let y = by;
    if (index > 0) {
      const angle = (index * 72 * Math.PI) / 180;
      const radius = 28 + Math.floor((index - 1) / 5) * 22;
      x = bx + radius * Math.cos(angle);
      y = by + radius * Math.sin(angle);
    }

    item.plotX = x;
    item.plotY = y;
    item.archetypeColor = arch.color;
    item.predStr = `${h}-${a}`;
  });

  let dotsAndLabelsSvg = '';
  predictions.forEach(item => {
    if (item.plotX == null) return;
    const isSelected = item.isSelected;
    const size = 24;
    const glow = isSelected ? `filter="url(#selectedGlow)"` : '';
    
    const shortName = getShortName(item.player.participantName);
    const labelWidth = shortName.length * 6.2 + 8;
    const labelX = item.plotX - labelWidth / 2;
    const labelY = item.plotY + 15;

    let selectedRing = '';
    if (isSelected) {
      selectedRing = `
        <rect x="${item.plotX - 15}" y="${item.plotY - 15}" width="30" height="30" rx="9" fill="none" stroke="${item.archetypeColor}" stroke-width="2.5" ${glow} />
        <circle cx="${item.plotX}" cy="${item.plotY}" r="${size}" fill="none" stroke="${item.archetypeColor}" stroke-width="1.5" opacity="0.4" />
      `;
    }
    
    dotsAndLabelsSvg += `
      <g style="cursor: pointer;">
        ${selectedRing}
        <!-- Avatar -->
        <g transform="translate(${item.plotX - 12}, ${item.plotY - 12})">
          ${renderSvgParticipantIcon(item.player.icon, item.player.participantName, size)}
        </g>
        <title>${escapeHtml(item.player.participantName)}: ${item.predStr}</title>
        
        <!-- Compact Name Label Capsule -->
        <rect x="${labelX}" y="${labelY}" width="${labelWidth}" height="14" rx="3.5" fill="rgba(11, 15, 25, 0.85)" stroke="${isSelected ? item.archetypeColor : 'rgba(255,255,255,0.18)'}" stroke-width="${isSelected ? 1 : 0.6}" />
        <text x="${item.plotX}" y="${labelY + 10}" fill="#ffffff" font-size="8.8" font-weight="${isSelected ? '900' : '700'}" text-anchor="middle" font-family="system-ui, sans-serif">${escapeHtml(shortName)}</text>
      </g>
    `;
  });

  const cardsHtml = Object.values(groups).map(g => {
    const activeClass = g.players.length > 0 ? '' : 'opacity: 0.35;';
    const borderStyle = `border-top: 4px solid ${g.color};`;
    
    const playersList = g.players.map(p => {
      const isSelected = p.isSelected;
      const highlightBg = isSelected ? 'background: rgba(255,255,255,0.08); border-radius: 6px;' : '';
      const icon = renderParticipantIcon(p.player.icon, p.player.participantName);
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; font-size: 0.82rem; ${highlightBg}">
          <div style="display: flex; align-items: center; gap: 6px;">
            ${icon}
            <span style="${isSelected ? 'font-weight: 700; color: #fff;' : 'color: rgba(255,255,255,0.7);'}">${escapeHtml(p.player.participantName)}</span>
          </div>
          <span style="font-family: monospace; font-weight: 700; color: ${g.color};">${p.predStr}</span>
        </div>
      `;
    }).join('') || '<div style="font-size: 0.78rem; color: rgba(255,255,255,0.35); font-style: italic; padding: 4px 6px;">Nenhum jogador</div>';

    return `
      <div class="archetype-legend-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; ${borderStyle} ${activeClass}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: ${g.color};">${g.name}</h4>
          <span style="background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; color: ${g.color};">${g.players.length}</span>
        </div>
        <p style="margin: 0; font-size: 0.75rem; color: rgba(255,255,255,0.6); line-height: 1.35;">${g.desc}</p>
        <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 2px;">
          ${playersList}
        </div>
      </div>
    `;
  }).join('');

  const stageLabel = {
    groups: 'Fase de grupos',
    round32: '16 avos',
    round16: 'Oitavos',
    quarterfinals: 'Quartos',
    semifinals: 'Meias-finais',
    third_place: '3.o Lugar',
    final: 'Final'
  }[m.stage] || m.stage || 'Jogo';

  return `
    <div class="prediction-radar-full" style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px;">

      <div style="background: rgba(255,255,255,0.03); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Jogo ${m.id} · ${escapeHtml(stageLabel)}</span>
          <strong style="font-size: 1.15rem;">${escapeHtml(home)} <span style="color: var(--accent);">vs</span> ${escapeHtml(away)}</strong>
        </div>
        <div style="background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; color: rgba(255,255,255,0.85); font-weight: 600;">
          Perfil de Prognósticos (${predictions.length} participações)
        </div>
      </div>

      <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px; display: flex; justify-content: center; overflow-x: auto;">
        <svg viewBox="0 0 900 800" style="width: 100%; max-width: 900px; height: auto; min-width: 640px; display: block;">
          <defs>
            <linearGradient id="bgGradientProfile" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0b0f19" />
              <stop offset="50%" stop-color="#111827" />
              <stop offset="100%" stop-color="#070a10" />
            </linearGradient>
            
            <linearGradient id="rebelGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.16" />
              <stop offset="100%" stop-color="#fda4af" stop-opacity="0.01" />
            </linearGradient>
            <linearGradient id="caregiverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#a855f7" stop-opacity="0.16" />
              <stop offset="100%" stop-color="#c084fc" stop-opacity="0.01" />
            </linearGradient>
            <linearGradient id="heroGrad" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.16" />
              <stop offset="100%" stop-color="#fde047" stop-opacity="0.01" />
            </linearGradient>
            <linearGradient id="sageGrad" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#10b981" stop-opacity="0.16" />
              <stop offset="100%" stop-color="#6ee7b7" stop-opacity="0.01" />
            </linearGradient>
            <linearGradient id="openDrawGrad" x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.16" />
              <stop offset="100%" stop-color="#7dd3fc" stop-opacity="0.01" />
            </linearGradient>
            <linearGradient id="pragmaticGrad" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stop-color="#64748b" stop-opacity="0.16" />
              <stop offset="100%" stop-color="#cbd5e1" stop-opacity="0.01" />
            </linearGradient>

            <filter id="selectedGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#bgGradientProfile)" rx="14" />
          
          <text x="450" y="60" fill="#ffffff" font-size="14" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif" letter-spacing="0.08em" opacity="0.9">COORDENADAS DE PERFIL DE PROGNÓSTICO</text>

          <!-- Quadrant background fills -->
          <path d="M 170 170 L 415 170 L 415 425 L 170 425 Z" fill="url(#rebelGrad)" />
          <path d="M 170 425 L 415 425 L 415 650 L 170 650 Z" fill="url(#caregiverGrad)" />
          <path d="M 485 170 L 730 170 L 730 425 L 485 425 Z" fill="url(#heroGrad)" />
          <path d="M 485 425 L 730 425 L 730 650 L 485 650 Z" fill="url(#sageGrad)" />
          <path d="M 415 170 L 485 170 L 485 425 L 415 425 Z" fill="url(#openDrawGrad)" />
          <path d="M 415 425 L 485 425 L 485 650 L 415 650 Z" fill="url(#pragmaticGrad)" />

          <!-- Archetype Names inside Chart -->
          <text x="292" y="300" fill="#f43f5e" opacity="0.45" font-size="20" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif" letter-spacing="0.05em">O REBELDE</text>
          <text x="292" y="550" fill="#a855f7" opacity="0.45" font-size="20" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif" letter-spacing="0.05em">O CUIDADOR</text>
          <text x="607" y="300" fill="#f59e0b" opacity="0.45" font-size="20" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif" letter-spacing="0.05em">O HERÓI</text>
          <text x="607" y="550" fill="#10b981" opacity="0.45" font-size="20" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif" letter-spacing="0.05em">O SÁBIO</text>
          <text x="450" y="300" fill="#38bdf8" opacity="0.45" font-size="12" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif" letter-spacing="0.03em">EMPATE ABERTO</text>
          <text x="450" y="550" fill="#cbd5e1" opacity="0.45" font-size="11" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif" letter-spacing="0.03em">O PRAGMÁTICO</text>

          <!-- Axes lines -->
          <line x1="${startX}" y1="425" x2="${endX}" y2="425" stroke="rgba(255,255,255,0.25)" stroke-width="2" />
          <line x1="${cx}" y1="170" x2="${cx}" y2="650" stroke="rgba(255,255,255,0.25)" stroke-width="2" />

          <!-- X axis step markers (dashed lines) -->
          <line x1="${cx - stepX}" y1="170" x2="${cx - stepX}" y2="650" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          <line x1="${cx - 2*stepX}" y1="170" x2="${cx - 2*stepX}" y2="650" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          <line x1="${cx - 3*stepX}" y1="170" x2="${cx - 3*stepX}" y2="650" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          <line x1="${cx + stepX}" y1="170" x2="${cx + stepX}" y2="650" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          <line x1="${cx + 2*stepX}" y1="170" x2="${cx + 2*stepX}" y2="650" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          <line x1="${cx + 3*stepX}" y1="170" x2="${cx + 3*stepX}" y2="650" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          
          <!-- Y axis step markers (dashed lines) -->
          <line x1="${startX}" y1="${bottomY - 1*stepY}" x2="${endX}" y2="${bottomY - 1*stepY}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          <line x1="${startX}" y1="${bottomY - 2*stepY}" x2="${endX}" y2="${bottomY - 2*stepY}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          <line x1="${startX}" y1="${bottomY - 3*stepY}" x2="${endX}" y2="${bottomY - 3*stepY}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          <line x1="${startX}" y1="${bottomY - 4*stepY}" x2="${endX}" y2="${bottomY - 4*stepY}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
          <line x1="${startX}" y1="${bottomY - 5*stepY}" x2="${endX}" y2="${bottomY - 5*stepY}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />

          <!-- Axis Labels (X axis) -->
          <text x="${cx}" y="670" fill="rgba(255,255,255,0.6)" font-size="11" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">Empate</text>
          <text x="${cx + 2*stepX}" y="670" fill="#38bdf8" font-size="11" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">Ganha ${escapeHtml(home)}</text>
          <text x="${cx - 2*stepX}" y="670" fill="#f59e0b" font-size="11" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">Ganha ${escapeHtml(away)}</text>

          <!-- Axis Labels (Y axis) -->
          <text x="150" y="428" fill="rgba(255,255,255,0.6)" font-size="11" font-weight="600" text-anchor="end" font-family="system-ui, sans-serif">Equilíbrio (2-3 golos)</text>
          <text x="150" y="200" fill="rgba(255,255,255,0.6)" font-size="11" font-weight="600" text-anchor="end" font-family="system-ui, sans-serif">Muitos golos (6+)</text>
          <text x="150" y="654" fill="rgba(255,255,255,0.6)" font-size="11" font-weight="600" text-anchor="end" font-family="system-ui, sans-serif">Poucos golos (0-1)</text>

          <text x="450" y="150" fill="rgba(255,255,255,0.3)" font-size="10" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">▲ OFENSIVO</text>
          <text x="450" y="690" fill="rgba(255,255,255,0.3)" font-size="10" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">▼ DEFENSIVO</text>

          ${dotsAndLabelsSvg}

        </svg>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 6px;">
        ${cardsHtml}
      </div>
    </div>
  `;
}

function renderPredictionPitch(summary) {
  if (!summary || !summary.match || !summary.predictions || summary.predictions.length === 0) {
    return '<div class="empty">Sem dados para o relvado.</div>';
  }

  const m = summary.match;
  const homeTeam = m.home || m.homeTeam || 'Equipa A';
  const awayTeam = m.away || m.awayTeam || 'Equipa B';

  const predictions = summary.predictions || [];

  const leftPlayers = [];
  const rightPlayers = [];
  const centerPlayers = [];

  const isSameTeam = (name1, name2) => {
    if (!name1 || !name2) return false;
    return name1.toLowerCase().trim() === name2.toLowerCase().trim();
  };

  predictions.forEach(item => {
    const p = item.prediction;
    if (!p || p.homeGoals == null || p.awayGoals == null) return;
    const h = Number(p.homeGoals);
    const a = Number(p.awayGoals);

    const isHomeWinner = (h > a) || (h === a && p.winnerTeam && isSameTeam(p.winnerTeam, homeTeam));
    const isAwayWinner = (a > h) || (h === a && p.winnerTeam && isSameTeam(p.winnerTeam, awayTeam));

    if (isHomeWinner) {
      leftPlayers.push(item);
    } else if (isAwayWinner) {
      rightPlayers.push(item);
    } else {
      centerPlayers.push(item);
    }
  });

  const formatPitchPredictionText = (p) => {
    if (!p) return '';
    const h = p.homeGoals;
    const a = p.awayGoals;
    let text = `${h}-${a}`;
    if (h === a && p.winnerTeam && p.winnerTeam !== 'Empate') {
      const methodLabel = p.method === 'et' ? '(prolongamento)' : p.method === 'pens' ? '(penáltis)' : '';
      text += `\n${p.winnerTeam}\n${methodLabel}`;
    } else if (p.method === 'et' || p.method === 'pens') {
      const methodLabel = p.method === 'et' ? '(prolongamento)' : '(penáltis)';
      text += `\n${methodLabel}`;
    }
    return text.trim();
  };

  const getFlagHtml = (teamName) => {
    const url = summary.flags?.[teamName.toLowerCase().trim()];
    if (url) {
      return `<img src="${url}" alt="${escapeHtml(teamName)}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; vertical-align: middle; box-shadow: 0 2px 4px rgba(0,0,0,0.4); border: 1.5px solid rgba(255,255,255,0.7);" />`;
    }
    return `<span style="width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.15); display: inline-flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; border: 1.5px solid rgba(255,255,255,0.4); vertical-align: middle;">${teamName.substring(0, 2).toUpperCase()}</span>`;
  };

  const renderCard = (item) => {
    const isSelected = item.isSelected;
    const name = item.player.participantName;
    const shortName = getShortName(name);
    const predText = formatPitchPredictionText(item.prediction);
    const borderStyle = isSelected ? 'border: 2px solid var(--accent); background: rgba(56, 189, 248, 0.25);' : 'border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(0, 0, 0, 0.45);';
    const nameWeight = isSelected ? '900' : '700';

    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; ${borderStyle} border-radius: 8px; padding: 6px 8px; width: 105px; text-align: center; color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.25); transform: translateZ(0); flex-shrink: 0;">
        <div style="width: 26px; height: 26px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05);">
          ${renderSvgParticipantIcon(item.player.icon, name, 26)}
        </div>
        <div style="font-size: 0.72rem; font-weight: ${nameWeight}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center;" title="${escapeHtml(name)}">
          ${escapeHtml(shortName)}
        </div>
        <div style="font-size: 0.68rem; font-weight: 600; opacity: 0.95; line-height: 1.1; white-space: pre-wrap; font-family: monospace; text-align: center; width: 100%;">
          ${escapeHtml(predText)}
        </div>
      </div>
    `;
  };

  const leftCardsHtml = leftPlayers.map(renderCard).join('') || '<div style="font-size: 0.8rem; opacity: 0.5; font-style: italic; color: #fff;">Nenhum</div>';
  const centerCardsHtml = centerPlayers.map(renderCard).join('') || '<div style="font-size: 0.8rem; opacity: 0.5; font-style: italic; color: #fff;">Nenhum</div>';
  const rightCardsHtml = rightPlayers.map(renderCard).join('') || '<div style="font-size: 0.8rem; opacity: 0.5; font-style: italic; color: #fff;">Nenhum</div>';

  const stageLabel = {
    groups: 'Fase de grupos',
    round32: '16 avos',
    round16: 'Oitavos',
    quarterfinals: 'Quartos',
    semifinals: 'Meias-finais',
    third_place: '3.o Lugar',
    final: 'Final'
  }[m.stage] || m.stage || 'Jogo';

  return `
    <div class="prediction-radar-full" style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px;">
      <div style="background: rgba(255,255,255,0.03); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Jogo ${m.id} · ${escapeHtml(stageLabel)}</span>
          <strong style="font-size: 1.15rem;">${escapeHtml(homeTeam)} <span style="color: var(--accent);">vs</span> ${escapeHtml(awayTeam)}</strong>
        </div>
        <div style="background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; color: rgba(255,255,255,0.85); font-weight: 600;">
          Relvado de Prognósticos (${predictions.length} participações)
        </div>
      </div>

      <div class="soccer-pitch" style="position: relative; width: 100%; min-height: 520px; height: auto; background: radial-gradient(circle, #2d7a43 40%, #1c522b 100%); border: 3px solid rgba(255,255,255,0.4); border-radius: 12px; display: flex; box-shadow: inset 0 0 50px rgba(0,0,0,0.6); overflow: hidden; padding: 25px 15px; gap: 10px; z-index: 1;">
        
        <!-- Marcador do Relvado (Soccer Field Markings) -->
        <!-- Linha do meio campo -->
        <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: rgba(255,255,255,0.25); transform: translateX(-50%); pointer-events: none; z-index: 1;"></div>
        <!-- Círculo central -->
        <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 140px; height: 140px; border: 2px solid rgba(255,255,255,0.25); border-radius: 50%; pointer-events: none; z-index: 1;"></div>
        <!-- Grande área esquerda -->
        <div style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 90px; height: 260px; border: 2px solid rgba(255,255,255,0.25); border-left: none; pointer-events: none; z-index: 1;"></div>
        <!-- Pequena área esquerda -->
        <div style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 30px; height: 110px; border: 2px solid rgba(255,255,255,0.2); border-left: none; pointer-events: none; z-index: 1;"></div>
        <!-- Grande área direita -->
        <div style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 90px; height: 260px; border: 2px solid rgba(255,255,255,0.25); border-right: none; pointer-events: none; z-index: 1;"></div>
        <!-- Pequena área direita -->
        <div style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 30px; height: 110px; border: 2px solid rgba(255,255,255,0.2); border-right: none; pointer-events: none; z-index: 1;"></div>
        <!-- Baliza esquerda -->
        <div style="position: absolute; left: -6px; top: 50%; transform: translateY(-50%); width: 6px; height: 70px; border: 2px solid rgba(255,255,255,0.3); border-left: none; pointer-events: none; z-index: 1;"></div>
        <!-- Baliza direita -->
        <div style="position: absolute; right: -6px; top: 50%; transform: translateY(-50%); width: 6px; height: 70px; border: 2px solid rgba(255,255,255,0.3); border-right: none; pointer-events: none; z-index: 1;"></div>

        <!-- Equipa A (Esquerda) -->
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 2; min-width: 0;">
          <div style="text-align: center; margin-bottom: 20px; font-weight: 800; font-size: 1.15rem; color: #fff; text-shadow: 0 2px 5px rgba(0,0,0,0.8); background: rgba(0,0,0,0.3); padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); width: fit-content; display: inline-flex; align-items: center; gap: 8px;">
            ${getFlagHtml(homeTeam)} <span>${escapeHtml(homeTeam)}</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-content: flex-start; width: 100%;">
            ${leftCardsHtml}
          </div>
        </div>

        <!-- Empate (Centro) -->
        <div style="width: 170px; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 2; flex-shrink: 0; padding: 0 5px;">
          <div style="text-align: center; margin-bottom: 20px; font-weight: 800; font-size: 1.15rem; color: #dbeafe; text-shadow: 0 2px 5px rgba(0,0,0,0.8); background: rgba(0,0,0,0.3); padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); width: fit-content; display: inline-flex; align-items: center; gap: 8px;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));"><path d="m11 17 2 2a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0L13 13M8 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3M19 14h2a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3"/></svg>
            <span>Empate</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-content: flex-start; width: 100%;">
            ${centerCardsHtml}
          </div>
        </div>

        <!-- Equipa B (Direita) -->
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 2; min-width: 0;">
          <div style="text-align: center; margin-bottom: 20px; font-weight: 800; font-size: 1.15rem; color: #fff; text-shadow: 0 2px 5px rgba(0,0,0,0.8); background: rgba(0,0,0,0.3); padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); width: fit-content; display: inline-flex; align-items: center; gap: 8px;">
            <span>${escapeHtml(awayTeam)}</span> ${getFlagHtml(awayTeam)}
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-content: flex-start; width: 100%;">
            ${rightCardsHtml}
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderPredictionSonar(summary) {
  if (!summary || !summary.match || !summary.predictions || summary.predictions.length === 0) {
    return '<div class="empty">Sem dados para o sonar.</div>';
  }

  const m = summary.match;
  const homeTeam = m.home || m.homeTeam || 'Equipa A';
  const awayTeam = m.away || m.awayTeam || 'Equipa B';
  const predictions = summary.predictions || [];

  const scoreGroups = {};
  predictions.forEach(item => {
    const p = item.prediction;
    if (!p || p.homeGoals == null || p.awayGoals == null) return;
    const score = `${p.homeGoals}-${p.awayGoals}`;
    if (!scoreGroups[score]) {
      scoreGroups[score] = [];
    }
    scoreGroups[score].push(item);
  });

  const uniqueScores = Object.keys(scoreGroups).sort((a, b) => {
    return scoreGroups[b].length - scoreGroups[a].length;
  });

  if (uniqueScores.length === 0) {
    return '<div class="empty">Nenhum prognóstico disponível para o sonar.</div>';
  }

  const stageLabel = {
    groups: 'Fase de grupos',
    round32: '16 avos',
    round16: 'Oitavos',
    quarterfinals: 'Quartos',
    semifinals: 'Meias-finais',
    third_place: '3.o Lugar',
    final: 'Final'
  }[m.stage] || m.stage || 'Jogo';

  const svgWidth = 900;
  const svgHeight = 750;
  const cx = svgWidth / 2;
  const cy = svgHeight / 2 - 20;

  const ringCount = uniqueScores.length;
  const minR = 90;
  const ringSpacing = Math.min(65, (svgHeight / 2 - 120) / ringCount);

  let circlesSvg = '';
  let itemsSvg = '';
  let labelsSvg = '';

  circlesSvg += `
    <radialGradient id="sonarGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0" />
      <stop offset="80%" stop-color="#0f172a" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.6" />
    </radialGradient>
    <circle cx="${cx}" cy="${cy}" r="${minR + ringCount * ringSpacing + 20}" fill="url(#sonarGlow)" />
  `;

  for (let angleDeg = 0; angleDeg < 360; angleDeg += 45) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const maxR = minR + ringCount * ringSpacing;
    const x2 = cx + maxR * Math.cos(angleRad);
    const y2 = cy + maxR * Math.sin(angleRad);
    circlesSvg += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3,3" />`;
  }

  circlesSvg += `
    <circle cx="${cx}" cy="${cy}" r="65" fill="#0f172a" stroke="rgba(56, 189, 248, 0.4)" stroke-width="2" />
    <circle cx="${cx}" cy="${cy}" r="65" fill="none" stroke="rgba(56, 189, 248, 0.2)" stroke-width="6" stroke-dasharray="8,6" />
  `;

  const shortHome = homeTeam.substring(0, 3).toUpperCase();
  const shortAway = awayTeam.substring(0, 3).toUpperCase();
  circlesSvg += `
    <text x="${cx}" y="${cy - 12}" fill="rgba(255,255,255,0.6)" font-size="10" font-weight="800" text-anchor="middle" font-family="Inter, system-ui, sans-serif">VS</text>
    <text x="${cx}" y="${cy + 8}" fill="#fff" font-size="14" font-weight="900" text-anchor="middle" font-family="Inter, system-ui, sans-serif">${shortHome} - ${shortAway}</text>
    <text x="${cx}" y="${cy + 24}" fill="var(--accent)" font-size="10" font-weight="700" text-anchor="middle" font-family="Inter, system-ui, sans-serif">${predictions.length} prog.</text>
  `;

  uniqueScores.forEach((score, index) => {
    const r = minR + (index + 1) * ringSpacing;
    const group = scoreGroups[score];
    const color = index === 0 ? 'rgba(56, 189, 248, 0.7)' : index === 1 ? 'rgba(245, 196, 81, 0.6)' : index === 2 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(255, 255, 255, 0.35)';
    const strokeWidth = index === 0 ? 2 : 1.2;

    circlesSvg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${index % 2 === 0 ? 'none' : '4,4'}" opacity="0.65" />`;

    const badgeW = 46;
    const badgeH = 20;
    const bx = cx - badgeW / 2;
    const by = cy - r - badgeH / 2;

    labelsSvg += `
      <g>
        <rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}" rx="6" fill="#1e293b" stroke="${color}" stroke-width="1.5" />
        <text x="${cx}" y="${cy - r + 4}" fill="#fff" font-size="10" font-weight="900" text-anchor="middle" font-family="monospace">${score}</text>
      </g>
    `;

    const getPredictionDetailText = (p) => {
      if (!p) return '';
      if (p.method === 'et' || p.method === 'pens') {
        const methodLabel = p.method === 'et' ? 'Pr.' : 'Pen.';
        if (p.winnerTeam && p.winnerTeam !== 'Empate' && p.homeGoals === p.awayGoals) {
          return `(${methodLabel} - ${p.winnerTeam.substring(0, 3).toUpperCase()})`;
        }
        return `(${methodLabel})`;
      }
      return '';
    };

    const formatFullPrediction = (p) => {
      if (!p) return '';
      const h = p.homeGoals;
      const a = p.awayGoals;
      let text = `${h}-${a}`;
      if (p.method === 'et' || p.method === 'pens') {
        const methodLabel = p.method === 'et' ? 'Prolongamento' : 'Penáltis';
        if (p.winnerTeam && p.winnerTeam !== 'Empate') {
          text += ` (${methodLabel} - Vencedor: ${p.winnerTeam})`;
        } else {
          text += ` (${methodLabel})`;
        }
      }
      return text;
    };

    const count = group.length;
    group.forEach((item, pIdx) => {
      let angleDeg;
      if (count === 1) {
        angleDeg = 90;
      } else {
        const startAngle = 290;
        const range = 320;
        angleDeg = startAngle + (pIdx / (count - 1)) * range;
      }
      const angleRad = (angleDeg * Math.PI) / 180;
      const px = cx + r * Math.cos(angleRad);
      const py = cy + r * Math.sin(angleRad);

      const pName = item.player.participantName;
      const shortName = getShortName(pName);
      const isSelected = item.isSelected;
      const textColor = isSelected ? '#38bdf8' : '#e2e8f0';
      const textWeight = isSelected ? '900' : '650';

      const fullPred = formatFullPrediction(item.prediction);
      const extraText = getPredictionDetailText(item.prediction);
      let extraTextSvg = '';
      if (extraText) {
        extraTextSvg = `<text x="${px}" y="${py + 21}" fill="#f59e0b" font-size="7.2" font-weight="700" text-anchor="middle" font-family="Inter, system-ui, sans-serif" style="text-shadow: 0 1px 3px rgba(0,0,0,0.9);">${escapeHtml(extraText)}</text>`;
      }

      itemsSvg += `
        <g class="sonar-item" style="cursor: pointer;" title="${escapeHtml(pName)}: ${escapeHtml(fullPred)}">
          <circle cx="${px}" cy="${py}" r="${isSelected ? 5 : 3.5}" fill="${isSelected ? '#38bdf8' : color}" stroke="#0f172a" stroke-width="1" />
          
          <g transform="translate(${px - 9}, ${py - 24})">
            <circle cx="9" cy="9" r="8" fill="rgba(15,23,42,0.85)" stroke="${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.2)'}" stroke-width="1" />
            <g transform="scale(0.7) translate(3, 3)">
              ${renderSvgParticipantIcon(item.player.icon, pName, 18)}
            </g>
          </g>

          <text x="${px}" y="${py + 13}" fill="${textColor}" font-size="8" font-weight="${textWeight}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" style="text-shadow: 0 1px 3px rgba(0,0,0,0.9);">${escapeHtml(shortName)}</text>
          ${extraTextSvg}
        </g>
      `;
    });
  });

  return `
    <div class="prediction-radar-full" style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px;">
      <div style="background: rgba(255,255,255,0.03); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Jogo ${m.id} · ${escapeHtml(stageLabel)}</span>
          <strong style="font-size: 1.15rem;">${escapeHtml(homeTeam)} <span style="color: var(--accent);">vs</span> ${escapeHtml(awayTeam)}</strong>
        </div>
        <div style="background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; color: rgba(255,255,255,0.85); font-weight: 600;">
          Sonar de Prognósticos (${predictions.length} participações)
        </div>
      </div>

      <div class="sonar-chart-container" style="position: relative; width: 100%; display: flex; justify-content: center; align-items: center; background: radial-gradient(circle, #0f172a 40%, #020617 100%); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; box-shadow: inset 0 0 50px rgba(0,0,0,0.8); overflow: hidden; padding: 20px 0;">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="display: block; max-width: ${svgWidth}px;">
          <defs>
            <filter id="sonarGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          ${circlesSvg}
          ${itemsSvg}
          ${labelsSvg}
        </svg>
      </div>
    </div>
  `;
}

export function renderGamePodiumSection(summary, leftPlayerId = null, rightPlayerId = null) {
  if (!summary || !summary.match) return '<div class="empty">Sem dados.</div>';

  const m = summary.match;
  const official = summary.official;
  const home = m.home || m.homeTeam || 'Casa';
  const away = m.away || m.awayTeam || 'Fora';
  const officialScore = official && official.homeGoals != null && official.awayGoals != null
    ? `${official.homeGoals} - ${official.awayGoals}`
    : 'Pendente';

  const stageLabel = {
    groups: 'Fase de grupos',
    round32: '16 avos',
    round16: 'Oitavos',
    quarterfinals: 'Quartos',
    semifinals: 'Meias-finais',
    third_place: '3º Lugar',
    final: 'Final'
  }[m.stage] || m.stage || 'Jogo';

  const predictionsList = summary.predictions || [];
  
  const sorted = [...predictionsList].sort((a, b) => {
    const ptsA = a.score ? a.score.points : 0;
    const ptsB = b.score ? b.score.points : 0;
    if (ptsB !== ptsA) return ptsB - ptsA;

    const exactA = a.score && a.score.exact ? 1 : 0;
    const exactB = b.score && b.score.exact ? 1 : 0;
    if (exactB !== exactA) return exactB - exactA;

    const goalsHitA = a.score ? a.score.goalsHit : 0;
    const goalsHitB = b.score ? b.score.goalsHit : 0;
    if (goalsHitB !== goalsHitA) return goalsHitB - goalsHitA;

    const goalsMissedA = a.score ? a.score.goalsMissed : 99;
    const goalsMissedB = b.score ? b.score.goalsMissed : 99;
    if (goalsMissedA !== goalsMissedB) return goalsMissedA - goalsMissedB;

    return a.player.participantName.localeCompare(b.player.participantName, 'pt-PT');
  });

  const p1 = sorted[0];
  const p2 = sorted[1];
  const p3 = sorted[2];

  const renderPedestal = (item, place, height, gradient, numColor) => {
    if (!item) {
      return `
        <div class="podium-step step-${place}" style="display: flex; flex-direction: column; align-items: center; flex: 1; max-width: 140px; opacity: 0.3;">
          <div class="podium-pedestal" style="width: 100%; height: ${height}px; background: rgba(255,255,255,0.05); border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 2rem; font-weight: 900; color: rgba(255,255,255,0.1);">${place}</span>
          </div>
        </div>
      `;
    }
    const name = item.player.participantName;
    const icon = renderParticipantIcon(item.player.icon, name);
    const pts = item.score ? `${item.score.points} pts` : 'Pendente';
    const pred = item.prediction && item.prediction.homeGoals != null && item.prediction.awayGoals != null
      ? `${item.prediction.homeGoals} - ${item.prediction.awayGoals}`
      : '-';

    const isLeftRightVs = (leftPlayerId && item.player.id === leftPlayerId) || (rightPlayerId && item.player.id === rightPlayerId);
    const highlightStyle = isLeftRightVs ? 'border: 2px solid var(--accent); box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);' : '';

    return `
      <div class="podium-step step-${place}" style="display: flex; flex-direction: column; align-items: center; flex: 1; max-width: 150px; ${highlightStyle} border-radius: 12px 12px 0 0; padding: 4px 4px 0;">
        <div class="player-avatar-large" style="margin-bottom: 8px; display: flex; flex-direction: column; align-items: center; text-align: center; width: 100%;">
          <div style="transform: scale(1.1); margin-bottom: 2px;">${icon}</div>
          <span style="font-size: 0.8rem; font-weight: 800; color: var(--text); display: block; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px;">${escapeHtml(name)}</span>
          <span style="font-size: 0.75rem; color: var(--accent); font-weight: bold; margin-top: 2px;">Prog: ${pred}</span>
        </div>
        <div class="podium-pedestal" style="width: 100%; height: ${height}px; background: ${gradient}; border-radius: 8px 8px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
          <span class="podium-number" style="font-size: ${place === 1 ? '2.8rem' : '2.1rem'}; font-weight: 900; color: ${numColor}; line-height: 1.1;">${place}</span>
          <span style="font-size: 0.9rem; font-weight: 900; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">${pts}</span>
        </div>
      </div>
    `;
  };

  let h1 = 140, h2 = 100, h3 = 75;
  let r1 = 1, r2 = 2, r3 = 3;
  let g1 = 'linear-gradient(180deg, #f5c451 0%, #b45309 100%)';
  let g2 = 'linear-gradient(180deg, #9ca3af 0%, #4b5563 100%)';
  let g3 = 'linear-gradient(180deg, #b45309 0%, #78350f 100%)';

  const pts1 = p1 && p1.score ? p1.score.points : 0;
  const pts2 = p2 && p2.score ? p2.score.points : 0;
  const pts3 = p3 && p3.score ? p3.score.points : 0;

  if (pts1 === pts2 && pts2 === pts3) {
    h1 = 140; h2 = 140; h3 = 140;
    r1 = 1; r2 = 1; r3 = 1;
    g2 = g1;
    g3 = g1;
  } else if (pts1 === pts2) {
    h1 = 140; h2 = 140; h3 = 90;
    r1 = 1; r2 = 1; r3 = 3;
    g2 = g1;
  } else if (pts2 === pts3) {
    h1 = 140; h2 = 100; h3 = 100;
    r1 = 1; r2 = 2; r3 = 2;
    g3 = g2;
  }

  const p1Html = renderPedestal(p1, r1, h1, g1, 'rgba(255,255,255,0.3)');
  const p2Html = renderPedestal(p2, r2, h2, g2, 'rgba(255,255,255,0.25)');
  const p3Html = renderPedestal(p3, r3, h3, g3, 'rgba(255,255,255,0.25)');

  const otherRows = sorted.slice(3).map((item, index) => {
    const p = item.prediction;
    const score = item.score;
    const name = item.player.participantName;
    const icon = renderParticipantIcon(item.player.icon, name);
    const place = index + 4;
    
    let predText = '-';
    let ptsText = '-';
    let rowStyle = '';
    
    if (p && p.homeGoals != null && p.awayGoals != null) {
      predText = `${p.homeGoals} - ${p.awayGoals}`;
      if (score) {
        ptsText = `+${score.points} Pts`;
        rowStyle = score.exact ? 'color: #facc15;' : (score.points > 0 ? 'color: #34d399;' : 'color: #f87171;');
      } else {
        ptsText = 'Pendente';
        rowStyle = 'color: var(--muted);';
      }
    }

    const isLeftRightVs = (leftPlayerId && item.player.id === leftPlayerId) || (rightPlayerId && item.player.id === rightPlayerId);
    const rowBg = isLeftRightVs ? 'background: rgba(56, 189, 248, 0.08); font-weight: bold; border-left: 3px solid var(--accent);' : '';
    
    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); height: 42px; ${rowBg}">
        <td style="padding: 6px 12px; font-weight: bold; color: var(--muted); width: 40px; text-align: center;">
          ${place}º
        </td>
        <td style="padding: 6px 12px; display: flex; align-items: center; gap: 8px; font-weight: 500;">
          ${icon} <span>${escapeHtml(name)}</span>
        </td>
        <td style="padding: 6px 12px; font-family: monospace; font-size: 1.05rem; font-weight: bold; text-align: center;">
          ${predText}
        </td>
        <td style="padding: 6px 12px; text-align: right; font-weight: bold; ${rowStyle}">
          ${ptsText}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="prediction-view-layout" style="display: flex; flex-direction: column; gap: 20px; margin-top: 12px; font-size: 0.95rem;">
      <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Jogo ${m.id} · ${stageLabel}</span>
          <strong style="font-size: 1.25rem;">${escapeHtml(home)} <span style="color: var(--accent);">vs</span> ${escapeHtml(away)}</strong>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Resultado Oficial</span>
          <strong style="font-size: 1.4rem; color: #facc15;">${officialScore}</strong>
        </div>
      </div>

      <!-- Podium -->
      <div class="podium-container" style="display: flex; align-items: flex-end; justify-content: center; gap: 16px; margin: 24px auto 12px; width: 100%; max-width: 500px; height: 250px;">
        ${p2Html}
        ${p1Html}
        ${p3Html}
      </div>
      
      ${otherRows ? `
        <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; background: rgba(0,0,0,0.15);">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.8rem; text-transform: uppercase; opacity: 0.7; letter-spacing: 0.05em;">
                <th style="padding: 10px 12px; text-align: center;">Pos</th>
                <th style="padding: 10px 12px;">Jogador</th>
                <th style="padding: 10px 12px; text-align: center;">Prognóstico</th>
                <th style="padding: 10px 12px; text-align: right;">Pontos</th>
              </tr>
            </thead>
            <tbody>
              ${otherRows}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `;
}

function renderPredictionMountain(summary) {
  if (!summary || !summary.match || !summary.predictions || summary.predictions.length === 0) {
    return '<div class="empty">Sem dados para a montanha.</div>';
  }

  const m = summary.match;
  const homeTeam = m.home || m.homeTeam || 'Equipa A';
  const awayTeam = m.away || m.awayTeam || 'Equipa B';
  const predictions = summary.predictions || [];

  const leftPlayers = [];
  const rightPlayers = [];
  const drawPlayers = [];

  const isSameTeam = (name1, name2) => {
    if (!name1 || !name2) return false;
    return name1.toLowerCase().trim() === name2.toLowerCase().trim();
  };

  predictions.forEach(item => {
    const p = item.prediction;
    if (!p || p.homeGoals == null || p.awayGoals == null) return;
    const h = Number(p.homeGoals);
    const a = Number(p.awayGoals);

    const isHomeWinner = (h > a) || (h === a && p.winnerTeam && isSameTeam(p.winnerTeam, homeTeam));
    const isAwayWinner = (a > h) || (h === a && p.winnerTeam && isSameTeam(p.winnerTeam, awayTeam));

    if (isHomeWinner) {
      leftPlayers.push(item);
    } else if (isAwayWinner) {
      rightPlayers.push(item);
    } else {
      drawPlayers.push(item);
    }
  });

  const countA = leftPlayers.length;
  const countB = rightPlayers.length;
  const countDraw = drawPlayers.length;
  const totalVotes = countA + countB + countDraw;

  let scaleA = 0.5;
  let scaleB = 0.5;

  if (countA > 0 || countB > 0) {
    const maxVal = Math.max(countA, countB);
    scaleA = countA / maxVal;
    scaleB = countB / maxVal;
    scaleA = 0.4 + scaleA * 0.6;
    scaleB = 0.4 + scaleB * 0.6;
  }

  const heightA = scaleA * 200;
  const widthA = scaleA * 260;
  const heightB = scaleB * 200;
  const widthB = scaleB * 260;

  const logoAY = 260 - heightA * 0.35;
  const logoBY = 260 - heightB * 0.35;

  const logoAY_pct = (logoAY / 320) * 100;
  const logoBY_pct = (logoBY / 320) * 100;

  let logoAOverlay = '';
  let logoBOverlay = '';
  let svgLogos = '';

  const urlA = summary.flags?.[homeTeam.toLowerCase().trim()];
  if (urlA) {
    logoAOverlay = `
      <img src="${urlA}" alt="${escapeHtml(homeTeam)}" style="position: absolute; left: 28.75%; top: ${logoAY_pct}%; transform: translate(-50%, -50%); width: 6.25%; aspect-ratio: 1; border-radius: 50%; border: 2px solid rgba(255,255,255,0.85); box-shadow: 0 2px 4px rgba(0,0,0,0.5); object-fit: cover;" />
    `;
    svgLogos += `<circle cx="230" cy="${logoAY}" r="27" fill="#ffffff" opacity="0.9" />`;
  } else {
    const initials = homeTeam.substring(0, 2).toUpperCase();
    svgLogos += `
      <circle cx="230" cy="${logoAY}" r="25" fill="#1e293b" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
      <text x="230" y="${logoAY + 4}" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">${initials}</text>
    `;
  }

  const urlB = summary.flags?.[awayTeam.toLowerCase().trim()];
  if (urlB) {
    logoBOverlay = `
      <img src="${urlB}" alt="${escapeHtml(awayTeam)}" style="position: absolute; left: 71.25%; top: ${logoBY_pct}%; transform: translate(-50%, -50%); width: 6.25%; aspect-ratio: 1; border-radius: 50%; border: 2px solid rgba(255,255,255,0.85); box-shadow: 0 2px 4px rgba(0,0,0,0.5); object-fit: cover;" />
    `;
    svgLogos += `<circle cx="570" cy="${logoBY}" r="27" fill="#ffffff" opacity="0.9" />`;
  } else {
    const initials = awayTeam.substring(0, 2).toUpperCase();
    svgLogos += `
      <circle cx="570" cy="${logoBY}" r="25" fill="#1e293b" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
      <text x="570" y="${logoBY + 4}" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">${initials}</text>
    `;
  }

  const getFlagHtml = (teamName, size = 20) => {
    const url = summary.flags?.[teamName.toLowerCase().trim()];
    if (url) {
      return `<img src="${url}" alt="${escapeHtml(teamName)}" style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover; vertical-align: middle; box-shadow: 0 2px 4px rgba(0,0,0,0.4); border: 1.5px solid rgba(255,255,255,0.7);" />`;
    }
    return `<span style="width: ${size}px; height: ${size}px; border-radius: 50%; background: rgba(255,255,255,0.15); display: inline-flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; border: 1.5px solid rgba(255,255,255,0.4); vertical-align: middle;">${teamName.substring(0, 2).toUpperCase()}</span>`;
  };

  const renderPlayerRow = (item) => {
    const isSelected = item.isSelected;
    const name = item.player.participantName;
    const shortName = getShortName(name);
    const p = item.prediction;
    
    let predStr = p ? `${p.homeGoals}-${p.awayGoals}` : '';
    if (p && (p.method === 'et' || p.method === 'pens')) {
      const methodLabel = p.method === 'et' ? 'prolongamento' : 'penáltis';
      predStr += ` (${methodLabel})`;
    }
    
    const highlightBg = isSelected ? 'background: rgba(56, 189, 248, 0.25); border-radius: 6px; font-weight: bold;' : '';
    const icon = renderParticipantIcon(item.player.icon, name);
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; font-size: 0.82rem; ${highlightBg}">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${icon}
          <span style="${isSelected ? 'color: #fff;' : 'color: rgba(255,255,255,0.75);'}">${escapeHtml(shortName)}</span>
        </div>
        <span style="font-family: monospace; font-weight: 700; color: var(--accent); margin-left: 8px;">${predStr}</span>
      </div>
    `;
  };

  const leftPlayersHtml = leftPlayers.map(renderPlayerRow).join('') || '<div style="font-size: 0.8rem; opacity: 0.4; font-style: italic; padding: 6px 12px; text-align: center;">Nenhum voto</div>';
  const rightPlayersHtml = rightPlayers.map(renderPlayerRow).join('') || '<div style="font-size: 0.8rem; opacity: 0.4; font-style: italic; padding: 6px 12px; text-align: center;">Nenhum voto</div>';
  const drawPlayersHtml = drawPlayers.map(renderPlayerRow).join('') || '<div style="font-size: 0.8rem; opacity: 0.4; font-style: italic; padding: 6px 12px; text-align: center;">Nenhum voto</div>';

  const stageLabel = {
    groups: 'Fase de grupos',
    round32: '16 avos',
    round16: 'Oitavos',
    quarterfinals: 'Quartos',
    semifinals: 'Meias-finais',
    third_place: '3.º lugar',
    final: 'Final'
  }[m.stage] || m.stage || 'Jogo';

  return `
    <div class="prediction-view-layout" style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px;">
      
      <div style="background: rgba(255,255,255,0.03); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Jogo ${m.id} · ${escapeHtml(stageLabel)}</span>
          <strong style="font-size: 1.15rem;">${escapeHtml(homeTeam)} <span style="color: var(--accent);">vs</span> ${escapeHtml(awayTeam)}</strong>
        </div>
        <div style="background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; color: rgba(255,255,255,0.85); font-weight: 600;">
          Montanhas de Votos (${predictions.length} participações)
        </div>
      </div>

      <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px 10px; display: flex; justify-content: center; overflow-x: auto;">
        <div style="position: relative; width: 100%; max-width: 800px; min-width: 500px;">
          <svg viewBox="0 0 800 320" style="width: 100%; height: auto; display: block;">
            <defs>
              <linearGradient id="mountainBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#0b0f19" />
                <stop offset="100%" stop-color="#020408" />
              </linearGradient>
              
              <!-- Mountain A Gradient (Home - Teal/Cyan) -->
              <linearGradient id="mountALight" x1="50%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#06b6d4" />
                <stop offset="100%" stop-color="#0891b2" />
              </linearGradient>
              <linearGradient id="mountADark" x1="50%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#0891b2" />
                <stop offset="100%" stop-color="#0e7490" />
              </linearGradient>
              
              <!-- Mountain B Gradient (Away - Red/Pink) -->
              <linearGradient id="mountBLight" x1="50%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ec4899" />
                <stop offset="100%" stop-color="#db2777" />
              </linearGradient>
              <linearGradient id="mountBDark" x1="50%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#db2777" />
                <stop offset="100%" stop-color="#be185d" />
              </linearGradient>
            </defs>
            
            <rect width="100%" height="100%" fill="url(#mountainBg)" rx="12" />
            
            <!-- Background Grid lines -->
            <line x1="50" y1="260" x2="750" y2="260" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
            <line x1="50" y1="170" x2="750" y2="170" stroke="rgba(255,255,255,0.05)" stroke-dasharray="5,5" />
            <line x1="50" y1="80" x2="750" y2="80" stroke="rgba(255,255,255,0.05)" stroke-dasharray="5,5" />

            <!-- Mountain A (Left) -->
            <!-- Dark Left Side -->
            <polygon points="230,${260 - heightA} ${230 - widthA/2},260 230,260" fill="url(#mountADark)" />
            <!-- Light Right Side -->
            <polygon points="230,${260 - heightA} 230,260 ${230 + widthA/2},260" fill="url(#mountALight)" />
            <!-- Snow Cap -->
            <polygon points="230,${260 - heightA} ${230 - widthA*0.1},${260 - heightA*0.8} 230,${260 - heightA*0.75} ${230 + widthA*0.1},${260 - heightA*0.8}" fill="#ffffff" opacity="0.95" />

            <!-- Mountain B (Right) -->
            <!-- Light Left Side -->
            <polygon points="570,${260 - heightB} ${570 - widthB/2},260 570,260" fill="url(#mountBLight)" />
            <!-- Dark Right Side -->
            <polygon points="570,${260 - heightB} 570,260 ${570 + widthB/2},260" fill="url(#mountBDark)" />
            <!-- Snow Cap -->
            <polygon points="570,${260 - heightB} ${570 - widthB*0.1},${260 - heightB*0.8} 570,${260 - heightB*0.75} ${570 + widthB*0.1},${260 - heightB*0.8}" fill="#ffffff" opacity="0.95" />

            <!-- Logos in the center of the mountains -->
            ${svgLogos}

            <!-- Mountain Vote Labels -->
            <text x="230" y="285" fill="#e2e8f0" font-size="13" font-weight="900" text-anchor="middle" font-family="Inter, system-ui, sans-serif">
              ${countA} ${countA === 1 ? 'Voto' : 'Votos'} (${totalVotes > 0 ? Math.round((countA/totalVotes)*100) : 0}%)
            </text>
            <text x="570" y="285" fill="#e2e8f0" font-size="13" font-weight="900" text-anchor="middle" font-family="Inter, system-ui, sans-serif">
              ${countB} ${countB === 1 ? 'Voto' : 'Votos'} (${totalVotes > 0 ? Math.round((countB/totalVotes)*100) : 0}%)
            </text>
          </svg>
          ${logoAOverlay}
          ${logoBOverlay}
        </div>
      </div>

      <!-- Player Lists Grid -->
      <div style="display: grid; grid-template-columns: 1fr 130px 1fr; gap: 14px; margin-top: 8px;">
        <!-- Left: Team A Voters -->
        <div style="background: rgba(6, 182, 212, 0.05); border: 1px solid rgba(6, 182, 212, 0.15); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(6, 182, 212, 0.2); padding-bottom: 6px;">
            <strong style="color: #22d3ee; font-size: 0.88rem; display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${getFlagHtml(homeTeam)} <span>${escapeHtml(homeTeam)}</span>
            </strong>
            <span style="background: rgba(6, 182, 212, 0.2); color: #22d3ee; padding: 2px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">${countA}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${leftPlayersHtml}
          </div>
        </div>

        <!-- Center: Draw Voters -->
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; text-align: center;">
          <div style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 6px; display: flex; justify-content: center; align-items: center; gap: 6px;">
            <strong style="color: rgba(255, 255, 255, 0.75); font-size: 0.88rem;">Empate</strong>
            <span style="background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.75); padding: 2px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">${countDraw}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${drawPlayersHtml}
          </div>
        </div>

        <!-- Right: Team B Voters -->
        <div style="background: rgba(236, 72, 153, 0.05); border: 1px solid rgba(236, 72, 153, 0.15); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(236, 72, 153, 0.2); padding-bottom: 6px;">
            <strong style="color: #f472b6; font-size: 0.88rem; display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${getFlagHtml(awayTeam)} <span>${escapeHtml(awayTeam)}</span>
            </strong>
            <span style="background: rgba(236, 72, 153, 0.2); color: #f472b6; padding: 2px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">${countB}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${rightPlayersHtml}
          </div>
        </div>
      </div>

    </div>
  `;
}

function renderAfterMatchBars(summary, leftPlayerId = null, rightPlayerId = null) {
  if (!summary || !summary.match) return '<div class="empty">Sem dados.</div>';

  const m = summary.match;
  const official = summary.official;
  const home = m.home || m.homeTeam || 'Casa';
  const away = m.away || m.awayTeam || 'Fora';
  const officialScore = official && official.homeGoals != null && official.awayGoals != null
    ? `${official.homeGoals} - ${official.awayGoals}`
    : 'Pendente';

  const stageLabel = {
    groups: 'Fase de grupos',
    round32: '16 avos',
    round16: 'Oitavos',
    quarterfinals: 'Quartos',
    semifinals: 'Meias-finais',
    third_place: '3º Lugar',
    final: 'Final'
  }[m.stage] || m.stage || 'Jogo';

  const predictionsList = summary.predictions || [];
  
  const pointsMap = new Map();
  predictionsList.forEach(item => {
    const pts = item.score ? item.score.points : 0;
    if (!pointsMap.has(pts)) {
      pointsMap.set(pts, []);
    }
    pointsMap.get(pts).push(item);
  });

  const uniquePoints = [...pointsMap.keys()].sort((a, b) => b - a);

  if (uniquePoints.length === 0) {
    return '<div class="empty">Nenhuma pontuação registada para este jogo.</div>';
  }

  const maxPoints = Math.max(...uniquePoints, 1);

  const renderCard = (item) => {
    const isSelected = item.isSelected;
    const name = item.player.participantName;
    const shortName = getShortName(name);
    const score = item.score;
    const p = item.prediction;
    const pts = score ? score.points : 0;

    let cardBg = '';
    let scoreColor = '';
    let ptsLabel = '0 pts';

    if (score) {
      ptsLabel = `+${score.points} pts`;
      if (pts === 0) {
        cardBg = 'background: rgba(255, 255, 255, 0.02); border: 1.1px solid rgba(255, 255, 255, 0.08);';
        scoreColor = 'color: rgba(255, 255, 255, 0.4);';
        ptsLabel = '0 pts';
      } else if (pts === maxPoints) {
        cardBg = 'background: rgba(34, 197, 94, 0.08); border: 1.1px solid rgba(34, 197, 94, 0.35);';
        scoreColor = 'color: #4ade80;';
      } else {
        const ratio = pts / maxPoints;
        if (ratio >= 0.5) {
          cardBg = 'background: rgba(234, 179, 8, 0.08); border: 1.1px solid rgba(234, 179, 8, 0.35);';
          scoreColor = 'color: #facc15;';
        } else {
          cardBg = 'background: rgba(249, 115, 22, 0.08); border: 1.1px solid rgba(249, 115, 22, 0.35);';
          scoreColor = 'color: #fb923c;';
        }
      }
    } else {
      cardBg = 'background: rgba(255, 255, 255, 0.04); border: 1.1px solid rgba(255, 255, 255, 0.08);';
      scoreColor = 'color: rgba(255, 255, 255, 0.5);';
      ptsLabel = 'Pendente';
    }

    const icon = renderParticipantIcon(item.player.icon, name);
    
    const isLeftRightVs = (leftPlayerId && item.player.id === leftPlayerId) || (rightPlayerId && item.player.id === rightPlayerId);
    const highlightBorder = isLeftRightVs 
      ? 'border: 1.8px solid var(--accent); background: rgba(56, 189, 248, 0.2); font-weight: bold; box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);' 
      : '';

    const predStr = p ? `${p.homeGoals}-${p.awayGoals}` : '-';

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; width: 100%; max-width: 210px; border-radius: 6px; ${cardBg} ${highlightBorder} box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; flex: 1; min-width: 0;">
          <span style="flex-shrink: 0; display: inline-flex; align-items: center;">${icon}</span>
          <span style="font-size: 0.76rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; ${isSelected ? 'color: #fff;' : 'color: rgba(255,255,255,0.8);'}">${escapeHtml(shortName)} <span style="font-size: 0.7rem; opacity: 0.55;">(${predStr})</span></span>
        </div>
        <strong style="font-family: monospace; font-size: 0.82rem; flex-shrink: 0; ${scoreColor}">${ptsLabel}</strong>
      </div>
    `;
  };

  const columnsHtml = uniquePoints.map(pts => {
    const list = pointsMap.get(pts) || [];
    const sortedList = [...list].sort((a, b) => a.player.participantName.localeCompare(b.player.participantName, 'pt-PT'));
    const cardsHtml = sortedList.map(renderCard).join('');
    
    return `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; flex: 1; min-width: 150px; max-width: 220px;">
        <div style="display: flex; flex-direction: column-reverse; gap: 6px; width: 100%; align-items: center;">
          ${cardsHtml}
        </div>
        <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.15); width: 100%; padding-top: 8px; font-weight: 800; font-size: 0.88rem; color: #fff;">
          ${pts} ${pts === 1 ? 'Ponto' : 'Pontos'}
          <div style="font-size: 0.75rem; color: var(--muted); margin-top: 2px; font-weight: 600;">${list.length} ${list.length === 1 ? 'jogador' : 'jogadores'}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="prediction-view-layout" style="display: flex; flex-direction: column; gap: 20px; margin-top: 12px; font-size: 0.95rem;">
      <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Jogo ${m.id} · ${stageLabel}</span>
          <strong style="font-size: 1.25rem;">${escapeHtml(home)} <span style="color: var(--accent);">vs</span> ${escapeHtml(away)}</strong>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Resultado Oficial</span>
          <strong style="font-size: 1.4rem; color: #facc15;">${officialScore}</strong>
        </div>
      </div>

      <div class="bars-chart-container" style="display: flex; justify-content: space-around; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 40px 10px; gap: 14px; min-height: 400px; align-items: flex-end; flex-wrap: wrap;">
        ${columnsHtml}
      </div>
    </div>
  `;
}


function renderPredictionBars(summary) {
  if (!summary || !summary.match || !summary.predictions || summary.predictions.length === 0) {
    return '<div class="empty">Sem dados para o gráfico de barras.</div>';
  }

  const m = summary.match;
  const homeTeam = m.home || m.homeTeam || 'Equipa A';
  const awayTeam = m.away || m.awayTeam || 'Equipa B';
  const predictions = summary.predictions || [];

  const regTime = [];
  const extraTime = [];
  const penalties = [];

  const isSameTeam = (name1, name2) => {
    if (!name1 || !name2) return false;
    return name1.toLowerCase().trim() === name2.toLowerCase().trim();
  };

  predictions.forEach(item => {
    const p = item.prediction;
    if (!p || p.homeGoals == null || p.awayGoals == null) return;
    
    const method = String(p.method || '').trim().toLowerCase();
    if (method === 'et') {
      extraTime.push(item);
    } else if (method === 'pens') {
      penalties.push(item);
    } else {
      regTime.push(item);
    }
  });

  const renderCard = (item) => {
    const isSelected = item.isSelected;
    const name = item.player.participantName;
    const shortName = getShortName(name);
    const p = item.prediction;
    const h = Number(p.homeGoals);
    const a = Number(p.awayGoals);

    const isHomeWinner = (h > a) || (h === a && p.winnerTeam && isSameTeam(p.winnerTeam, homeTeam));
    const isAwayWinner = (a > h) || (h === a && p.winnerTeam && isSameTeam(p.winnerTeam, awayTeam));

    let cardBg = '';
    let scoreColor = '';
    if (isHomeWinner) {
      cardBg = 'background: rgba(6, 182, 212, 0.07); border: 1.1px solid rgba(6, 182, 212, 0.2);';
      scoreColor = 'color: #22d3ee;';
    } else if (isAwayWinner) {
      cardBg = 'background: rgba(236, 72, 153, 0.07); border: 1.1px solid rgba(236, 72, 153, 0.2);';
      scoreColor = 'color: #f472b6;';
    } else {
      cardBg = 'background: rgba(255, 255, 255, 0.04); border: 1.1px solid rgba(255, 255, 255, 0.08);';
      scoreColor = 'color: rgba(255, 255, 255, 0.6);';
    }

    let flagHtml = '';
    if (p.winnerTeam && p.winnerTeam !== 'Empate') {
      const winnerFlagUrl = summary.flags?.[p.winnerTeam.toLowerCase().trim()];
      if (winnerFlagUrl) {
        flagHtml = `<img src="${winnerFlagUrl}" alt="${p.winnerTeam}" style="width: 14px; height: 14px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.5);" />`;
      } else {
        flagHtml = `<span style="font-size: 0.7rem; opacity: 0.7;">(${p.winnerTeam.substring(0, 3).toUpperCase()})</span>`;
      }
    }

    const icon = renderParticipantIcon(item.player.icon, name);
    const highlightBorder = isSelected ? 'border: 1.5px solid var(--accent); background: rgba(56, 189, 248, 0.2); font-weight: bold;' : '';

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; width: 100%; max-width: 210px; border-radius: 6px; ${cardBg} ${highlightBorder} box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; flex: 1; min-width: 0;">
          <span style="flex-shrink: 0; display: inline-flex; align-items: center;">${icon}</span>
          <span style="font-size: 0.76rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; ${isSelected ? 'color: #fff;' : 'color: rgba(255,255,255,0.8);'}">${escapeHtml(shortName)}</span>
        </div>
        <strong style="font-family: monospace; font-size: 0.82rem; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; ${scoreColor}">
          <span>${p.homeGoals}-${p.awayGoals}</span>
          ${flagHtml}
        </strong>
      </div>
    `;
  };

  const regTimeHtml = regTime.map(renderCard).join('') || '<div style="font-size: 0.78rem; opacity: 0.35; font-style: italic; padding: 10px 0;">Sem apostas</div>';
  const extraTimeHtml = extraTime.map(renderCard).join('') || '<div style="font-size: 0.78rem; opacity: 0.35; font-style: italic; padding: 10px 0;">Sem apostas</div>';
  const penaltiesHtml = penalties.map(renderCard).join('') || '<div style="font-size: 0.78rem; opacity: 0.35; font-style: italic; padding: 10px 0;">Sem apostas</div>';

  const stageLabel = {
    groups: 'Fase de grupos',
    round32: '16 avos',
    round16: 'Oitavos',
    quarterfinals: 'Quartos',
    semifinals: 'Meias-finais',
    third_place: '3.º lugar',
    final: 'Final'
  }[m.stage] || m.stage || 'Jogo';

  return `
    <div class="prediction-view-layout" style="display: flex; flex-direction: column; gap: 16px; margin-top: 12px;">
      
      <div style="background: rgba(255,255,255,0.03); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; display: block; margin-bottom: 2px;">Jogo ${m.id} · ${escapeHtml(stageLabel)}</span>
          <strong style="font-size: 1.15rem;">${escapeHtml(homeTeam)} <span style="color: var(--accent);">vs</span> ${escapeHtml(awayTeam)}</strong>
        </div>
        <div style="background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; color: rgba(255,255,255,0.85); font-weight: 600;">
          Distribuição por Tempo de Jogo (${predictions.length} participações)
        </div>
      </div>

      <div class="bars-chart-container" style="display: flex; justify-content: space-around; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 40px 10px; gap: 14px; min-height: 400px; align-items: flex-end; flex-wrap: wrap;">
        <!-- Column 1: 90 Minutes -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; flex: 1; min-width: 150px; max-width: 220px;">
          <div style="display: flex; flex-direction: column-reverse; gap: 6px; width: 100%; align-items: center;">
            ${regTimeHtml}
          </div>
          <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.15); width: 100%; padding-top: 8px; font-weight: 800; font-size: 0.88rem; color: #fff;">
            90' minutos
            <div style="font-size: 0.75rem; color: var(--muted); margin-top: 2px; font-weight: 600;">${regTime.length} ${regTime.length === 1 ? 'prognóstico' : 'prognósticos'}</div>
          </div>
        </div>

        <!-- Column 2: Extra Time -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; flex: 1; min-width: 150px; max-width: 220px;">
          <div style="display: flex; flex-direction: column-reverse; gap: 6px; width: 100%; align-items: center;">
            ${extraTimeHtml}
          </div>
          <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.15); width: 100%; padding-top: 8px; font-weight: 800; font-size: 0.88rem; color: #fff;">
            Prolongamento
            <div style="font-size: 0.75rem; color: var(--muted); margin-top: 2px; font-weight: 600;">${extraTime.length} ${extraTime.length === 1 ? 'prognóstico' : 'prognósticos'}</div>
          </div>
        </div>

        <!-- Column 3: Penalties -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; flex: 1; min-width: 150px; max-width: 220px;">
          <div style="display: flex; flex-direction: column-reverse; gap: 6px; width: 100%; align-items: center;">
            ${penaltiesHtml}
          </div>
          <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.15); width: 100%; padding-top: 8px; font-weight: 800; font-size: 0.88rem; color: #fff;">
            Penáltis
            <div style="font-size: 0.75rem; color: var(--muted); margin-top: 2px; font-weight: 600;">${penalties.length} ${penalties.length === 1 ? 'prognóstico' : 'prognósticos'}</div>
          </div>
        </div>
      </div>

    </div>
  `;
}
