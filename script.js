// =============================================
// == CONSOLE_INTERFACE Frontend Script v3.0  ==
// == (Reverted - Read-Only Output)         ==
// =============================================

// --- Configuration ---
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYdnxmwgVWfQYFgdGhjCF3qnq4GPq9BQgtFKZX9gvXZHrhVc1dsn9LAi-C5zoE2-22wQ/exec"; // Your Apps Script URL
const GOOGLE_CLIENT_ID = "490934668566-cb3piekunttaef3g2s7svoehe8do5fkj.apps.googleusercontent.com";

// --- DOM Elements ---
const terminal = document.querySelector('.terminal');
const outputContainer = document.querySelector('.output-container');
const output = document.getElementById('output');
const lineNumbers = document.getElementById('line-numbers');
const commandInput = document.getElementById('command-input');
const inputLine = document.getElementById('input-line');
const loginPrompt = document.getElementById('login-prompt');
const loadingIndicator = document.getElementById('loading-indicator');
const userPrompt = document.getElementById('user-prompt');

// --- State ---
let idToken = null;
let lineCounter = 0;
let history = [];
let historyIndex = -1;

// =============================================
// == Core Functions                          ==
// =============================================

/**
 * Adds a line to the terminal output area and updates line numbers.
 * @param {string} htmlContent - HTML content to append.
 * @param {boolean} [isUserInput=false] - If true, formats as user input line.
 */
function addOutputLine(htmlContent, isUserInput = false) { // Removed 'source' param
    lineCounter++;

    const numSpan = document.createElement('span');
    numSpan.textContent = lineCounter;
    lineNumbers.appendChild(numSpan);
    lineNumbers.appendChild(document.createElement('br'));

    const lineDiv = document.createElement('div');
    lineDiv.classList.add('line');

    if (isUserInput) {
        // Display user's typed command (escaped)
        lineDiv.innerHTML = `<span class="prompt">${userPrompt.textContent}</span> <span class="user-input">${escapeHtml(htmlContent)}</span>`;
    } else {
        // Render HTML directly from the backend/Gemini response
        lineDiv.innerHTML = htmlContent; // Assumes backend HTML is safe enough for read-only
    }
    output.appendChild(lineDiv);

    requestAnimationFrame(() => {
        outputContainer.scrollTop = outputContainer.scrollHeight;
    });
}

/**
 * Basic HTML escaping function.
 * @param {string} unsafe - The raw string to escape.
 * @returns {string} The HTML-escaped string.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') { return ''; }
    return unsafe.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, '"').replace(/'/g, "'");
}

/**
 * Shows or hides the loading indicator and manages command input state.
 * @param {boolean} show - True to show loading, false to hide.
 */
function showLoading(show) {
    loadingIndicator.style.display = show ? 'block' : 'none';
    commandInput.disabled = show;
    if (!show && inputLine.style.display === 'flex') {
        commandInput.focus();
    }
}

/**
 * Sends the command to the Google Apps Script backend.
 * NO LONGER SENDS FORM DATA.
 * @param {string} command - The command text.
 */
async function sendCommandToAppsScript(command) { // Removed formData parameter
    const trimmedCommand = command.trim();
    if (!trimmedCommand) { return; } // Ignore empty
    if (!idToken) {
        addOutputLine("<p style='color: #ff5555;'>Error: Not authenticated.</p>");
        showLogin();
        return;
    }

    // Add command to history if it's different from the last one
    if (trimmedCommand !== (history[history.length - 1] || null)) {
        history.push(trimmedCommand);
        historyIndex = history.length; // Reset history index
    }
    // Clear input field
    commandInput.value = '';

    showLoading(true);

    // Construct URL - ONLY includes command and token
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.append('command', trimmedCommand);
    url.searchParams.append('token', idToken);

    console.log(`Sending request: ${url.toString().substring(0, 150)}...`);

    // --- Fetch Logic (No preprocessing needed) ---
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors',
            redirect: 'follow',
            cache: 'no-cache'
        });

        // Get raw HTML response as text
        const rawHtmlResponse = await response.text();

        if (!response.ok) {
            console.error("Apps Script Error:", response.status, response.statusText, "Response:", rawHtmlResponse.substring(0, 300));
            // Display the raw response, assuming backend sends error HTML
            addOutputLine(rawHtmlResponse);
             if (!rawHtmlResponse || !rawHtmlResponse.trim().startsWith('<')) { // Fallback if not HTML
                  addOutputLine(`<p style='color: #ff6b6b;'>Request Failed: ${response.status} ${response.statusText}. ${escapeHtml(rawHtmlResponse.substring(0,100))}</p>`);
             }
        } else {
            // Add the raw HTML response directly to the output
            addOutputLine(rawHtmlResponse);
        }

    } catch (error) {
        console.error("Fetch Network Error:", error);
        addOutputLine(`<p style='color: #ff5555;'>Network or Interface Error: ${escapeHtml(error.message)}</p>`);
    } finally {
        showLoading(false);
        requestAnimationFrame(() => { outputContainer.scrollTop = outputContainer.scrollHeight; });
    }
}

/**
 * Handles the successful response from Google Sign-In.
 * @param {object} response - The credential response object from Google.
 */
function handleCredentialResponse(response) {
    loginPrompt.querySelector('.login-message').textContent = 'Authenticating...';
    idToken = response.credential;
    console.log("Google Sign-In successful.");
    addOutputLine("<p style='color: #50fa7b;'>Authentication successful. System Ready.</p>");
    loginPrompt.style.display = 'none';
    inputLine.style.display = 'flex';
    commandInput.disabled = false;
    commandInput.focus();
}

/**
 * Switches the UI back to the login prompt state.
 */
function showLogin() {
    idToken = null; history = []; historyIndex = -1;
    loginPrompt.style.display = 'flex';
    loginPrompt.querySelector('.login-message').textContent = 'Authentication required.';
    inputLine.style.display = 'none'; commandInput.disabled = true;
}

/**
 * Initializes the terminal interface on page load.
 */
function initializeTerminal() {
     lineCounter = 0; lineNumbers.innerHTML = ''; output.innerHTML = '';
     addOutputLine(`Initializing ${document.title || 'CONSOLE_INTERFACE'}...`);
     showLogin();
}

// =============================================
// == Event Listeners                         ==
// =============================================

// --- Listener for command input field (Enter Key) ---
commandInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !commandInput.disabled) {
        const command = commandInput.value;
        if (command.trim()) {
            addOutputLine(command, true); // Display user command visually
            sendCommandToAppsScript(command); // Send command (formData is not passed)
        } else {
             commandInput.value = ''; // Clear if only whitespace
        }
    }
});

// --- Listener for command history (Arrow Keys) ---
commandInput.addEventListener('keydown', (event) => {
    if (commandInput.disabled || history.length === 0) return;
    let newHistoryIndex = historyIndex;
    let shouldPreventDefault = false;
    if (event.key === 'ArrowUp') {
        shouldPreventDefault = true;
        if (historyIndex <= 0) { newHistoryIndex = 0; }
        else { newHistoryIndex--; }
    } else if (event.key === 'ArrowDown') {
        shouldPreventDefault = true;
        if (historyIndex >= history.length - 1) {
            historyIndex = history.length;
            commandInput.value = "";
            return;
        } else { newHistoryIndex++; }
    }
    if (shouldPreventDefault) {
        event.preventDefault();
        if (newHistoryIndex !== historyIndex) {
            historyIndex = newHistoryIndex;
            commandInput.value = history[historyIndex];
            commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
        }
    }
});


// =============================================
// == Initialization                          ==
// =============================================
document.addEventListener('DOMContentLoaded', initializeTerminal);

// --- Removed Helper Functions ---
// gatherInputs, findClosest, preprocessHtmlResponse are no longer needed.