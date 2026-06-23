// Palm Golf: Tiger 5 Tracker - Application Logic

// --- STATE MANAGEMENT ---
let state = {
  rounds: [], // Finished rounds history
  currentRound: null, // Active round (in_progress)
  theme: 'system' // Theme selection: system, light, dark
};

const METRIC_KEYS = [
  'double_bogey',
  'par5_bogey',
  'three_putt',
  'wedge_green_miss',
  'double_chip'
];

const METRIC_LABELS = {
  double_bogey: { title: 'Double Bogey+', subtitle: 'Any hole played at +2 or worse' },
  par5_bogey: { title: 'Bogey on Par 5', subtitle: 'Bogey or worse on a par 5 hole' },
  three_putt: { title: 'Three Putt', subtitle: '3 or more putts on the green' },
  wedge_green_miss: { title: 'Wedge Miss', subtitle: 'Missed green from wedge distance' },
  double_chip: { title: 'Chipped Twice+', subtitle: '2+ chips/pitches around same green' }
};

// --- HAPTICS & SOUND ---
function triggerHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(15);
  }
}

// --- LOCAL STORAGE UTILITIES ---
function loadState() {
  try {
    const savedRounds = localStorage.getItem('PALM_GOLF_ROUNDS');
    const savedCurrent = localStorage.getItem('PALM_GOLF_CURRENT_ROUND');
    const savedTheme = localStorage.getItem('PALM_GOLF_THEME');

    if (savedRounds) state.rounds = JSON.parse(savedRounds);
    if (savedCurrent) state.currentRound = JSON.parse(savedCurrent);
    if (savedTheme) {
      state.theme = savedTheme;
      applyTheme(savedTheme);
    } else {
      applyTheme('system');
    }
  } catch (err) {
    console.error('Error loading state from localStorage:', err);
  }
}

function saveRounds() {
  localStorage.setItem('PALM_GOLF_ROUNDS', JSON.stringify(state.rounds));
}

function saveCurrentRound() {
  if (state.currentRound) {
    localStorage.setItem('PALM_GOLF_CURRENT_ROUND', JSON.stringify(state.currentRound));
  } else {
    localStorage.removeItem('PALM_GOLF_CURRENT_ROUND');
  }
}

function saveThemeSetting(theme) {
  state.theme = theme;
  localStorage.setItem('PALM_GOLF_THEME', theme);
  applyTheme(theme);
}

// --- THEME ENGINE ---
function applyTheme(theme) {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  }
  // Sync the UI settings toggles if they exist
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) themeSelect.value = theme;
}

// --- ROUND LOGIC ---
function startNewRound(courseName, date, numHoles = 18) {
  const parsedHoles = parseInt(numHoles) || 18;
  state.currentRound = {
    id: 'round_' + Date.now(),
    courseName: courseName.trim() || 'Unspecified Course',
    date: date || new Date().toISOString().split('T')[0],
    status: 'in_progress',
    currentHole: 1,
    totalHoles: parsedHoles,
    holes: Array.from({ length: parsedHoles }, (_, i) => ({
      holeNumber: i + 1,
      par: 4,
      double_bogey: false,
      par5_bogey: false,
      three_putt: false,
      wedge_green_miss: false,
      double_chip: false
    }))
  };
  saveCurrentRound();
  renderActiveHole();
  showScreen('screen-active-round');
}

function discardCurrentRound() {
  state.currentRound = null;
  saveCurrentRound();
  renderDashboard();
  showScreen('screen-dashboard');
}

function finishCurrentRound() {
  if (!state.currentRound) return;
  state.currentRound.status = 'finished';
  state.rounds.push(state.currentRound);
  
  const finishedRoundId = state.currentRound.id;
  state.currentRound = null;
  saveCurrentRound();
  saveRounds();
  
  showRoundSummary(finishedRoundId);
}

// --- MATH & DERIVED METRICS ---
function calculateRoundStats(round) {
  let totalEvents = 0;
  const metricsCount = {
    double_bogey: 0,
    par5_bogey: 0,
    three_putt: 0,
    wedge_green_miss: 0,
    double_chip: 0
  };
  
  let holesPlayed = 0;
  let par5sCount = 0;
  let par5sWithoutBogey = 0;
  let doubleBogeyBreakdown = { par3: 0, par4: 0, par5: 0 };
  let doubleBogeyTotal = 0;

  round.holes.forEach(hole => {
    // Only count holes where the user recorded something, or if it is a completed round, we assume all holes
    // For in-progress, we only count up to current logged holes
    const isLogged = round.status === 'finished' || hole.holeNumber < round.currentHole || 
                     (hole.holeNumber === round.currentHole && hasAnyMetricChecked(hole));
    
    if (isLogged) {
      holesPlayed++;
      
      METRIC_KEYS.forEach(key => {
        // Condition: par5_bogey is only valid on par 5s
        if (key === 'par5_bogey') {
          if (hole.par === 5) {
            par5sCount++;
            if (hole.par5_bogey) {
              metricsCount.par5_bogey++;
              totalEvents++;
            } else {
              par5sWithoutBogey++;
            }
          }
        } else {
          if (hole[key]) {
            metricsCount[key]++;
            totalEvents++;
            
            if (key === 'double_bogey') {
              doubleBogeyTotal++;
              if (hole.par === 3) doubleBogeyBreakdown.par3++;
              else if (hole.par === 4) doubleBogeyBreakdown.par4++;
              else if (hole.par === 5) doubleBogeyBreakdown.par5++;
            }
          }
        }
      });
    }
  });

  const index = holesPlayed > 0 ? ((totalEvents / holesPlayed) * 18).toFixed(1) : '0.0';
  const par5Conversion = par5sCount > 0 ? Math.round((par5sWithoutBogey / par5sCount) * 100) : null;

  // Find biggest leak
  let biggestLeak = null;
  let maxCount = -1;
  METRIC_KEYS.forEach(key => {
    // For comparison, normalize par 5 bogey to all holes if we want direct comparison, or just use absolute counts
    const count = metricsCount[key];
    if (count > maxCount) {
      maxCount = count;
      biggestLeak = key;
    }
  });

  return {
    totalEvents,
    holesPlayed,
    index,
    metricsCount,
    par5sCount,
    par5Conversion,
    doubleBogeyBreakdown,
    doubleBogeyTotal,
    biggestLeak: maxCount > 0 ? biggestLeak : null
  };
}

function hasAnyMetricChecked(hole) {
  return hole.double_bogey || (hole.par === 5 && hole.par5_bogey) || 
         hole.three_putt || hole.wedge_green_miss || hole.double_chip;
}

function getSeasonSummary(year = new Date().getFullYear()) {
  const filteredRounds = state.rounds.filter(r => new Date(r.date).getFullYear() === year);
  
  if (filteredRounds.length === 0) {
    return { roundsCount: 0, index: '0.0', biggestLeak: null, par5Conversion: null };
  }

  let totalEvents = 0;
  let totalHoles = 0;
  let par5sCount = 0;
  let par5sWithoutBogey = 0;
  
  const metricsCount = {
    double_bogey: 0,
    par5_bogey: 0,
    three_putt: 0,
    wedge_green_miss: 0,
    double_chip: 0
  };

  filteredRounds.forEach(r => {
    const stats = calculateRoundStats(r);
    totalEvents += stats.totalEvents;
    totalHoles += stats.holesPlayed;
    
    METRIC_KEYS.forEach(key => {
      metricsCount[key] += stats.metricsCount[key];
    });

    par5sCount += stats.par5sCount;
    // Calculate how many were saved
    par5sWithoutBogey += (stats.par5sCount - stats.metricsCount.par5_bogey);
  });

  const index = totalHoles > 0 ? ((totalEvents / totalHoles) * 18).toFixed(1) : '0.0';
  const par5Conversion = par5sCount > 0 ? Math.round((par5sWithoutBogey / par5sCount) * 100) : null;

  // Rank leaks based on normalized counts per 18 holes
  let biggestLeak = null;
  let maxRate = -1;
  METRIC_KEYS.forEach(key => {
    // Normalization: events per 18 holes
    const rate = totalHoles > 0 ? (metricsCount[key] / totalHoles) * 18 : 0;
    if (rate > maxRate) {
      maxRate = rate;
      biggestLeak = key;
    }
  });

  return {
    roundsCount: filteredRounds.length,
    index,
    metricsCount,
    par5Conversion,
    biggestLeak: maxRate > 0 ? biggestLeak : null,
    totalHoles
  };
}

// --- SCREEN NAVIGATION ---
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(scr => {
    scr.classList.add('hidden');
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.remove('hidden');
    window.scrollTo(0, 0);
  }
}

// --- UI RENDERING ENGINE ---

// 1. Dashboard View
function renderDashboard() {
  const container = document.getElementById('dashboard-content');
  if (!container) return;

  // Check for in-progress round
  const inProgressContainer = document.getElementById('in-progress-banner');
  if (state.currentRound) {
    inProgressContainer.innerHTML = `
      <div class="card card-alert">
        <div class="card-alert-body">
          <h3>Round in Progress</h3>
          <p>${state.currentRound.courseName} — Hole ${state.currentRound.currentHole} of ${state.currentRound.totalHoles}</p>
        </div>
        <div class="card-alert-actions">
          <button class="btn btn-primary btn-sm" id="btn-resume-round">Resume</button>
          <button class="btn btn-secondary btn-sm" id="btn-discard-prompt">Discard</button>
        </div>
      </div>
    `;
    inProgressContainer.classList.remove('hidden');
    
    document.getElementById('btn-resume-round').addEventListener('click', () => {
      triggerHaptic();
      renderActiveHole();
      showScreen('screen-active-round');
    });

    document.getElementById('btn-discard-prompt').addEventListener('click', () => {
      triggerHaptic();
      if (confirm('Are you sure you want to discard this round? This cannot be undone.')) {
        discardCurrentRound();
      }
    });
  } else {
    inProgressContainer.innerHTML = '';
    inProgressContainer.classList.add('hidden');
  }

  // Season overview
  const currentYear = new Date().getFullYear();
  const season = getSeasonSummary(currentYear);
  
  let leakHTML = 'None logged';
  if (season.biggestLeak) {
    leakHTML = `<span class="badge badge-warning">${METRIC_LABELS[season.biggestLeak].title}</span>`;
  }

  let conversionHTML = 'N/A';
  if (season.par5Conversion !== null) {
    conversionHTML = `${season.par5Conversion}%`;
  }

  container.innerHTML = `
    <!-- Top Brand Card -->
    <div class="brand-hero">
      <div class="brand-hero-logo">
        <img src="icons/logo.svg" alt="Palm Golf Logo" />
      </div>
      <h2>Palm Golf: Tiger 5</h2>
      <p class="subtitle">Focus on zero errors</p>
    </div>

    <!-- Quick Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Season Index</span>
        <span class="stat-val text-accent">${season.index}</span>
        <span class="stat-desc">Events per 18 holes</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Rounds</span>
        <span class="stat-val">${season.roundsCount}</span>
        <span class="stat-desc">Played in ${currentYear}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Biggest Leak</span>
        <span class="stat-val val-small">${leakHTML}</span>
        <span class="stat-desc">Most frequent error</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Par 5 Conversion</span>
        <span class="stat-val text-success">${conversionHTML}</span>
        <span class="stat-desc">Par or better rate</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="dashboard-actions">
      <button class="btn btn-primary btn-lg btn-full" id="btn-start-flow">
        <span class="btn-icon">🏌️‍♂️</span> Start New Round
      </button>
      <div class="button-row">
        <button class="btn btn-secondary btn-full" id="btn-goto-trends">
          📊 Trends &amp; History
        </button>
        <button class="btn btn-secondary btn-full" id="btn-goto-settings">
          ⚙️ Settings
        </button>
      </div>
    </div>
  `;

  // Bind Dashboard Buttons
  document.getElementById('btn-start-flow').addEventListener('click', () => {
    triggerHaptic();
    document.getElementById('setup-course').value = '';
    document.getElementById('setup-date').value = new Date().toISOString().split('T')[0];
    showScreen('screen-setup');
  });

  document.getElementById('btn-goto-trends').addEventListener('click', () => {
    triggerHaptic();
    renderTrendsView();
    showScreen('screen-trends');
  });

  document.getElementById('btn-goto-settings').addEventListener('click', () => {
    triggerHaptic();
    renderSettingsView();
    showScreen('screen-settings');
  });
}

// 2. Active Hole Log View
function renderActiveHole() {
  const round = state.currentRound;
  if (!round) return;

  const holeIndex = round.currentHole - 1;
  const hole = round.holes[holeIndex];

  const container = document.getElementById('active-round-content');
  if (!container) return;

  // Build the list of toggles
  let togglesHTML = '';
  METRIC_KEYS.forEach(key => {
    const label = METRIC_LABELS[key];
    const isPar5 = hole.par === 5;
    const isDisabled = key === 'par5_bogey' && !isPar5;
    const isChecked = hole[key] && !isDisabled;
    
    togglesHTML += `
      <div class="toggle-card ${isDisabled ? 'disabled' : ''} ${isChecked ? 'active' : ''}" data-metric="${key}">
        <div class="toggle-card-info">
          <span class="toggle-title">${label.title}</span>
          <span class="toggle-subtitle">${label.subtitle}</span>
        </div>
        <div class="toggle-control">
          <input type="checkbox" id="chk-${key}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
          <label for="chk-${key}"></label>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="hole-header">
      <div class="hole-nav-arrow" id="btn-hole-prev" ${round.currentHole === 1 ? 'style="visibility: hidden;"' : ''}>
        ←
      </div>
      <div class="hole-title-group">
        <span class="hole-label">Hole</span>
        <h1 class="hole-number">${round.currentHole}</h1>
        <span class="hole-total">of ${round.totalHoles}</span>
      </div>
      <div class="hole-nav-arrow" id="btn-hole-next-header" ${round.currentHole === round.totalHoles ? 'style="visibility: hidden;"' : ''}>
        →
      </div>
    </div>

    <!-- Par Selector Segmented Control -->
    <div class="par-selector-container">
      <label class="section-label">Hole Par</label>
      <div class="segmented-control">
        <button class="segment-btn ${hole.par === 3 ? 'active' : ''}" data-par="3">Par 3</button>
        <button class="segment-btn ${hole.par === 4 ? 'active' : ''}" data-par="4">Par 4</button>
        <button class="segment-btn ${hole.par === 5 ? 'active' : ''}" data-par="5">Par 5</button>
      </div>
    </div>

    <!-- Avoidable Errors Grid -->
    <div class="errors-container">
      <label class="section-label">Avoidable Errors (Tiger 5)</label>
      <div class="toggles-grid">
        ${togglesHTML}
      </div>
    </div>

    <!-- Navigation & Completion buttons -->
    <div class="active-nav-actions">
      ${round.currentHole < round.totalHoles 
        ? `<button class="btn btn-primary btn-lg btn-full" id="btn-hole-next">Next Hole</button>`
        : `<button class="btn btn-accent btn-lg btn-full" id="btn-finish-prompt">Finish Round</button>`
      }
      <button class="btn btn-danger-text btn-full text-center" id="btn-finish-abort">
        Finish &amp; Save Round Early
      </button>
    </div>
  `;

  // Bind Events for Active Hole View

  // 1. Hole navigation buttons
  const prevBtn = document.getElementById('btn-hole-prev');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      triggerHaptic();
      saveHoleState();
      round.currentHole--;
      saveCurrentRound();
      renderActiveHole();
    });
  }

  const nextBtnHeader = document.getElementById('btn-hole-next-header');
  if (nextBtnHeader) {
    nextBtnHeader.addEventListener('click', () => {
      triggerHaptic();
      saveHoleState();
      round.currentHole++;
      saveCurrentRound();
      renderActiveHole();
    });
  }

  const nextBtnFooter = document.getElementById('btn-hole-next');
  if (nextBtnFooter) {
    nextBtnFooter.addEventListener('click', () => {
      triggerHaptic();
      saveHoleState();
      round.currentHole++;
      saveCurrentRound();
      renderActiveHole();
    });
  }

  const finishPrompt = document.getElementById('btn-finish-prompt');
  if (finishPrompt) {
    finishPrompt.addEventListener('click', () => {
      triggerHaptic();
      saveHoleState();
      if (confirm('Complete and lock this round in history?')) {
        finishCurrentRound();
      }
    });
  }

  const abortBtn = document.getElementById('btn-finish-abort');
  if (abortBtn) {
    abortBtn.addEventListener('click', () => {
      triggerHaptic();
      saveHoleState();
      if (confirm(`Do you want to save and finish this round early at Hole ${round.currentHole}?`)) {
        // Cut the round short to the current hole
        round.holes = round.holes.slice(0, round.currentHole);
        round.totalHoles = round.currentHole;
        finishCurrentRound();
      }
    });
  }

  // 2. Par selection segmented buttons
  container.querySelectorAll('.segment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      triggerHaptic();
      const selectedPar = parseInt(e.currentTarget.getAttribute('data-par'));
      hole.par = selectedPar;
      
      // If par is not 5, make sure par 5 bogey is checked off/disabled
      if (selectedPar !== 5) {
        hole.par5_bogey = false;
      }
      
      saveCurrentRound();
      // Rerender the active hole screen to enable/disable the Par 5 toggle
      renderActiveHole();
    });
  });

  // 3. Toggle click listeners (clicking the whole card should toggle)
  container.querySelectorAll('.toggle-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.currentTarget.classList.contains('disabled')) return;
      
      // Prevent double triggers if clicking the checkbox/label directly
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') {
        return;
      }
      
      triggerHaptic();
      const metric = e.currentTarget.getAttribute('data-metric');
      const checkbox = document.getElementById(`chk-${metric}`);
      checkbox.checked = !checkbox.checked;
      
      // Update UI classes
      if (checkbox.checked) {
        e.currentTarget.classList.add('active');
      } else {
        e.currentTarget.classList.remove('active');
      }
      
      hole[metric] = checkbox.checked;
      saveCurrentRound();
    });
  });

  // Checkbox direct change binding
  container.querySelectorAll('.toggle-control input').forEach(input => {
    input.addEventListener('change', (e) => {
      triggerHaptic();
      const metric = e.currentTarget.id.replace('chk-', '');
      const card = e.currentTarget.closest('.toggle-card');
      
      if (e.currentTarget.checked) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
      
      hole[metric] = e.currentTarget.checked;
      saveCurrentRound();
    });
  });

  // Read visual checkboxes state and save into state
  function saveHoleState() {
    METRIC_KEYS.forEach(key => {
      const checkbox = document.getElementById(`chk-${key}`);
      if (checkbox && !checkbox.disabled) {
        hole[key] = checkbox.checked;
      } else {
        hole[key] = false;
      }
    });
  }
}

// 3. Round Summary View
function showRoundSummary(roundId) {
  const round = state.rounds.find(r => r.id === roundId);
  if (!round) {
    showScreen('screen-dashboard');
    return;
  }

  const container = document.getElementById('summary-content');
  if (!container) return;

  const stats = calculateRoundStats(round);

  // Verdict text generation
  let verdict = '';
  if (stats.totalEvents === 0) {
    verdict = 'A perfect round! 0 Tiger 5 events. Absolutely stellar golf!';
  } else {
    const leakName = METRIC_LABELS[stats.biggestLeak]?.title || 'errors';
    if (parseFloat(stats.index) < 4.0) {
      verdict = `${stats.totalEvents} events over ${stats.holesPlayed} holes. Brilliant scoring efficiency! Keep it up.`;
    } else if (parseFloat(stats.index) < 8.0) {
      verdict = `${stats.totalEvents} events over ${stats.holesPlayed} holes. Decent round, but ${leakName} held you back today.`;
    } else {
      verdict = `${stats.totalEvents} events over ${stats.holesPlayed} holes. A tough round — your main leak was ${leakName}. Plan your practice here.`;
    }
  }

  // Create list of holes list review
  let holeReviewHTML = '';
  round.holes.forEach(h => {
    let holeErrors = [];
    METRIC_KEYS.forEach(key => {
      if (h[key] && (key !== 'par5_bogey' || h.par === 5)) {
        holeErrors.push(METRIC_LABELS[key].title);
      }
    });

    const errorTags = holeErrors.map(err => `<span class="badge-tag">${err}</span>`).join(' ');
    
    holeReviewHTML += `
      <div class="summary-hole-row">
        <div class="hole-num-col">Hole ${h.holeNumber} <span class="par-tag">Par ${h.par}</span></div>
        <div class="hole-errors-col">
          ${holeErrors.length > 0 ? errorTags : '<span class="text-success text-small font-semibold">Clean Hole ✓</span>'}
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="card card-summary-header text-center">
      <h2 class="course-title">${round.courseName}</h2>
      <div class="summary-meta">${round.date} • ${round.holes.length} Holes Played</div>
      
      <!-- Big Score Index -->
      <div class="summary-index-container">
        <div class="index-circle">
          <span class="index-score">${stats.index}</span>
          <span class="index-label">Index</span>
        </div>
        <div class="index-explanation">
          <strong>Tiger 5 Index</strong><br>
          Normalized events per 18 holes. Target is 0.0!
        </div>
      </div>

      <!-- Verdict -->
      <div class="summary-verdict">
        "${verdict}"
      </div>
    </div>

    <!-- Metrics Breakdown Card -->
    <div class="card">
      <h3 class="card-title">Avoidable Errors Breakdown</h3>
      <div class="breakdown-list">
        ${METRIC_KEYS.map(key => {
          const count = stats.metricsCount[key];
          const label = METRIC_LABELS[key].title;
          const isPar5Metric = key === 'par5_bogey';
          
          let displayCount = count.toString();
          if (isPar5Metric) {
            displayCount = stats.par5sCount > 0 ? `${count} (of ${stats.par5sCount})` : 'N/A';
          }
          
          return `
            <div class="breakdown-item">
              <span class="breakdown-label">${label}</span>
              <span class="breakdown-val ${count > 0 ? 'text-warning font-semibold' : 'text-muted-dark'}" style="font-size: 1.1rem;">
                ${displayCount}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Hole-by-Hole Review -->
    <div class="card">
      <h3 class="card-title">Hole-by-Hole Log</h3>
      <div class="summary-holes-list">
        ${holeReviewHTML}
      </div>
    </div>

    <!-- Actions -->
    <div class="button-container">
      <button class="btn btn-primary btn-lg btn-full" id="btn-summary-home">Back to Dashboard</button>
      <button class="btn btn-secondary btn-full" id="btn-summary-delete">Delete Round Record</button>
    </div>
  `;

  // Bind Buttons
  document.getElementById('btn-summary-home').addEventListener('click', () => {
    triggerHaptic();
    renderDashboard();
    showScreen('screen-dashboard');
  });

  document.getElementById('btn-summary-delete').addEventListener('click', () => {
    triggerHaptic();
    if (confirm('Delete this round permanently? This cannot be undone.')) {
      state.rounds = state.rounds.filter(r => r.id !== round.id);
      saveRounds();
      renderDashboard();
      showScreen('screen-dashboard');
    }
  });

  showScreen('screen-summary');
}

// 4. Trends and History View
function renderTrendsView() {
  const container = document.getElementById('trends-content');
  if (!container) return;

  const currentYear = new Date().getFullYear();
  const years = [...new Set(state.rounds.map(r => new Date(r.date).getFullYear()))];
  if (years.length === 0 || !years.includes(currentYear)) {
    years.push(currentYear);
  }
  years.sort((a, b) => b - a);

  // Group selector
  let yearDropdown = `
    <div class="form-group" style="margin-bottom: 1.5rem;">
      <label for="trends-year-select">Select Season</label>
      <select id="trends-year-select" class="form-control">
        ${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y} Season</option>`).join('')}
      </select>
    </div>
  `;

  container.innerHTML = `
    ${yearDropdown}
    
    <!-- Dynamic Chart Section -->
    <div class="card" id="chart-trends-card">
      <h3 class="card-title">Tiger 5 Index History</h3>
      <div class="chart-container" id="svg-trends-chart">
        <!-- SVG will be injected here -->
      </div>
    </div>

    <div class="card" id="chart-leaks-card">
      <h3 class="card-title">Recurring Leaks (Events per 18 Holes)</h3>
      <div class="chart-container" id="svg-leaks-chart">
        <!-- SVG will be injected here -->
      </div>
    </div>

    <!-- History list -->
    <div class="card">
      <h3 class="card-title">Rounds History</h3>
      <div class="history-list" id="rounds-history-list">
        <!-- History rows will be injected here -->
      </div>
    </div>

    <div class="button-container" style="margin-top: 2rem;">
      <button class="btn btn-primary btn-full" id="btn-trends-home">Back to Dashboard</button>
    </div>
  `;

  // Bind Selector Event
  const selector = document.getElementById('trends-year-select');
  selector.addEventListener('change', (e) => {
    updateSeasonGraphs(parseInt(e.target.value));
  });

  document.getElementById('btn-trends-home').addEventListener('click', () => {
    triggerHaptic();
    renderDashboard();
    showScreen('screen-dashboard');
  });

  // Initial render of charts for current year
  updateSeasonGraphs(currentYear);
}

function updateSeasonGraphs(year) {
  const filteredRounds = state.rounds
    .filter(r => new Date(r.date).getFullYear() === year)
    .sort((a, b) => new Date(a.date) - new Date(b.date)); // Chronological for line chart

  const trendsContainer = document.getElementById('svg-trends-chart');
  const leaksContainer = document.getElementById('svg-leaks-chart');
  const listContainer = document.getElementById('rounds-history-list');

  // 1. Render rounds list (sorted newest first)
  const historyList = [...filteredRounds].reverse();
  if (historyList.length === 0) {
    listContainer.innerHTML = '<p class="text-center text-muted py-4">No rounds logged in this season.</p>';
  } else {
    listContainer.innerHTML = historyList.map(r => {
      const stats = calculateRoundStats(r);
      return `
        <div class="history-row" data-round-id="${r.id}">
          <div class="history-info">
            <span class="history-course">${r.courseName}</span>
            <span class="history-meta">${r.date} • ${r.holes.length} holes</span>
          </div>
          <div class="history-badge">
            <span class="badge-index">${stats.index}</span>
            <span class="chevron">›</span>
          </div>
        </div>
      `;
    }).join('');

    // Bind clicks to history rows
    listContainer.querySelectorAll('.history-row').forEach(row => {
      row.addEventListener('click', (e) => {
        triggerHaptic();
        const rid = e.currentTarget.getAttribute('data-round-id');
        showRoundSummary(rid);
      });
    });
  }

  // 2. Render SVG Line Chart (Tiger 5 Index over time)
  if (filteredRounds.length === 0) {
    trendsContainer.innerHTML = '<div class="chart-placeholder">Play rounds to see trend line</div>';
    leaksContainer.innerHTML = '<div class="chart-placeholder">Play rounds to see leak analysis</div>';
    return;
  }

  // Draw Line Chart
  // Canvas width: 340, height: 180
  const width = 340;
  const height = 180;
  const padding = 25;
  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);

  // Extract indexes
  const dataPoints = filteredRounds.map(r => parseFloat(calculateRoundStats(r).index));
  
  // Calculate scaling
  const maxVal = Math.max(10, Math.ceil(Math.max(...dataPoints))); // Keep scale at least 0-10
  const minVal = 0;
  
  const getX = (index) => {
    if (dataPoints.length <= 1) return padding + (chartWidth / 2);
    return padding + (index / (dataPoints.length - 1)) * chartWidth;
  };
  
  const getY = (val) => {
    return height - padding - ((val - minVal) / (maxVal - minVal)) * chartHeight;
  };

  // Generate SVG code
  let gridLines = '';
  // Draw horizontal lines (4 subdivisions)
  for (let i = 0; i <= 4; i++) {
    const val = minVal + (i / 4) * (maxVal - minVal);
    const y = getY(val);
    gridLines += `
      <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4,4" />
      <text x="${padding - 5}" y="${y + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">${val.toFixed(0)}</text>
    `;
  }

  let linePoints = '';
  let dots = '';
  dataPoints.forEach((val, idx) => {
    const x = getX(idx);
    const y = getY(val);
    linePoints += `${x},${y} `;
    
    // Add dot for each point
    dots += `
      <circle cx="${x}" cy="${y}" r="4" fill="var(--accent-color)" stroke="var(--card-bg)" stroke-width="2" />
      <text x="${x}" y="${y - 8}" font-size="9" fill="var(--text-primary)" font-weight="bold" text-anchor="middle">${val.toFixed(1)}</text>
    `;
  });

  const pathD = `M ${linePoints.trim().replace(/ /g, ' L ')}`;
  // Build area fill path
  const areaD = `M ${getX(0)},${height - padding} L ${linePoints} L ${getX(dataPoints.length - 1)},${height - padding} Z`;

  trendsContainer.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%">
      <defs>
        <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent-color)" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="var(--accent-color)" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      
      <!-- Grid -->
      ${gridLines}
      
      <!-- Area Fill -->
      ${dataPoints.length > 0 ? `<path d="${areaD}" fill="url(#chart-area-grad)" />` : ''}
      
      <!-- Trend Line -->
      ${dataPoints.length > 0 ? `<path d="${pathD}" fill="none" stroke="var(--accent-color)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      
      <!-- Data Dots -->
      ${dots}
      
      <!-- X-axis Labels (Round markers) -->
      ${filteredRounds.map((r, idx) => {
        const x = getX(idx);
        return `<text x="${x}" y="${height - 5}" font-size="9" fill="var(--text-muted)" text-anchor="middle">R${idx + 1}</text>`;
      }).join('')}
    </svg>
  `;

  // 3. Render Leaks Horizontal Bar Chart
  // Normalization: sum(metric_occurrences) / sum(holes_played) * 18
  const seasonStats = getSeasonSummary(year);
  const totalHoles = seasonStats.totalHoles || 1;
  
  const leakData = METRIC_KEYS.map(key => {
    const rate = (seasonStats.metricsCount[key] / totalHoles) * 18;
    return {
      key,
      title: METRIC_LABELS[key].title,
      rate: parseFloat(rate.toFixed(1)),
      count: seasonStats.metricsCount[key]
    };
  });

  // Sort by rate descending (biggest leak first)
  leakData.sort((a, b) => b.rate - a.rate);

  const maxRate = Math.max(2.0, Math.max(...leakData.map(d => d.rate)));

  let barsHTML = '';
  leakData.forEach((item, index) => {
    const percentageWidth = (item.rate / maxRate) * 100;
    
    // Choose styling based on rank
    const barClass = index === 0 && item.rate > 0 ? 'bar-fill bar-warning' : 'bar-fill';
    
    barsHTML += `
      <div class="bar-chart-row">
        <div class="bar-chart-labels">
          <span class="bar-title">${item.title}</span>
          <span class="bar-legend-val">${item.rate} <span class="legend-unit">/18 holes</span></span>
        </div>
        <div class="bar-track">
          <div class="${barClass}" style="width: ${percentageWidth}%"></div>
        </div>
        <div class="bar-meta">Logged ${item.count} times</div>
      </div>
    `;
  });

  leaksContainer.innerHTML = `
    <div class="bar-chart-container">
      ${barsHTML}
    </div>
  `;
}

// 5. Settings View
function renderSettingsView() {
  const container = document.getElementById('settings-content');
  if (!container) return;

  container.innerHTML = `
    <!-- Theme Selection -->
    <div class="card">
      <h3 class="card-title">App Settings</h3>
      <div class="form-group">
        <label for="theme-select">Visual Theme</label>
        <select id="theme-select" class="form-control">
          <option value="system">System Default</option>
          <option value="light">Light Theme (Sunlight Optimized)</option>
          <option value="dark">Dark Theme (Forest Night)</option>
        </select>
      </div>
    </div>

    <!-- Data Backup & Sync -->
    <div class="card">
      <h3 class="card-title">Backup &amp; Data Safety</h3>
      <p class="card-desc">All stats are stored locally on your device. Export a backup to save elsewhere, or import to restore your history.</p>
      
      <div class="button-stack">
        <button class="btn btn-secondary btn-full" id="btn-export-json">
          📥 Export Backup Data (JSON)
        </button>
        <button class="btn btn-secondary btn-full" id="btn-export-csv">
          📊 Export Spreadsheet Data (CSV)
        </button>
        <label class="btn btn-secondary btn-full text-center" style="display: block; cursor: pointer; margin-top: 0.5rem;">
          📤 Import Backup File
          <input type="file" id="file-import-json" accept=".json" style="display: none;">
        </label>
      </div>
    </div>

    <!-- Clear database -->
    <div class="card card-destructive">
      <h3 class="card-title text-danger">Reset Application</h3>
      <p class="card-desc text-danger">Permanently erase all rounds and history from this device. This cannot be undone.</p>
      <button class="btn btn-danger btn-full" id="btn-reset-data">Clear All Data</button>
    </div>

    <div class="button-container" style="margin-top: 2rem;">
      <button class="btn btn-primary btn-full" id="btn-settings-home">Back to Dashboard</button>
    </div>
  `;

  // Bind Theme Selector
  const themeSelect = document.getElementById('theme-select');
  themeSelect.value = state.theme;
  themeSelect.addEventListener('change', (e) => {
    triggerHaptic();
    saveThemeSetting(e.target.value);
  });

  // Bind Export/Import
  document.getElementById('btn-export-json').addEventListener('click', () => {
    triggerHaptic();
    exportJSONData();
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    triggerHaptic();
    exportCSVData();
  });

  document.getElementById('file-import-json').addEventListener('change', (e) => {
    triggerHaptic();
    const file = e.target.files[0];
    if (file) {
      importJSONData(file);
    }
  });

  document.getElementById('btn-reset-data').addEventListener('click', () => {
    triggerHaptic();
    if (confirm('DANGER: Erase all golf records? This will delete your entire history permanently.')) {
      if (confirm('Confirm again: Are you absolutely certain you want to wipe all records?')) {
        localStorage.clear();
        state.rounds = [];
        state.currentRound = null;
        state.theme = 'system';
        applyTheme('system');
        alert('All app data has been reset.');
        renderDashboard();
        showScreen('screen-dashboard');
      }
    }
  });

  document.getElementById('btn-settings-home').addEventListener('click', () => {
    triggerHaptic();
    renderDashboard();
    showScreen('screen-dashboard');
  });
}

// --- DATA IMPORT / EXPORT UTILITIES ---

function exportJSONData() {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    theme: state.theme,
    rounds: state.rounds
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `palm_golf_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCSVData() {
  if (state.rounds.length === 0) {
    alert('No round data available to export.');
    return;
  }

  // Headers
  let csvContent = 'round_id,date,course_name,holes_played,tiger_5_index,double_bogeys,par5_bogeys,three_putts,wedge_misses,double_chips\n';
  
  state.rounds.forEach(r => {
    const stats = calculateRoundStats(r);
    const row = [
      r.id,
      r.date,
      `"${r.courseName.replace(/"/g, '""')}"`,
      stats.holesPlayed,
      stats.index,
      stats.metricsCount.double_bogey,
      stats.metricsCount.par5_bogey,
      stats.metricsCount.three_putt,
      stats.metricsCount.wedge_green_miss,
      stats.metricsCount.double_chip
    ].join(',');
    csvContent += row + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `palm_golf_stats_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importJSONData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && Array.isArray(data.rounds)) {
        // Simple validation of rounds structure
        state.rounds = data.rounds;
        if (data.theme) {
          state.theme = data.theme;
          applyTheme(state.theme);
        }
        saveRounds();
        alert(`Successfully imported ${data.rounds.length} round records!`);
        renderDashboard();
        showScreen('screen-dashboard');
      } else {
        alert('Invalid backup file. Could not find valid round records.');
      }
    } catch (err) {
      console.error(err);
      alert('Error parsing JSON backup file. Please make sure it is a valid backup file.');
    }
  };
  reader.readAsText(file);
}

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  // Load State
  loadState();

  // Draw Dashboard
  renderDashboard();

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('[Service Worker] Registered successfully', reg.scope))
        .catch((err) => console.error('[Service Worker] Registration failed', err));
    });
  }

  // Setup view: Date defaults to today
  document.getElementById('setup-date').value = new Date().toISOString().split('T')[0];

  // Bind setup round start button
  document.getElementById('btn-setup-start').addEventListener('click', () => {
    triggerHaptic();
    const course = document.getElementById('setup-course').value;
    const date = document.getElementById('setup-date').value;
    const holes = document.getElementById('setup-holes').value;
    startNewRound(course, date, holes);
  });

  // Bind setup cancel button
  document.getElementById('btn-setup-cancel').addEventListener('click', () => {
    triggerHaptic();
    showScreen('screen-dashboard');
  });
});
