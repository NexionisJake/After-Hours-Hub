// src/security-utils.js
// === CENTRALIZED SECURITY UTILITIES ===

/**
 * Secure text sanitization to prevent XSS
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
export function sanitizeText(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}


/**
 * Enhanced input validation
 * @param {string} text - Text to validate
 * @param {number} maxLength - Maximum allowed length
 * @param {RegExp} pattern - Optional regex pattern to match
 * @returns {Object} - Validation result with isValid boolean and error message
 */
export function validateInput(text, maxLength = 500, pattern = null) {
    const result = { isValid: false, error: '' };
    
    if (!text || typeof text !== 'string') {
        result.error = 'Input is required and must be text';
        return result;
    }
    
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        result.error = 'Input cannot be empty';
        return result;
    }
    
    if (trimmed.length > maxLength) {
        result.error = `Input must be ${maxLength} characters or less`;
        return result;
    }
    
    if (pattern && !pattern.test(trimmed)) {
        result.error = 'Input format is invalid';
        return result;
    }
    
    // Check for potential XSS patterns
    const xssPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe/gi,
        /<object/gi,
        /<embed/gi
    ];
    
    for (const xssPattern of xssPatterns) {
        if (xssPattern.test(text)) {
            result.error = 'Input contains potentially harmful content';
            return result;
        }
    }
    
    result.isValid = true;
    return result;
}

/**
 * Enhanced error handler with user-friendly messages
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @param {boolean} showToUser - Whether to show error to user
 */
export function handleError(error, context = 'Unknown', showToUser = true) {
    // Log full error for debugging
    console.error(`Error in ${context}:`, error);
    
    // Determine user-friendly message
    let userMessage = 'An unexpected error occurred. Please try again.';
    
    if (error.code) {
        switch (error.code) {
            case 'permission-denied':
                userMessage = 'You don\'t have permission to perform this action.';
                break;
            case 'unauthenticated':
                userMessage = 'Please sign in to continue.';
                break;
            case 'not-found':
                userMessage = 'The requested item was not found.';
                break;
            case 'already-exists':
                userMessage = 'This item already exists.';
                break;
            case 'resource-exhausted':
                userMessage = 'Service is temporarily busy. Please try again later.';
                break;
            case 'invalid-argument':
                userMessage = 'Invalid input provided. Please check your data.';
                break;
            default:
                userMessage = 'A technical error occurred. Please try again.';
        }
    }
    
    if (showToUser) {
        showErrorMessage(userMessage);
    }
    
    return userMessage;
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showErrorMessage(message) {
    // Create or update error message element
    let errorEl = document.getElementById('global-error-message');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'global-error-message';
        errorEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            word-wrap: break-word;
        `;
        document.body.appendChild(errorEl);
    }
    
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }, 5000);
}

/**
 * Rate limiting utility class
 */
class RateLimiter {
    constructor(limit, timeWindow) {
        this.limit = limit;
        this.timeWindow = timeWindow;
        this.timestamps = {};
    }
    
    isAllowed(key) {
        const now = Date.now();
        const userTimestamps = this.timestamps[key] || [];
        
        // Filter out timestamps that are outside the time window
        const recentTimestamps = userTimestamps.filter(timestamp => now - timestamp < this.timeWindow);
        
        if (recentTimestamps.length >= this.limit) {
            // Rate limit exceeded
            return false;
        }
        
        // Add the new timestamp and update the record
        recentTimestamps.push(now);
        this.timestamps[key] = recentTimestamps;
        
        return true;
    }
    
    getRemainingTime(key) {
        const now = Date.now();
        const userTimestamps = this.timestamps[key] || [];
        
        // Filter out timestamps that are outside the time window
        const recentTimestamps = userTimestamps.filter(timestamp => now - timestamp < this.timeWindow);
        
        if (recentTimestamps.length < this.limit) {
            return 0; // No rate limit active
        }
        
        // Return the time until the oldest timestamp expires
        const oldestTimestamp = Math.min(...recentTimestamps);
        const remainingTime = this.timeWindow - (now - oldestTimestamp);
        return Math.max(0, remainingTime);
    }
}

/**
 * Rate limiting for messaging to prevent spam
 */
const MESSAGE_LIMIT = 5; // Max 5 messages
const MESSAGE_TIME_WINDOW = 10 * 1000; // within 10 seconds

export const messagingRateLimit = new RateLimiter(MESSAGE_LIMIT, MESSAGE_TIME_WINDOW);

/**
 * Rate limiting for request creation to prevent spam
 */
const REQUEST_LIMIT = 3; // Max 3 requests
const REQUEST_TIME_WINDOW = 5 * 60 * 1000; // within 5 minutes

export const requestRateLimit = new RateLimiter(REQUEST_LIMIT, REQUEST_TIME_WINDOW);
