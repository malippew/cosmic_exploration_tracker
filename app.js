/**
 * FFXIV Cosmic Exploration Tracker
 * Application JavaScript principale
 */

// Données des planètes
const COSMIC_PLANETS = [
    {
        id: "sinus-ardorum",
        name: "Sinus Ardorum",
        patch: "7.21",
        isActive: true,
        url: "https://eu.finalfantasyxiv.com/lodestone/cosmic_exploration/report"
    },
    {
        id: "planet-2",
        name: "Planet 2",
        patch: "7.3X",
        isActive: false
    },
    {
        id: "planet-3",
        name: "Planet 3",
        patch: "7.4X",
        isActive: false
    },
    {
        id: "planet-4",
        name: "Planet 4",
        patch: "7.5X",
        isActive: false
    }
];

// État de l'application
const state = {
    data: [],
    dataCenters: [],
    lastUpdated: null,
    isLoading: false,
    isError: false,
    dataCenter: 'all',
    viewMode: 'table',
    activePlanet: COSMIC_PLANETS[0].id,
    currentPlanet: COSMIC_PLANETS[0],
    darkMode: localStorage.getItem('darkTheme') === 'true'
};

// DOM Elements
const domElements = {
    themeToggle: document.getElementById('theme-toggle'),
    refreshBtn: document.getElementById('refresh-btn'),
    lastUpdated: document.getElementById('last-updated'),
    datacenterSelect: document.getElementById('datacenter-select'),
    tableViewBtn: document.getElementById('table-view-btn'),
    gridViewBtn: document.getElementById('grid-view-btn'),
    tableBody: document.getElementById('table-body'),
    gridView: document.getElementById('grid-view'),
    dataCount: document.getElementById('data-count'),
    dataSummary: document.getElementById('data-summary'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    retryBtn: document.getElementById('retry-btn'),
    comingSoon: document.getElementById('coming-soon'),
    contentContainer: document.getElementById('content-container'),
    currentYear: document.getElementById('current-year'),
    tableView: document.getElementById('table-view'),
};

// Initialize
function init() {
    // Set current year in footer
    domElements.currentYear.textContent = new Date().getFullYear();

    // Set dark mode
    if (state.darkMode) {
        document.body.classList.add('dark-theme');
        domElements.themeToggle.querySelector('.material-icons').textContent = 'light_mode';
    }

    // Setup event listeners
    setupEventListeners();

    // Load data
    loadCosmicData();
}

// Setup Event Listeners
function setupEventListeners() {
    // Theme Toggle
    domElements.themeToggle.addEventListener('click', toggleTheme);

    // Refresh Button
    domElements.refreshBtn.addEventListener('click', () => {
        loadCosmicData(true);
    });

    // Retry Button
    domElements.retryBtn.addEventListener('click', () => {
        loadCosmicData(true);
    });

    // Data Center Select
    domElements.datacenterSelect.addEventListener('change', (e) => {
        state.dataCenter = e.target.value;
        updateUI();
    });

    // View Toggle
    domElements.tableViewBtn.addEventListener('click', () => {
        state.viewMode = 'table';
        updateViewMode();
    });

    domElements.gridViewBtn.addEventListener('click', () => {
        state.viewMode = 'grid';
        updateViewMode();
    });

    // Planet Tabs
    const tabButtons = document.querySelectorAll('.tab-item');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (button.disabled) return;

            // Update active tab
            tabButtons.forEach(tab => tab.classList.remove('active'));
            button.classList.add('active');

            // Update active planet
            const planetId = button.dataset.planet;
            state.activePlanet = planetId;
            state.currentPlanet = COSMIC_PLANETS.find(p => p.id === planetId);

            updatePlanetContent();
        });
    });
}

// Toggle Theme
function toggleTheme() {
    state.darkMode = !state.darkMode;
    localStorage.setItem('darkTheme', state.darkMode);

    if (state.darkMode) {
        document.body.classList.add('dark-theme');
        domElements.themeToggle.querySelector('.material-icons').textContent = 'light_mode';
    } else {
        document.body.classList.remove('dark-theme');
        domElements.themeToggle.querySelector('.material-icons').textContent = 'dark_mode';
    }
}

// Update View Mode
function updateViewMode() {
    // Update buttons
    domElements.tableViewBtn.classList.toggle('active', state.viewMode === 'table');
    domElements.gridViewBtn.classList.toggle('active', state.viewMode === 'grid');

    // Update view containers
    domElements.tableView.classList.toggle('hidden', state.viewMode !== 'table');
    domElements.gridView.classList.toggle('hidden', state.viewMode !== 'grid');
}

// Update Planet Content
function updatePlanetContent() {
    if (!state.currentPlanet.isActive) {
        // Show coming soon for inactive planets
        domElements.loading.classList.add('hidden');
        domElements.error.classList.add('hidden');
        domElements.contentContainer.classList.add('hidden');
        domElements.comingSoon.classList.remove('hidden');

        // Update coming soon message with planet info
        const messageElement = domElements.comingSoon.querySelector('.coming-soon-message');
        messageElement.textContent = `Data for ${state.currentPlanet.name} will be available in Patch ${state.currentPlanet.patch}`;
    } else {
        // Load data for active planet
        domElements.comingSoon.classList.add('hidden');
        loadCosmicData();
    }
}

// Format time difference
function formatTimeDiff(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 120) return '1 hour ago';
    return `${Math.floor(diffMins / 60)} hours ago`;
}

// Load Cosmic Data
async function loadCosmicData(forceRefresh = false) {
    try {
        state.isLoading = true;
        state.isError = false;
        updateLoadingState();

        // Create scraper instance
        const scraper = new FFXIVCosmicScraper(state.currentPlanet.url);

        // Fetch data
        await scraper.scrape();

        // Get data centers and rankings
        state.dataCenters = scraper.getDataCenters();
        state.data = scraper.createRanking();
        state.lastUpdated = new Date();

        // Update data centers dropdown
        updateDataCentersDropdown();

        state.isLoading = false;
        updateUI();
    } catch (error) {
        console.error('Error loading cosmic data:', error);
        state.isLoading = false;
        state.isError = true;
        updateLoadingState();
    }
}

// Update Data Centers Dropdown
function updateDataCentersDropdown() {
    // Clear all options except 'all'
    const selectElement = domElements.datacenterSelect;
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    // Add data centers
    state.dataCenters.forEach(dc => {
        const option = document.createElement('option');
        option.value = dc;
        option.textContent = dc;
        selectElement.appendChild(option);
    });
}

// Update Loading State
function updateLoadingState() {
    // Handle loading state
    domElements.loading.classList.toggle('hidden', !state.isLoading);

    // Handle error state
    domElements.error.classList.toggle('hidden', !state.isError);

    // Handle content
    domElements.contentContainer.classList.toggle('hidden', state.isLoading || state.isError);

    // Update refresh button
    domElements.refreshBtn.disabled = state.isLoading;
    domElements.refreshBtn.querySelector('span:not(.material-icons)').textContent =
        state.isLoading ? 'Refreshing...' : 'Refresh';
    domElements.refreshBtn.querySelector('.material-icons').textContent =
        state.isLoading ? 'hourglass_empty' : 'refresh';

    // Update last updated
    if (state.lastUpdated) {
        domElements.lastUpdated.textContent = `Last updated: ${formatTimeDiff(state.lastUpdated)}`;
    }
}

// Update UI with current state
function updateUI() {
    updateLoadingState();

    // Filter data by selected data center
    const filteredData = state.data.filter(
        server => state.dataCenter === 'all' || server.dataCenter === state.dataCenter
    );

    // Update data count
    domElements.dataCount.textContent = filteredData.length;
    domElements.dataSummary.classList.toggle('hidden', filteredData.length === 0);

    // Update table view
    updateTableView(filteredData);

    // Update grid view
    updateGridView(filteredData);

    // Update view mode
    updateViewMode();
}

// Get progress bar segments HTML
function getProgressBarSegments(server) {
    const segments = [];
    const filledSegments = Math.ceil(server.progressPercentage * 8);
    const isComplete = server.statusText.toLowerCase().includes('complete') || server.progressPercentage >= 1.0;

    for (let i = 0; i < 8; i++) {
        const isFilled = i < filledSegments;
        const classes = [
            'progress-segment',
            isFilled ? 'filled' : '',
            isFilled && isComplete ? 'complete' : ''
        ].filter(Boolean).join(' ');

        segments.push(`<div class="${classes}"></div>`);
    }

    return segments.join('');
}

// Update Table View
function updateTableView(data) {
    domElements.tableBody.innerHTML = '';

    data.forEach(server => {
        const row = document.createElement('tr');

        // Rank
        const rankCell = document.createElement('td');
        rankCell.innerHTML = `<div class="rank-badge">${server.rank}</div>`;

        // Server
        const serverCell = document.createElement('td');
        serverCell.innerHTML = `<div class="server-name">${server.serverName}</div>`;

        // Data Center
        const dcCell = document.createElement('td');
        dcCell.innerHTML = `<div class="data-center">${server.dataCenter}</div>`;

        // Grade
        const gradeCell = document.createElement('td');
        gradeCell.innerHTML = `<div class="grade">${server.grade}</div>`;

        // Progress
        const progressCell = document.createElement('td');
        progressCell.innerHTML = `
      <div class="progress-info">
        <div class="progress-header">
          <span class="progress-status">${server.statusText}</span>
          <span class="progress-value">${server.progress}</span>
        </div>
        <div class="progress-bar">
          ${getProgressBarSegments(server)}
        </div>
      </div>
    `;

        // Add cells to row
        row.appendChild(rankCell);
        row.appendChild(serverCell);
        row.appendChild(dcCell);
        row.appendChild(gradeCell);
        row.appendChild(progressCell);

        // Add row to table
        domElements.tableBody.appendChild(row);
    });
}

// Update Grid View
function updateGridView(data) {
    domElements.gridView.innerHTML = '';

    data.forEach(server => {
        const card = document.createElement('div');
        card.className = 'server-card';

        card.innerHTML = `
      <div class="card-header">
        <div>
          <h3 class="card-title">${server.serverName}</h3>
          <div class="card-datacenter">${server.dataCenter}</div>
        </div>
        <div class="card-rank">${server.rank}</div>
      </div>
      <div class="card-body">
        <div class="card-stats">
          <div>
            <span class="card-grade-label">Grade:</span>
            <span class="card-grade-value">${server.grade}</span>
          </div>
          <div class="card-progress-value">${server.progress}</div>
        </div>
        <div class="card-progress-bar">
          ${getProgressBarSegments(server)}
        </div>
        <div class="card-status">${server.statusText}</div>
      </div>
    `;

        domElements.gridView.appendChild(card);
    });
}

// Update last updated text periodically
setInterval(() => {
    if (state.lastUpdated) {
        domElements.lastUpdated.textContent = `Last updated: ${formatTimeDiff(state.lastUpdated)}`;
    }
}, 60000); // Update every minute

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);