/**
 * FFXIV Cosmic Exploration Monitor
 * Application principale pour afficher et mettre à jour les données d'exploration cosmique
 */
document.addEventListener('DOMContentLoaded', () => {
    // Éléments DOM
    const lastUpdateTimeEl = document.getElementById('lastUpdateTime');
    const nextUpdateTimeEl = document.getElementById('nextUpdateTime');
    const countdownTimerEl = document.getElementById('countdownTimer');
    const datacenterFilterEl = document.getElementById('datacenterFilter');
    const rankingTableBodyEl = document.getElementById('rankingTableBody');
    const prevPageEl = document.getElementById('prevPage');
    const nextPageEl = document.getElementById('nextPage');
    const paginationInfoEl = document.getElementById('paginationInfo');

    // État de l'application
    const state = {
        scraper: new FFXIVCosmicScraper(),
        lastUpdateTime: null,
        nextUpdateTime: null,
        countdownInterval: null,
        currentPage: 1,
        itemsPerPage: 10,
        selectedDataCenter: 'all',
        refreshInProgress: false
    };

    /**
     * Calcule le prochain temps de mise à jour planifiée
     * @returns {Date} - Prochain temps de mise à jour
     */
    function calculateNextUpdateTime() {
        const now = new Date();
        const currentMinute = now.getMinutes();
        let nextUpdate;

        if (currentMinute > 2 && currentMinute < 32) {
            // Prochaine mise à jour à XX:32
            nextUpdate = new Date(now);
            nextUpdate.setMinutes(32);
            nextUpdate.setSeconds(0);
            nextUpdate.setMilliseconds(0);
        } else if (currentMinute >= 32) {
            // Prochaine mise à jour à l'heure suivante
            nextUpdate = new Date(now);
            nextUpdate.setHours(now.getHours() + 1);
            nextUpdate.setMinutes(2);
            nextUpdate.setSeconds(0);
            nextUpdate.setMilliseconds(0);
        } else {
            // Prochaine mise à jour à l'heure actuelle
            nextUpdate = new Date(now);
            nextUpdate.setMinutes(2);
            nextUpdate.setSeconds(0);
            nextUpdate.setMilliseconds(0);
        }

        return nextUpdate;
    }

    /**
     * Formate le temps restant en minutes:secondes
     * @param {number} seconds - Secondes à formater
     * @returns {string} - Temps formaté
     */
    function formatTimeRemaining(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Met à jour le compte à rebours
     */
    function updateCountdown() {
        if (!state.nextUpdateTime) return;

        const now = new Date();
        const timeRemaining = (state.nextUpdateTime - now) / 1000;

        if (timeRemaining <= 0) {
            // L'heure de mise à jour est passée, rafraîchir les données
            if (!state.refreshInProgress) {
                updateAndDisplay();
            }
            return;
        }

        countdownTimerEl.textContent = formatTimeRemaining(timeRemaining);
    }

    /**
     * Formate une date en chaîne lisible
     * @param {Date} date - Date à formater
     * @returns {string} - Date formatée
     */
    function formatDateTime(date) {
        return date.toLocaleString('fr-FR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Affiche les données de classement paginées
     */
    function displayPagination() {
        // Obtenir les données de classement filtrées
        const ranking = state.scraper.createRanking(state.selectedDataCenter);

        if (!ranking || ranking.length === 0) {
            rankingTableBodyEl.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">Aucune donnée disponible</td>
                </tr>
            `;
            prevPageEl.disabled = true;
            nextPageEl.disabled = true;
            paginationInfoEl.textContent = 'Page 0 de 0';
            return;
        }

        // Calculer les infos de pagination
        const totalItems = ranking.length;
        const totalPages = Math.ceil(totalItems / state.itemsPerPage);

        // S'assurer que la page actuelle est valide
        state.currentPage = Math.max(1, Math.min(state.currentPage, totalPages));

        // Calculer les indices de début et de fin pour la page actuelle
        const startIdx = (state.currentPage - 1) * state.itemsPerPage;
        const endIdx = Math.min(startIdx + state.itemsPerPage, totalItems);

        // Obtenir les données pour la page actuelle
        const pageData = ranking.slice(startIdx, endIdx);

        // Vider le tableau
        rankingTableBodyEl.innerHTML = '';

        // Ajouter chaque ligne au tableau
        pageData.forEach(row => {
            // Déterminer la classe CSS pour le statut
            const statusClass = row.statusText.toLowerCase().includes('complete') ?
                'status-complete' : 'status-progress';

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
            rankingTableBodyEl.appendChild(tr);
        });

        // Mettre à jour l'état des boutons de pagination
        prevPageEl.disabled = state.currentPage === 1;
        nextPageEl.disabled = state.currentPage === totalPages;

        // Mettre à jour l'info de pagination
        paginationInfoEl.textContent = `Page ${state.currentPage} de ${totalPages}`;
    }

    /**
     * Ajoute les options de data center au filtre
     */
    function populateDataCenterFilter() {
        const dataCenters = state.scraper.getDataCenters();

        // Conserver l'option "Tous les Data Centers"
        datacenterFilterEl.innerHTML = '<option value="all">Tous les Data Centers</option>';

        // Ajouter chaque data center comme option
        dataCenters.forEach(dc => {
            const option = document.createElement('option');
            option.value = dc;
            option.textContent = dc;
            datacenterFilterEl.appendChild(option);
        });

        // Restaurer la sélection précédente
        datacenterFilterEl.value = state.selectedDataCenter;
    }

    /**
     * Met à jour les données et affiche les résultats
     */
    async function updateAndDisplay() {
        // Éviter les mises à jour simultanées
        if (state.refreshInProgress) return;

        state.refreshInProgress = true;

        try {
            // Récupérer de nouvelles données
            await state.scraper.fetchHtml();
            await state.scraper.scrape();

            // Mettre à jour les informations de temps
            state.lastUpdateTime = new Date();
            state.nextUpdateTime = calculateNextUpdateTime();

            // Mettre à jour l'interface utilisateur
            lastUpdateTimeEl.textContent = formatDateTime(state.lastUpdateTime);
            nextUpdateTimeEl.textContent = formatDateTime(state.nextUpdateTime);

            // Mettre à jour les filtres de data center
            populateDataCenterFilter();

            // Afficher les données paginées
            displayPagination();

            // Démarrer le compte à rebours
            if (state.countdownInterval) {
                clearInterval(state.countdownInterval);
            }
            state.countdownInterval = setInterval(updateCountdown, 1000);
            updateCountdown();

            // Enregistrer l'heure de la dernière mise à jour dans le stockage local
            localStorage.setItem('lastUpdateTime', state.lastUpdateTime.toISOString());

        } catch (error) {
            console.error('Erreur lors de la mise à jour des données:', error);

            // Afficher une erreur dans le tableau
            rankingTableBodyEl.innerHTML = `
                <tr>
                    <td colspan="6" class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        Erreur lors de la récupération des données. Veuillez réessayer.
                    </td>
                </tr>
            `;
        } finally {
            // Réactiver le bouton de rafraîchissement
            state.refreshInProgress = false;
        }
    }

    /**
     * Gestionnaires d'événements
     */
    datacenterFilterEl.addEventListener('change', () => {
        state.selectedDataCenter = datacenterFilterEl.value;
        state.currentPage = 1;
        displayPagination();
    });

    prevPageEl.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            displayPagination();
        }
    });

    nextPageEl.addEventListener('click', () => {
        if (state.currentPage < totalPages) {
            state.currentPage++;
            displayPagination();
        }
    })
    updateAndDisplay(); // Initialiser l'affichage des données
});