"use strict"

/**
 * Safely queries a DOM element and returns its trimmed text content.
 * @param {Element} parent - The parent DOM element to query within.
 * @param {string} selector - The CSS selector to match the child element.
 * @returns {string} The trimmed text content of the matched element, or an empty string if not found.
 */
export function safeQuery(parent, selector) {
    const el = parent.querySelector(selector);
    return el ? el.textContent.trim() : '';
}

/**
 * Formats a Date object into a French locale date and time string.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date and time string in 'fr-FR' locale.
 */
export const formatDateTime = date => date.toLocaleString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
});

/**
 * Formats a number of seconds as a MM:SS string.
 * @param {number} seconds - The number of seconds to format.
 * @returns {string} The formatted time string in MM:SS format.
 */
export const formatTimeRemaining = seconds => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Calculates the next update time based on the current time.
 * - If current minutes are between 2 and 31, returns the next :32.
 * - If current minutes are 32 or more, returns the next hour at :02.
 * - Otherwise, returns the next :02.
 * @returns {Date} The Date object representing the next update time.
 */
export const calculateNextUpdateTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const nextCycle = new Date(now);

    if (minutes >= 2 && minutes < 32) {
        nextCycle.setMinutes(32, 0, 0);
    } else if (minutes >= 32) {
        nextCycle.setHours(now.getHours() + 1, 2, 0, 0);
    } else {
        nextCycle.setMinutes(2, 0, 0);
    }

    return nextCycle;
};