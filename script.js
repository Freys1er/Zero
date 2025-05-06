// =============================================
// == CONSOLE_INTERFACE Frontend Script v3.0  ==
// == (Reverted - Read-Only Output)         ==
// =============================================

// --- Configuration ---
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYdnxmwgVWfQYFgdGhjCF3qnq4GPq9BQgtFKZX9gvXZHrhVc1dsn9LAi-C5zoE2-22wQ/exec"; // Your Apps Script URL
const GOOGLE_CLIENT_ID = "490934668566-cb3piekunttaef3g2s7svoehe8do5fkj.apps.googleusercontent.com";
// =============================================
// == CONSOLE_INTERFACE Frontend Script v3.2  ==
// == (Mobile View Toggle & JSON Viewer)    ==
// =============================================


// --- DOM Elements ---
const appContainer = document.querySelector('.app-container');
const terminalContainer = document.querySelector('.terminal-container');
const jsonViewerContainer = document.querySelector('.json-viewer-container');
const output = document.getElementById('output');
const lineNumbers = document.getElementById('line-numbers');
// ***** ADD THIS LINE BACK *****
const outputContainer = document.querySelector('.output-container');
// ******************************
const commandInput = document.getElementById('command-input');
const inputLine = document.getElementById('input-line');
const loginPrompt = document.getElementById('login-prompt');
const loadingIndicator = document.getElementById('loading-indicator');
const userPrompt = document.getElementById('user-prompt');
const jsonDisplay = document.getElementById('json-display');
const refreshJsonBtn = document.getElementById('refresh-json-btn');
const viewToggleBtn = document.getElementById('view-toggle-btn');

// --- State ---
let idToken = null;
let lineCounter = 0;
let history = [];
let historyIndex = -1;
let currentJsonData = null;
let isMobileConsoleActive = true; // For mobile view state

// =============================================
// == Core Functions                          ==
// =============================================

/**
 * Adds a line to the terminal output area.
 */
function addOutputLine(htmlContent, isUserInput = false) {
    lineCounter++;
    const numSpan = document.createElement('span'); numSpan.textContent = lineCounter;
    lineNumbers.appendChild(numSpan); lineNumbers.appendChild(document.createElement('br'));
    const lineDiv = document.createElement('div'); lineDiv.classList.add('line');
    if (isUserInput) { lineDiv.innerHTML = `<span class="prompt">${userPrompt.textContent}</span> <span class="user-input">${escapeHtml(htmlContent)}</span>`; }
    else { lineDiv.innerHTML = htmlContent; }
    output.appendChild(lineDiv);
    requestAnimationFrame(() => { outputContainer.scrollTop = outputContainer.scrollHeight; });
}

/** Basic HTML escaping. */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') { return ''; }
    return unsafe.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, '"').replace(/'/g, "'");
}

/** Shows/hides loading indicator. */
function showLoading(show) {
    loadingIndicator.style.display = show ? 'block' : 'none';
    commandInput.disabled = show;
    if (!show && inputLine.style.display === 'flex') { commandInput.focus(); }
}

/** Displays JSON data in the right pane. */
function displayJsonData(jsonData) {
    if (jsonData && typeof jsonData === 'object') {
        currentJsonData = jsonData;
        jsonDisplay.textContent = JSON.stringify(jsonData, null, 2);
    } else if (jsonData === null) {
        jsonDisplay.textContent = "// No JSON data loaded or error.";
        currentJsonData = null;
    } else {
        jsonDisplay.textContent = `// Error: Invalid data for JSON display.\n// Type: ${typeof jsonData}`;
        console.warn("Invalid data for displayJsonData:", jsonData);
        currentJsonData = null;
    }
}

/**
 * Fetches current JSON data from backend and updates viewer.
 * Special command "get_current_json_data_view" is sent.
 * The response from this command should ALSO include the JSON data.
 */
async function fetchAndUpdateJsonView(isSilent = false) { // isSilent to prevent double "Refreshing..." message
    if (!idToken) {
        if (!isSilent) addOutputLine("<p style='color:orange;'>Cannot refresh JSON: Not authenticated.</p>");
        displayJsonData(null); // Clear display if not authenticated
        return;
    }
    if (!isSilent) addOutputLine("<p style='color:#8be9fd;'><em>Refreshing JSON view...</em></p>");

    // Use the sendCommandToAppsScript function to handle the request
    // The backend needs to recognize "get_current_json_data_view" and include
    // the latest JSON data in its response (e.g., in a 'jsonData' field alongside 'htmlResponse')
    await sendCommandToAppsScript("system status [good, ok, bad]", true); // 'true' indicates it's a special request expecting JSON data back
}


/**
 * Sends command to Apps Script.
 * If isJsonRequest is true, expects backend to return JSON data in response.
 */
async function sendCommandToAppsScript(command, isJsonRequest = false) {
    const trimmedCommand = command.trim();
    if (!trimmedCommand || !idToken) { /* Handle missing command/token */ return; }

    const commandSourceIsInput = (document.activeElement === commandInput);
    if (!commandSourceIsInput) { // For button clicks or programmatic calls
        addOutputLine(trimmedCommand, true); // Show command in console
    }

    if (commandSourceIsInput && trimmedCommand !== (history[history.length - 1] || null)) {
        history.push(trimmedCommand); historyIndex = history.length;
    }
    if (commandSourceIsInput) { commandInput.value = ''; }

    showLoading(true);
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.append('command', trimmedCommand);
    url.searchParams.append('token', idToken);

    console.log(`Sending request: ${url.toString().substring(0, 150)}... (isJsonRequest: ${isJsonRequest})`);

    try {
        const response = await fetch(url.toString(), { method: 'GET', mode: 'cors', redirect: 'follow', cache: 'no-cache' });
        const rawResponseText = await response.text(); // Get as text first

        if (!response.ok) {
            console.error("Apps Script Error:", response.status, response.statusText, "Response:", rawResponseText.substring(0, 300));
            addOutputLine(rawResponseText); // Assume backend sends error HTML
            if (!rawResponseText || !rawResponseText.trim().startsWith('<')) { addOutputLine(`<p style='color: #ff6b6b;'>Request Failed...</p>`); }
            if (isJsonRequest) displayJsonData(null); // Clear JSON view on error for JSON request
        } else {
            // Backend needs to return a JSON string that contains BOTH htmlResponse AND jsonData
            // e.g., { "htmlResponse": "<p>...</p>", "jsonData": { ... } }
            try {
                const backendResponse = JSON.parse(rawResponseText);
                if (backendResponse.htmlResponse) {
                    addOutputLine(backendResponse.htmlResponse);
                } else if (!isJsonRequest) { // If not a JSON request, and no HTML, something's odd
                    addOutputLine("<p><em>(Received non-standard response)</em></p>");
                    console.warn("Received non-standard response:", backendResponse);
                }

                if (backendResponse.jsonData) {
                    displayJsonData(backendResponse.jsonData);
                } else if (isJsonRequest) { // If expecting JSON but didn't get it
                    displayJsonData(null);
                    console.warn("JSON request completed but no 'jsonData' field in response.");
                }
            } catch (e) {
                // If response wasn't JSON (e.g., old backend version, or plain HTML error)
                console.warn("Response from backend was not JSON, treating as plain HTML:", e);
                addOutputLine(rawResponseText); // Display as plain HTML
                if (isJsonRequest) displayJsonData(null);
            }
        }
    } catch (error) {
        console.error("Fetch Network Error:", error);
        addOutputLine(`<p style='color: #ff5555;'>Network Error: ${escapeHtml(error.message)}</p>`);
        if (isJsonRequest) displayJsonData(null);
    } finally {
        showLoading(false);
        requestAnimationFrame(() => { if (outputContainer) outputContainer.scrollTop = outputContainer.scrollHeight; });
    }
}


/** Handles Google Sign-In response. */
function handleCredentialResponse(response) {
    idToken = response.credential;
    console.log("Google Sign-In successful.");
    addOutputLine("<p style='color: #50fa7b;'>Authentication successful.</p>");
    loginPrompt.style.display = 'none'; inputLine.style.display = 'flex';
    commandInput.disabled = false; commandInput.focus();
}

/** Shows login prompt. */
function showLogin() {
    idToken = null; history = []; historyIndex = -1;
    loginPrompt.style.display = 'flex';
    loginPrompt.querySelector('.login-message').textContent = 'Authentication required.';
    inputLine.style.display = 'none'; commandInput.disabled = true;
    displayJsonData(null); // Clear JSON view on logout
}

/** Initializes terminal. */
function initializeTerminal() {
    lineCounter = 0; lineNumbers.innerHTML = ''; output.innerHTML = '';
    addOutputLine(`Initializing ${document.title || 'CONSOLE_INTERFACE'}...`);
    showLogin();
}

/** Toggles view on mobile. */
function toggleMobileView() {
    isMobileConsoleActive = !isMobileConsoleActive;
    if (isMobileConsoleActive) {
        appContainer.classList.remove('mobile-json-active');
        appContainer.classList.add('mobile-console-active');
        viewToggleBtn.textContent = "Show JSON";
        commandInput.focus(); // Focus input when switching to console
    } else {
        appContainer.classList.remove('mobile-console-active');
        appContainer.classList.add('mobile-json-active');
        viewToggleBtn.textContent = "Show Console";
    }
}

// =============================================
// == Event Listeners                         ==
// =============================================
commandInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !commandInput.disabled) {
        const command = commandInput.value;
        if (command.trim()) { addOutputLine(command, true); sendCommandToAppsScript(command); }
        else { commandInput.value = ''; }
    }
});
commandInput.addEventListener('keydown', (event) => { /* ... (history logic as before) ... */ });
refreshJsonBtn.addEventListener('click', () => fetchAndUpdateJsonView());
viewToggleBtn.addEventListener('click', toggleMobileView);

// =============================================
// == Initialization                          ==
// =============================================
document.addEventListener('DOMContentLoaded', initializeTerminal);