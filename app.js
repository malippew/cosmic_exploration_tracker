/**
 * FFXIV Cosmic Exploration Monitor
 * Application principale pour afficher et mettre à jour les données d'exploration cosmique
 */

// Utility functions
const formatDateTime = date => date.toLocaleString('fr-FR', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
});

const formatTimeRemaining = seconds => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const calculateNextUpdateTime = () => {
    const now = new Date();
    const min = now.getMinutes();
    const next = new Date(now);
    if (min > 2 && min < 32) {
        next.setMinutes(32, 0, 0);
    } else if (min >= 32) {
        next.setHours(now.getHours() + 1, 2, 0, 0);
    } else {
        next.setMinutes(2, 0, 0);
    }
    return next;
};

// Main app logic
class CosmicApp {
    constructor() {
        this.scraper = new FFXIVCosmicScraper();
        this.state = {
            lastUpdateTime: null,
            nextUpdateTime: null,
            countdownInterval: null,
            currentPage: 1,
            itemsPerPage: 10,
            selectedDataCenter: 'all',
            refreshInProgress: false
        };
        this.cacheDom();
        this.addEventListeners();
        this.init();
    }

    cacheDom() {
        this.dom = {
            lastUpdateTime: document.getElementById('lastUpdateTime'),
            nextUpdateTime: document.getElementById('nextUpdateTime'),
            countdownTimer: document.getElementById('countdownTimer'),
            datacenterFilter: document.getElementById('datacenterFilter'),
            rankingTableBody: document.getElementById('rankingTableBody'),
            prevPage: document.getElementById('prevPage'),
            nextPage: document.getElementById('nextPage'),
            paginationInfo: document.getElementById('paginationInfo')
        };
    }

    addEventListeners() {
        this.dom.datacenterFilter.addEventListener('change', () => {
            this.state.selectedDataCenter = this.dom.datacenterFilter.value;
            this.state.currentPage = 1;
            this.displayPagination();
        });
        this.dom.prevPage.addEventListener('click', () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                this.displayPagination();
            }
        });
        this.dom.nextPage.addEventListener('click', () => {
            const totalPages = this.getTotalPages();
            if (this.state.currentPage < totalPages) {
                this.state.currentPage++;
                this.displayPagination();
            }
        });
    }

    getTotalPages() {
        const ranking = this.scraper.createRanking(this.state.selectedDataCenter);
        return Math.max(1, Math.ceil(ranking.length / this.state.itemsPerPage));
    }

    updateCountdown = () => {
        if (!this.state.nextUpdateTime) return;
        const now = new Date();
        const timeRemaining = (this.state.nextUpdateTime - now) / 1000;
        if (timeRemaining <= 0) {
            if (!this.state.refreshInProgress) this.updateAndDisplay();
            return;
        }
        this.dom.countdownTimer.textContent = formatTimeRemaining(timeRemaining);
    };

    populateDataCenterFilter() {
        const dataCenters = this.scraper.getDataCenters();
        this.dom.datacenterFilter.innerHTML = '<option value="all">Tous les Data Centers</option>';
        dataCenters.forEach(dc => {
            const option = document.createElement('option');
            option.value = dc;
            option.textContent = dc;
            this.dom.datacenterFilter.appendChild(option);
        });
        this.dom.datacenterFilter.value = this.state.selectedDataCenter;
    }

    displayPagination() {
        const ranking = this.scraper.createRanking(this.state.selectedDataCenter);
        if (!ranking || ranking.length === 0) {
            this.dom.rankingTableBody.innerHTML = `<tr><td colspan="6" class="no-data">Aucune donnée disponible</td></tr>`;
            this.dom.prevPage.disabled = true;
            this.dom.nextPage.disabled = true;
            this.dom.paginationInfo.textContent = 'Page 0 de 0';
            return;
        }
        const totalItems = ranking.length;
        const totalPages = this.getTotalPages();
        this.state.currentPage = Math.max(1, Math.min(this.state.currentPage, totalPages));
        const startIdx = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const endIdx = Math.min(startIdx + this.state.itemsPerPage, totalItems);
        const pageData = ranking.slice(startIdx, endIdx);
        this.dom.rankingTableBody.innerHTML = '';
        pageData.forEach(row => {
            const statusClass = row.statusText.toLowerCase().includes('complete') ? 'status-complete' : 'status-progress';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${row.rank}</td>
                <td>${row.serverName}</td>
                <td>${row.dataCenter}</td>
                <td>${row.grade}</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${row.progress}"></div>
                    </div>
                    ${row.progress}
                </td>
                <td class="${statusClass}">${row.statusText}</td>
            `;
            this.dom.rankingTableBody.appendChild(tr);
        });
        this.dom.prevPage.disabled = this.state.currentPage === 1;
        this.dom.nextPage.disabled = this.state.currentPage === totalPages;
        this.dom.paginationInfo.textContent = `Page ${this.state.currentPage} de ${totalPages}`;
    }

    async updateAndDisplay() {
        if (this.state.refreshInProgress) return;
        this.state.refreshInProgress = true;
        try {
            await this.scraper.fetchHtml();
            await this.scraper.scrape();
            this.state.lastUpdateTime = new Date();
            this.state.nextUpdateTime = calculateNextUpdateTime();
            this.dom.lastUpdateTime.textContent = formatDateTime(this.state.lastUpdateTime);
            this.dom.nextUpdateTime.textContent = formatDateTime(this.state.nextUpdateTime);
            this.populateDataCenterFilter();
            this.displayPagination();
            if (this.state.countdownInterval) clearInterval(this.state.countdownInterval);
            this.state.countdownInterval = setInterval(this.updateCountdown, 1000);
            this.updateCountdown();
            localStorage.setItem('lastUpdateTime', this.state.lastUpdateTime.toISOString());
        } catch (error) {
            console.error('Erreur lors de la mise à jour des données:', error);
            this.dom.rankingTableBody.innerHTML = `<tr><td colspan="6" class="error"><i class="fas fa-exclamation-triangle"></i> Erreur lors de la récupération des données. Veuillez réessayer.</td></tr>`;
        } finally {
            this.state.refreshInProgress = false;
        }
    }

    init() {
        this.updateAndDisplay();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CosmicApp();
});