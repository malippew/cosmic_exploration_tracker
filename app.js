"use strict"

/**
 * FFXIV Cosmic Exploration Monitor
 * Application principale pour afficher et mettre à jour les données d'exploration cosmique
 */

import { FFXIVCosmicScraper } from "./scraper.js";
import { calculateNextUpdateTime, formatDateTime, formatTimeRemaining } from "./utils.js";

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
            serverSearch: '',
            refreshInProgress: false
        };
        this.lastDiffs = {};
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
            serverSearch: document.getElementById('serverSearch'),
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
        this.dom.serverSearch.addEventListener('input', () => {
            this.state.serverSearch = this.dom.serverSearch.value.trim();
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

    getFilteredRanking() {
        let ranking = this.scraper.createRanking(this.state.selectedDataCenter);
        if (this.state.serverSearch && this.state.serverSearch.length > 0) {
            const search = this.state.serverSearch.toLowerCase();
            ranking = ranking.filter(row => row.serverName.toLowerCase().includes(search));
        }
        return ranking;
    }

    getTotalPages() {
        const ranking = this.getFilteredRanking();
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
        const ranking = this.getFilteredRanking();
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
            const diffs = this.lastCalculatedDiffs[row.serverName] || {};

            let gradeChange = '';
            let progressChange = '';

            if (diffs.gradeChanged) {
                gradeChange = `<span class="change-indicator" title="Grade précédent: ${row.grade - 1}">★</span>`;
            }
            if (diffs.progressDiff > 0) {
                progressChange = `<span class="change-indicator up" title="+${diffs.progressDiff.toFixed(2)}%">↑</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${row.rank}</td>
                <td>${row.serverName}</td>
                <td>${row.dataCenter}</td>
                <td>${row.grade} ${gradeChange}</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${row.progress}"></div>
                    </div>
                    ${row.progress} ${progressChange}
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

        // Retirer 30 minutes par rapport au next Update
        this.state.lastUpdateTime = new Date(calculateNextUpdateTime().getTime() - 30 * 60 * 1000);
        this.state.nextUpdateTime = calculateNextUpdateTime();

        this.dom.lastUpdateTime.textContent = formatDateTime(this.state.lastUpdateTime);
        this.dom.nextUpdateTime.textContent = formatDateTime(this.state.nextUpdateTime);
        this.dom.countdownTimer.textContent = formatTimeRemaining((this.state.nextUpdateTime - this.state.lastUpdateTime) / 1000);

        try {
            await this.scraper.fetchHtml();
            await this.scraper.scrape();

            const ranking = this.scraper.createRanking('all');

            let previousRankingState = {};
            try {
                previousRankingState = JSON.parse(localStorage.getItem('previousRankingState') || '{}');
            } catch (e) {
                previousRankingState = {};
            }

            // Récupérer les différences stockées précédemment (important pour les rechargements de page)
            try {
                this.lastCalculatedDiffs = JSON.parse(localStorage.getItem('lastCalculatedDiffs') || '{}');
            } catch (e) {
                this.lastCalculatedDiffs = {};
            }

            // Vérifier si nous avons changé de cycle de mise à jour
            const currentCycle = this.getCurrentCycle();
            const lastCycle = localStorage.getItem('lastUpdateCycle');

            const cycleChanged = !lastCycle || currentCycle !== lastCycle;

            if (cycleChanged) {
                console.log(`Nouveau cycle détecté: ${currentCycle} (précédent: ${lastCycle})`);

                // Calculer les nouvelles différences uniquement si le cycle a changé
                this.lastCalculatedDiffs = {};
                ranking.forEach(row => {
                    const prev = previousRankingState[row.serverName];
                    let gradeChanged = false;
                    let progressDiff = 0;
                    if (prev) {
                        if (row.grade !== prev.grade) {
                            gradeChanged = true;
                        }
                        if (prev.progressNum !== row.progressNum) {
                            progressDiff = row.progressNum - prev.progressNum;
                        }
                    }
                    this.lastCalculatedDiffs[row.serverName] = {
                        gradeChanged,
                        progressDiff
                    };
                });

                // Stocker les nouvelles différences calculées pour les prochains rechargements de page
                localStorage.setItem('lastCalculatedDiffs', JSON.stringify(this.lastCalculatedDiffs));
                localStorage.setItem('lastUpdateCycle', currentCycle);

                // Mettre à jour l'état de référence pour le prochain cycle
                const stateToStore = {};
                ranking.forEach(row => {
                    stateToStore[row.serverName] = {
                        grade: row.grade,
                        progressNum: row.progressPercentage * 100
                    };
                });
                localStorage.setItem('previousRankingState', JSON.stringify(stateToStore));
            } else {
                console.log(`Toujours dans le même cycle: ${currentCycle}, utilisation des différences déjà calculées`);
            }

            // Rempliy les data center dans le drop down
            this.populateDataCenterFilter();
            this.displayPagination();

            if (this.state.countdownInterval) clearInterval(this.state.countdownInterval);
            this.state.countdownInterval = setInterval(this.updateCountdown, 1000);
            this.updateCountdown();
        } catch (error) {
            console.error('Erreur lors de la mise à jour des données:', error);
            this.dom.rankingTableBody.innerHTML = `<tr><td colspan="6" class="error"><i class="fas fa-exclamation-triangle"></i> Erreur lors de la récupération des données. Veuillez réessayer.</td></tr>`;
        } finally {
            this.state.refreshInProgress = false;
        }
    }
    getCurrentCycle() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        let cycleMinutes;
        let cycleHours = hours;

        if (minutes >= 2 && minutes < 32) {
            cycleMinutes = "02";
        } else if (minutes >= 32) {
            cycleMinutes = "32";
        } else { // minutes 0-1
            cycleMinutes = "32";
            cycleHours = (hours - 1 + 24) % 24;
        }

        // Format: YYYY-MM-DD-HH:MM
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}-${cycleHours.toString().padStart(2, '0')}:${cycleMinutes}`;
    }

    init() {
        this.state.serverSearch = '';
        this.updateAndDisplay();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CosmicApp();
});