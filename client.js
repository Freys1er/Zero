const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyVsYOb3sDnMBJMXrRziIn7Z3Et9xF8UL9bHrE-F7fTd0qyn5tUjywQZgWgb-jNKZe9/exec'; // !!! REPLACE THIS !!!
const GSI_CLIENT_ID = '490934668566-cb3piekunttaef3g2s7svoehe8do5fkj.apps.googleusercontent.com'; // !!! REPLACE THIS - Same as in HTML !!!

let googleIdToken = null;

const signInContainer = document.getElementById('google-signin-button-container');
const jarvisInterfaceDiv = document.getElementById('jarvis-interface');
const backgroundContentDiv = document.getElementById('jarvis-background-content');
const promptContainer = document.getElementById('jarvis-prompt-container');
const commandInput = document.getElementById('jarvis-command-input');
const submitButton = document.getElementById('jarvis-submit-button');
const collapsedTrigger = document.getElementById('jarvis-collapsed-trigger');


// --- Google Sign-In Handler ---
function handleGoogleSignIn(response) {
    if (response.credential) {
        googleIdToken = response.credential;
        console.log("Google ID Token:", googleIdToken); // For brevity

        // Hide Sign-In button, show JARVIS interface
        signInContainer.style.display = 'none';
        jarvisInterfaceDiv.classList.remove('hidden');
        collapsedTrigger.classList.remove('hidden'); // Show collapsed trigger initially
        promptContainer.classList.add('hidden-prompt'); // Start with prompt hidden

        // Initial message or command (optional)
        updateBackgroundContent('<div class="welcome-message"><h1>J.A.R.V.I.S. Online</h1><p>Awaiting your command, sir.</p></div>');
    } else {
        console.error("Google Sign-In failed or no credential received.");
    }
}

// --- UI Interaction ---
submitButton.addEventListener('click', processCommand);
commandInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        processCommand();
    }
});

collapsedTrigger.addEventListener('click', () => {
    promptContainer.classList.remove('hidden-prompt');
    collapsedTrigger.classList.add('hidden');
    commandInput.focus();
});

// Optional: Click outside prompt to collapse (more complex, add if needed)
document.addEventListener('click', (event) => {
    if (!promptContainer.contains(event.target) && !collapsedTrigger.contains(event.target) && !promptContainer.classList.contains('hidden-prompt')) {
        promptContainer.classList.add('hidden-prompt');
        collapsedTrigger.classList.remove('hidden');
    }
});


async function processCommand() {
    const commandText = commandInput.value.trim();
    if (!commandText) return;
    if (!googleIdToken) {
        return;
    }

    commandInput.value = ''; // Clear input
    setLoadingState(true);

    try {
        const response = await fetch(`${WEB_APP_URL}?command=${encodeURIComponent(commandText)}&token=${googleIdToken}`);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        console.log("Backend Response:", data);

        if (data.htmlResponse) {
            updateBackgroundContent(data.htmlResponse);
        }
        if (data.jsonData) {
            // You can use data.jsonData for client-side state if needed
            // For example, updating a small status display, etc.
            console.log("Current zero.json state (client):", data.jsonData);
        }

    } catch (error) {
        console.error('Error processing command:', error);
        updateBackgroundContent(`<div class="welcome-message"><p style='color:red;'>Communication error with J.A.R.V.I.S. backend.</p></div>`);
    } finally {
        setLoadingState(false);
    }
}

function updateBackgroundContent(html) {
    backgroundContentDiv.innerHTML = html;
}


function setLoadingState(isLoading) {
    submitButton.disabled = isLoading;
    commandInput.disabled = isLoading;
    if (isLoading) {
        submitButton.textContent = '...';
        // Optionally show a global loading indicator
        // updateBackgroundContent('<div class="loading-indicator">J.A.R.V.I.S. is thinking</div>');
    } else {
        submitButton.textContent = 'SEND';
    }
}

function escapeClientHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, "'");
}

// Initialize: Check if user was already signed in (GSI might auto-sign in)
// This is handled by the GSI library's data-callback.