const examples = [
    "Corporate training for 50 people in Bangalore on June 10th. Budget ₹1.5 lakhs.",
    "Sales training for 40 people in Pune tomorrow. Budget ₹80,000. Basic requirements.",
    "Team offsite for 30 people in Goa next Friday. Budget 2 lakhs. Need vegetarian food.",
    "Team building workshop for 20 people in Chennai this weekend. Budget ₹60,000.",
    "Annual conference for 100 people in Delhi on March 20th. Budget ₹5 lakhs. Premium setup.",
    "Product launch event for 75 people in Mumbai next month. Budget ₹4 lakhs."
];

let currentEventPlan = null;
let originalInput = null;
let loadingStepTimer = null;
let isRefinementMode = false;
function setExample(index) {
    if (index >= 0 && index < examples.length) {
        document.getElementById('eventInput').value = examples[index];
        
        const input = document.getElementById('eventInput');
        input.style.background = '#f0f9ff';
        setTimeout(() => {
            input.style.background = '';
        }, 1000);
        
        resetRefinementMode();
    }
}
async function generatePlan() {
    const input = document.getElementById('eventInput').value.trim();
    const tweakInput = document.getElementById('tweakInput');
    const tweakPrompt = tweakInput ? tweakInput.value.trim() : null;
    
    if (!input) {
        showNotification('Please describe your event first!', 'warning');
        document.getElementById('eventInput').focus();
        return;
    }

    if (input.length < 10) {
        showNotification('Please provide more details about your event (at least 10 characters)', 'warning');
        return;
    }

    if (!isRefinementMode) {
        originalInput = input;
    }

    showLoading();
    startLoadingSteps();

    try {
        const requestBody = { input };
        
        if (tweakPrompt) {
            requestBody.tweakPrompt = tweakPrompt;
        }

        const response = await fetch('/api/generate-event-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        if (result.success) {
            showResults(result);
            
            const qualityScore = result.summary?.qualityScore || result.qualityIndicators?.overallScore;
            const message = qualityScore ? 
                `Event plan generated successfully! Quality Score: ${qualityScore}/100` :
                'Event plan generated successfully!';
            
            showNotification(message, 'success');
            
            showRefinementSection();
            
        } else {
            showError(result.error || 'Failed to generate event plan');
            
            if (result.errorDetails && result.errorDetails.suggestions.length > 0) {
                console.log('Error suggestions:', result.errorDetails.suggestions);
            }
        }

    } catch (error) {
        console.error('Request failed:', error);
        showError('Network error. Please check your connection and try again.');
    } finally {
        stopLoadingSteps();
    }
}

async function refinePlan() {
    const tweakInput = document.getElementById('tweakInput');
    if (!tweakInput) {
        showNotification('Refinement input not found', 'error');
        return;
    }
    
    const tweakPrompt = tweakInput.value.trim();
    
    if (!tweakPrompt) {
        showNotification('Please provide refinement instructions', 'warning');
        tweakInput.focus();
        return;
    }

    if (!originalInput) {
        showNotification('No original plan to refine', 'error');
        return;
    }

    showLoading('Refining your plan...');
    startLoadingSteps();

    try {
        const response = await fetch('/api/refine-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                originalInput: originalInput,
                tweakPrompt: tweakPrompt
            })
        });

        const result = await response.json();

        if (result.success) {
            showResults(result);
            showNotification('Plan refined successfully!', 'success');
            
            // Clear the tweak input after successful refinement
            tweakInput.value = '';
        } else {
            showError(result.error || 'Failed to refine plan');
        }

    } catch (error) {
        console.error('Refinement failed:', error);
        showError('Network error during refinement. Please try again.');
    } finally {
        stopLoadingSteps();
    }
}

/**
 * Show loading section with custom message
 */
function showLoading(message = 'Generating your event plan...') {
    document.getElementById('inputSection').style.display = 'none';
    document.getElementById('loading').style.display = 'block';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';
    
    // Update loading message
    const loadingText = document.querySelector('.loading-content h3');
    if (loadingText) {
        loadingText.textContent = message;
    }
}

/**
 * Start animated loading steps
 */
function startLoadingSteps() {
    const steps = ['step1', 'step2', 'step3'];
    let currentStep = 0;

    // Reset all steps
    steps.forEach(stepId => {
        const element = document.getElementById(stepId);
        if (element) {
            element.classList.remove('active');
        }
    });
    
    // Start with first step
    const firstStep = document.getElementById(steps[0]);
    if (firstStep) {
        firstStep.classList.add('active');
    }

    loadingStepTimer = setInterval(() => {
        const currentElement = document.getElementById(steps[currentStep]);
        if (currentElement) {
            currentElement.classList.remove('active');
        }
        
        currentStep = (currentStep + 1) % steps.length;
        
        const nextElement = document.getElementById(steps[currentStep]);
        if (nextElement) {
            nextElement.classList.add('active');
        }
    }, 2000);
}

/**
 * Stop loading step animation
 */
function stopLoadingSteps() {
    if (loadingStepTimer) {
        clearInterval(loadingStepTimer);
        loadingStepTimer = null;
    }
}

/**
 * Show results section with comprehensive data
 */
function showResults(result) {
    currentEventPlan = result;

    document.getElementById('loading').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';
    document.getElementById('inputSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'block';
    
    // Update generation time with additional info
    const timeElement = document.getElementById('generationTime');
    if (timeElement) {
        let timeText = `Generated in ${result.generationTime}`;
        if (result.cached) {
            timeText += ' (cached)';
        }
        if (result.summary?.isRefinement) {
            timeText += ' (refined)';
        }
        timeElement.textContent = timeText;
    }
    
    // Display the event plan
    const planElement = document.getElementById('eventPlan');
    if (planElement) {
        planElement.textContent = result.eventPlan || 'No plan generated';
    }
    
    // Display venues
    displayVenues(result.venues);
    
    // Display warnings if any
    if (result.warnings && result.warnings.length > 0) {
        displayWarnings(result.warnings);
    }
    
    // Scroll to results
    document.getElementById('resultSection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

/**
 * Display venue suggestions with enhanced data
 */
function displayVenues(venues) {
    const venuesSection = document.getElementById('venuesSection');
    const venuesList = document.getElementById('venuesList');
    
    if (!venues || venues.length === 0) {
        if (venuesSection) {
            venuesSection.style.display = 'none';
        }
        return;
    }
    
    if (venuesSection) {
        venuesSection.style.display = 'block';
    }
    
    if (venuesList) {
        venuesList.innerHTML = venues.map(venue => {
            let venueHtml = `
                <div class="venue-item">
                    <h4>${escapeHtml(venue.name)}</h4>
                    <p>${escapeHtml(venue.description || 'Professional venue with event facilities')}</p>
            `;
            
            // Add enhanced venue information if available
            if (venue.estimatedCostRange) {
                venueHtml += `<p class="venue-cost"><strong>Cost:</strong> ${escapeHtml(venue.estimatedCostRange)}</p>`;
            }
            
            if (venue.suitabilityScore) {
                venueHtml += `<p class="venue-score"><strong>Suitability:</strong> ${venue.suitabilityScore}%</p>`;
            }
            
            if (venue.capacityMatch) {
                venueHtml += `<p class="venue-capacity"><strong>Capacity:</strong> ${escapeHtml(venue.capacityMatch)}</p>`;
            }
            
            if (venue.features && venue.features.length > 0) {
                venueHtml += `<p class="venue-features"><strong>Features:</strong> ${venue.features.map(f => escapeHtml(f)).join(', ')}</p>`;
            }
            
            if (venue.bookingUrgency) {
                venueHtml += `<p class="venue-urgency"><strong>Booking:</strong> ${escapeHtml(venue.bookingUrgency)}</p>`;
            }
            
            if (venue.url && venue.url !== '#') {
                venueHtml += `<a href="${venue.url}" target="_blank" rel="noopener">View Details →</a>`;
            }
            
            venueHtml += `</div>`;
            return venueHtml;
        }).join('');
    }
}

/**
 * Display warnings section
 */
function displayWarnings(warnings) {
    if (!warnings || warnings.length === 0) return;
    
    const warningsHtml = `
        <div class="warnings-section">
            <h4>⚠️ Important Notes:</h4>
            <ul>
                ${warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}
            </ul>
        </div>
    `;
    
    // Insert warnings after generation time
    const timeElement = document.getElementById('generationTime');
    if (timeElement && timeElement.parentNode) {
        const warningsDiv = document.createElement('div');
        warningsDiv.innerHTML = warningsHtml;
        timeElement.parentNode.insertBefore(warningsDiv, timeElement.nextSibling);
    }
}

/**
 * Show refinement section
 */
function showRefinementSection() {
    const refinementHtml = `
        <div class="refinement-section" id="refinementSection">
            <h3>🔧 Refine Your Plan</h3>
            <div class="form-group">
                <label for="tweakInput">Additional requirements or changes:</label>
                <textarea 
                    id="tweakInput" 
                    placeholder="e.g., Make it more interactive with team building activities"
                    rows="2"
                ></textarea>
            </div>
            <button class="primary-btn" onclick="refinePlan()">
                <span class="btn-icon">✨</span>
                Refine Plan
            </button>
        </div>
    `;
    
    const resultActions = document.querySelector('.result-actions');
    if (resultActions && !document.getElementById('refinementSection')) {
        const refinementDiv = document.createElement('div');
        refinementDiv.innerHTML = refinementHtml;
        resultActions.parentNode.insertBefore(refinementDiv, resultActions);
        
        isRefinementMode = true;
    }
}

/**
 * Reset refinement mode
 */
function resetRefinementMode() {
    isRefinementMode = false;
    const refinementSection = document.getElementById('refinementSection');
    if (refinementSection) {
        refinementSection.remove();
    }
}

/**
 * Show error section
 */
function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('inputSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'block';
    
    const errorMessageElement = document.getElementById('errorMessage');
    if (errorMessageElement) {
        errorMessageElement.textContent = message;
    }
    
    document.getElementById('errorSection').scrollIntoView({ 
        behavior: 'smooth' 
    });
    
    showNotification(message, 'error');
}

/**
 * Start a new plan - reset to input section
 */
function newPlan() {
    document.getElementById('inputSection').style.display = 'block';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';
    document.getElementById('loading').style.display = 'none';
    
    document.getElementById('eventInput').value = '';
    document.getElementById('eventInput').focus();
    
    currentEventPlan = null;
    originalInput = null;
    resetRefinementMode();
    
    // Clear any existing warnings
    document.querySelectorAll('.warnings-section').forEach(el => el.remove());
    
    document.getElementById('inputSection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

/**
 * Refine requirements - populate input with current data
 */
function refineRequirements() {
    if (currentEventPlan && currentEventPlan.eventData) {
        const data = currentEventPlan.eventData;
        const refinedInput = `${data.eventType || 'event'} for ${data.numberOfAttendees || 'people'} people in ${data.location || 'location'} on ${data.date || 'date'}. Budget ₹${data.budgetInINR ? data.budgetInINR.toLocaleString() : 'budget'}${data.requirements && data.requirements.length > 0 ? '. ' + data.requirements.join(', ') : ''}.`;
        
        document.getElementById('eventInput').value = refinedInput;
        newPlan();
    } else {
        newPlan();
    }
}

/**
 * Download plan with enhanced content
 */
function downloadPlan() {
    if (!currentEventPlan) {
        showNotification('No plan to download', 'warning');
        return;
    }
    
    const content = formatPlanForDownload(currentEventPlan);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `corporate-event-plan-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Plan downloaded successfully!', 'success');
}

/**
 * Print plan
 */
function printPlan() {
    if (!currentEventPlan) {
        showNotification('No plan to print', 'warning');
        return;
    }
    
    window.print();
}

/**
 * Copy plan to clipboard
 */
async function copyPlan() {
    if (!currentEventPlan) {
        showNotification('No plan to copy', 'warning');
        return;
    }
    
    try {
        const content = formatPlanForDownload(currentEventPlan);
        await navigator.clipboard.writeText(content);
        showNotification('Plan copied to clipboard!', 'success');
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = formatPlanForDownload(currentEventPlan);
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Plan copied to clipboard!', 'success');
    }
}

/**
 * Share plan
 */
function sharePlan() {
    if (!currentEventPlan) {
        showNotification('No plan to share', 'warning');
        return;
    }
    
    if (navigator.share) {
        const eventData = currentEventPlan.eventData;
        const title = eventData ? 
            `${eventData.eventType} Event Plan - ${eventData.numberOfAttendees} people in ${eventData.location}` :
            'Corporate Event Plan';
            
        navigator.share({
            title: title,
            text: formatPlanForDownload(currentEventPlan),
        }).catch(err => {
            console.log('Error sharing:', err);
            copyPlan(); // Fallback to copy
        });
    } else {
        copyPlan(); // Fallback for browsers without Web Share API
    }
}

/**
 * Format plan for download/copy with comprehensive data
 */
function formatPlanForDownload(plan) {
    let content = `CORPORATE EVENT PLAN\n`;
    content += `Generated on: ${new Date().toLocaleDateString()}\n`;
    content += `Generation time: ${plan.generationTime}\n`;
    
    if (plan.summary?.isRefinement) {
        content += `Type: Refined Plan\n`;
    }
    
    content += `\n${'='.repeat(60)}\n\n`;
    
    if (plan.eventData) {
        content += `EVENT DETAILS:\n`;
        content += `- Type: ${plan.eventData.eventType || 'N/A'}\n`;
        content += `- Attendees: ${plan.eventData.numberOfAttendees || 'N/A'}\n`;
        content += `- Location: ${plan.eventData.location || 'N/A'}\n`;
        content += `- Date: ${plan.eventData.date || 'N/A'}\n`;
        content += `- Budget: ₹${plan.eventData.budgetInINR ? plan.eventData.budgetInINR.toLocaleString() : 'N/A'}\n`;
        content += `- Duration: ${plan.eventData.durationInHours || 'N/A'} hours\n`;
        if (plan.eventData.requirements && plan.eventData.requirements.length > 0) {
            content += `- Requirements: ${plan.eventData.requirements.join(', ')}\n`;
        }
        content += `\n`;
    }
    
    content += plan.eventPlan;
    
    if (plan.venues && Array.isArray(plan.venues) && plan.venues.length > 0) {
        content += `\n\n${'='.repeat(60)}\n`;
        content += `RECOMMENDED VENUES:\n\n`;
        plan.venues.forEach((venue, index) => {
            content += `${index + 1}. ${venue.name}\n`;
            if (venue.description) {
                content += `   Description: ${venue.description}\n`;
            }
            if (venue.estimatedCostRange) {
                content += `   Estimated Cost: ${venue.estimatedCostRange}\n`;
            }
            if (venue.suitabilityScore) {
                content += `   Suitability Score: ${venue.suitabilityScore}%\n`;
            }
            if (venue.features && venue.features.length > 0) {
                content += `   Features: ${venue.features.join(', ')}\n`;
            }
            if (venue.url && venue.url !== '#') {
                content += `   Website: ${venue.url}\n`;
            }
            content += `\n`;
        });
    }
    
    if (plan.warnings && plan.warnings.length > 0) {
        content += `\n${'='.repeat(60)}\n`;
        content += `IMPORTANT NOTES:\n`;
        plan.warnings.forEach((warning, index) => {
            content += `${index + 1}. ${warning}\n`;
        });
    }
    
    content += `\n${'='.repeat(60)}\n`;
    content += `Generated by Corporate Event Planner v2.0\n`;
    content += `${new Date().toISOString()}\n`;
    
    return content;
}

// Keep existing utility functions
function showExamples() {
    newPlan();
    document.querySelector('.examples-section').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function showApiDocs() {
    window.open('/api/docs', '_blank');
}

function showAbout() {
    showNotification('Corporate Event Planner v2.0 - Graph-based AI event planning', 'info');
}

function contactSupport() {
    const email = 'support@corporate-planner.com';
    window.location.href = `mailto:${email}?subject=Corporate Event Planner Support`;
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        max-width: 400px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function getNotificationColor(type) {
    const colors = {
        success: '#059669',
        error: '#dc2626',
        warning: '#d97706',
        info: '#2563eb'
    };
    return colors[type] || colors.info;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners and initialization
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('eventInput').focus();
    
    // Enhanced keyboard shortcuts
    document.getElementById('eventInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            generatePlan();
        }
    });
    
    // Add styles for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        .warnings-section {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
        }
        
        .warnings-section h4 {
            color: #d97706;
            margin-bottom: 0.5rem;
        }
        
        .warnings-section ul {
            margin: 0;
            padding-left: 1.5rem;
        }
        
        .refinement-section {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 1.5rem;
            margin: 1rem 0;
        }
        
        .refinement-section h3 {
            margin-bottom: 1rem;
            color: #374151;
        }
        
        .venue-cost, .venue-score, .venue-capacity, .venue-features, .venue-urgency {
            font-size: 0.875rem;
            margin: 0.25rem 0;
            color: #6b7280;
        }
    `;
    document.head.appendChild(style);
});

// Global keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newPlan();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && currentEventPlan) {
        e.preventDefault();
        downloadPlan();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'p' && currentEventPlan) {
        e.preventDefault();
        printPlan();
    }
});

// Network status handlers
window.addEventListener('online', () => {
    showNotification('Connection restored!', 'success');
});

window.addEventListener('offline', () => {
    showNotification('You are offline. Some features may not work.', 'warning');
});

// Performance monitoring
if ('performance' in window) {
    window.addEventListener('load', () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(`Page loaded in ${loadTime}ms`);
    });
}