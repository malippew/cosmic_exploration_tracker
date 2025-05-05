"use strict"

/**
 * FFXIVCosmicScraper - Une classe pour récupérer et traiter les données 
 * d'exploration cosmique de FFXIV Lodestone
 */

import { safeQuery } from "./utils.js"

export class FFXIVCosmicScraper {
    /**
     * Constructeur
     * @param {string} url - URL pour scraper les données (optionnel)
     */
    constructor(url = null) {
        this.url = url || "https://eu.finalfantasyxiv.com/lodestone/cosmic_exploration/report";
        this.htmlContent = null;
        this.data = [];
    }

    /**
     * Récupère le contenu HTML depuis l'URL
     * @returns {Promise<boolean>} - Succès ou échec de la récupération
     */
    async fetchHtml() {
        // Liste de proxys CORS à essayer
        const proxies = [
            "https://api.allorigins.win/raw?url=",
            "https://corsproxy.io/?url=",
        ];
        let lastError = null;
        // Ajout d'un cache buster pour éviter le cache proxy
        const cacheBuster = `?_t=${Date.now()}`;
        for (const proxy of proxies) {
            try {
                // Ajoute le cache buster à l'URL du Lodestone
                const urlWithBuster = this.url + cacheBuster;
                const urlToFetch = proxy + encodeURIComponent(urlWithBuster);

                const response = await fetch(urlToFetch);
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                this.htmlContent = await response.text();
                this.proxy = proxy; // Mémorise le proxy qui fonctionne
                return true;
            } catch (error) {
                lastError = error;
                // Essaye le proxy suivant
            }
        }
        console.error(`Erreur lors de la récupération des données via tous les proxys: ${lastError}`);
        return false;
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
        return new DOMParser().parseFromString(html, 'text/html');
    }

    /**
     * Récupère et analyse les données d'exploration cosmique
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
            const dcName = safeQuery(dc, '.cosmic__report__dc__title');
            dc.querySelectorAll('.cosmic__report__card').forEach(server => {
                const serverName = safeQuery(server, '.cosmic__report__card__name');

                // Récupérer le grade (niveau)
                let grade = 0;
                const gradeElement = server.querySelector('.cosmic__report__grade__level p');
                if (gradeElement) grade = parseInt(gradeElement.textContent.trim());

                // Récupérer le texte de statut
                const statusText = safeQuery(server, '.cosmic__report__status__text');

                if (statusText.toLowerCase().includes('complete')) {
                    grade -= 1;
                }

                // Récupérer la valeur de la jauge
                let gaugeClass = 'gauge-0';
                const progressBar = server.querySelector('.cosmic__report__status__progress__bar');
                if (progressBar && progressBar.classList) {
                    const found = Array.from(progressBar.classList).find(c => c.startsWith('gauge-'));
                    if (found) gaugeClass = found;
                }

                const transitionP = server.querySelector('.cosmic__report__status__progress p');
                if (transitionP) gaugeClass = 'gauge-max';

                const progressPercentage = this.parseGaugeValue(gaugeClass);

                const serverData = {
                    serverName,
                    dataCenter: dcName,
                    grade,
                    progressPercentage,
                    rawGauge: gaugeClass,
                    statusText
                };

                result.push(serverData);
            });
        });
        this.data = result;
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
        data.sort((a, b) => b.grade - a.grade || b.progressPercentage - a.progressPercentage);

        // Créer un classement approprié avec rang dense (tenant compte des égalités)
        let rank = 1;
        let currentPosition = 0;
        let currentKey = null;
        const rankMapping = {};
        const groupCounts = new Map();

        // Regrouper les données par grade et pourcentage de progression
        data.forEach(item => {
            const key = `${item.grade}_${item.progressPercentage}`;
            groupCounts.set(key, (groupCounts.get(key) || 0) + 1);
        });

        // Générer les rangs en tenant compte des égalités
        const sortedGroups = Array.from(groupCounts.entries()).sort((a, b) => {
            const [gradeA, progressA] = a[0].split('_').map(Number);
            const [gradeB, progressB] = b[0].split('_').map(Number);

            return gradeB - gradeA || progressB - progressA;
        });

        sortedGroups.forEach(([key, count]) => {
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

        return Array.from(new Set(this.data.map(item => item.dataCenter))).sort();
    }
}