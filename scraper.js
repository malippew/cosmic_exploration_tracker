/**
 * FFXIVCosmicScraper - Une classe pour récupérer et traiter les données 
 * d'exploration cosmique de FFXIV Lodestone
 */
class FFXIVCosmicScraper {
    /**
     * Constructeur
     * @param {string} url - URL pour scraper les données (optionnel)
     */
    constructor(url = null) {
        this.url = url || "https://eu.finalfantasyxiv.com/lodestone/cosmic_exploration/report/";
        this.htmlContent = null;
        this.data = [];
        this.proxy = "https://api.allorigins.win/raw?url=";
    }

    /**
     * Récupère le contenu HTML depuis l'URL
     * @returns {Promise<boolean>} - Succès ou échec de la récupération
     */
    async fetchHtml() {
        try {
            // Utilisation d'un proxy CORS pour contourner les restrictions
            const response = await fetch(`${this.proxy}${encodeURIComponent(this.url)}`);

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            this.htmlContent = await response.text();
            return true;
        } catch (error) {
            console.error(`Erreur lors de la récupération des données: ${error}`);
            return false;
        }
    }

    /**
     * Parse une valeur de jauge à partir d'une classe CSS
     * @param {string} gaugeClass - Classe CSS pour la jauge (ex. 'gauge-3', 'gauge-max')
     * @returns {number} - Valeur en pourcentage (0-1.0)
     */
    parseGaugeValue(gaugeClass) {
        if (!gaugeClass) {
            return 0.0;
        }

        if (gaugeClass.includes('gauge-max')) {
            return 1.0;
        }

        const match = gaugeClass.match(/gauge-(\d+)/);
        if (match) {
            const gaugeValue = parseInt(match[1]);
            // Convertir en pourcentage (échelle 0-7 = 0-87.5%)
            return gaugeValue / 8.0;
        }

        return 0.0;
    }

    /**
     * Crée un DOM temporaire à partir du HTML
     * @param {string} html - Contenu HTML
     * @returns {Document} - Document DOM
     */
    createDOM(html) {
        const parser = new DOMParser();
        return parser.parseFromString(html, 'text/html');
    }

    /**
     * Récupère et analyse les données d'exploration cosmique
     * @returns {Promise<Array>} - Liste des données de serveur
     */
    async scrape() {
        if (!this.htmlContent && !(await this.fetchHtml())) {
            console.error("Aucun contenu HTML disponible à analyser");
            return [];
        }

        const dom = this.createDOM(this.htmlContent);
        const dataCenters = dom.querySelectorAll('div[id][class="cosmic__report__dc"]');

        const result = [];

        dataCenters.forEach(dc => {
            const dcName = dc.querySelector('.cosmic__report__dc__title').textContent.trim();
            const servers = dc.querySelectorAll('.cosmic__report__card');

            servers.forEach(server => {
                const serverName = server.querySelector('.cosmic__report__card__name').textContent.trim();

                // Récupérer le grade (niveau)
                const gradeElement = server.querySelector('.cosmic__report__grade__level');
                let grade = gradeElement ? parseInt(gradeElement.querySelector('p').textContent.trim()) : 0;

                // Récupérer le texte de statut
                const statusText = server.querySelector('.cosmic__report__status__text').textContent.trim();

                if (statusText.toLowerCase().includes('complete')) {
                    grade -= 1;
                }

                // Récupérer la valeur de la jauge
                const progressBar = server.querySelector('.cosmic__report__status__progress__bar');
                let gaugeClass = progressBar && progressBar.classList ?
                    Array.from(progressBar.classList).filter(c => c.startsWith('gauge-')).pop() : 'gauge-0';

                const transition = server.querySelector('.cosmic__report__status__progress');
                const transitionP = transition ? transition.querySelector('p') : null;

                if (transitionP) {
                    gaugeClass = 'gauge-max';
                }

                const progressPercentage = this.parseGaugeValue(gaugeClass);

                const serverData = {
                    serverName: serverName,
                    dataCenter: dcName,
                    grade: grade,
                    progressPercentage: progressPercentage,
                    rawGauge: gaugeClass,
                    statusText: statusText
                };

                result.push(serverData);
            });
        });

        this.data = result;
        return result;
    }

    /**
     * Crée un classement basé sur le grade et le pourcentage de progression
     * @param {string} dataCenter - Filtre optionnel pour afficher uniquement les serveurs d'un data center
     * @returns {Array} - Tableau de classement
     */
    createRanking(dataCenter = null) {
        if (!this.data || this.data.length === 0) {
            return [];
        }

        // Copier les données
        let data = [...this.data];

        // Filtrer par data center si spécifié
        if (dataCenter && dataCenter !== 'all') {
            data = data.filter(item => item.dataCenter === dataCenter);
        }

        // Trier par grade (décroissant) et progressPercentage (décroissant)
        data.sort((a, b) => {
            if (a.grade !== b.grade) {
                return b.grade - a.grade;
            }
            return b.progressPercentage - a.progressPercentage;
        });

        // Créer un classement approprié avec rang dense (tenant compte des égalités)
        let rank = 1;
        let currentPosition = 0;
        let currentKey = null;
        const rankMapping = {};

        // Regrouper les données par grade et pourcentage de progression
        const groupCounts = new Map();
        data.forEach(item => {
            const key = `${item.grade}_${item.progressPercentage}`;
            if (groupCounts.has(key)) {
                groupCounts.set(key, groupCounts.get(key) + 1);
            } else {
                groupCounts.set(key, 1);
            }
        });

        // Générer les rangs en tenant compte des égalités
        const sortedGroups = Array.from(groupCounts.entries()).sort((a, b) => {
            const [keyA, _] = a;
            const [keyB, __] = b;
            const [gradeA, progressA] = keyA.split('_').map(Number);
            const [gradeB, progressB] = keyB.split('_').map(Number);

            if (gradeA !== gradeB) {
                return gradeB - gradeA;
            }
            return progressB - progressA;
        });

        sortedGroups.forEach(([key, count]) => {
            const [grade, progress] = key.split('_').map(Number);

            if (currentKey !== key) {
                currentKey = key;
                rankMapping[key] = rank;
                currentPosition += count;
                rank = currentPosition + 1;
            } else {
                rankMapping[key] = rank;
            }
        });

        // Appliquer le mappage des rangs
        data.forEach(item => {
            const key = `${item.grade}_${item.progressPercentage}`;
            item.rank = rankMapping[key];
            // Formater le pourcentage pour l'affichage
            item.progress = `${(item.progressPercentage * 100).toFixed(2)}%`;
        });

        // Trier par rang pour l'affichage
        data.sort((a, b) => a.rank - b.rank);

        return data;
    }

    /**
     * Obtient la liste des data centers uniques
     * @returns {Array} - Liste des data centers
     */
    getDataCenters() {
        if (!this.data || this.data.length === 0) {
            return [];
        }

        const dataCenters = new Set();
        this.data.forEach(item => dataCenters.add(item.dataCenter));
        return Array.from(dataCenters).sort();
    }
}