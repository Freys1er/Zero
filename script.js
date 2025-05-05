// --- Configuration ---
// !!! Replace with your *DEPLOYED* Apps Script Web App URL !!!
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYdnxmwgVWfQYFgdGhjCF3qnq4GPq9BQgtFKZX9gvXZHrhVc1dsn9LAi-C5zoE2-22wQ/exec"; // Your provided Apps Script URL
// Client ID for Google Sign-In (provided by you)
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
let idToken = null; // Store the verified Google ID token
let lineCounter = 0;
let history = [];
let historyIndex = -1;

// --- Functions ---

/**
 * Adds a line to the terminal output and updates line numbers.
 * Treats input as HTML by default now.
 * @param {string} htmlContent HTML content to append.
 * @param {boolean} isUserInput If true, formats as user input.
 */
function addOutputLine(htmlContent, isUserInput = false) {
  lineCounter++;

  // Add line number
  const numSpan = document.createElement('span');
  numSpan.textContent = lineCounter;
  lineNumbers.appendChild(numSpan);
  lineNumbers.appendChild(document.createElement('br')); // New line for number

  // Add content line
  const lineDiv = document.createElement('div');
  lineDiv.classList.add('line');
  if (isUserInput) {
    // For user input, prepend prompt and wrap in a basic span, escaping the input text
    lineDiv.innerHTML = `<span class="prompt">${userPrompt.textContent}</span> <span class="user-input">${escapeHtml(htmlContent)}</span>`;
  } else {
    // For Gemini/backend output, set innerHTML directly as it's expected to be HTML
    lineDiv.innerHTML = htmlContent; // <<< Directly renders HTML from backend
  }
  output.appendChild(lineDiv);

  // Auto-scroll to bottom
  // Use requestAnimationFrame for smoother scrolling after content render
  requestAnimationFrame(() => {
    outputContainer.scrollTop = outputContainer.scrollHeight;
  });
}

/**
 * Basic HTML escaping function.
 * @param {string} unsafe The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    console.warn("escapeHtml called with non-string:", unsafe);
    return '';
  }
  return unsafe
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}

/**
 * Shows or hides the loading indicator and disables/enables input.
 * @param {boolean} show True to show, false to hide.
 */
function showLoading(show) {
  loadingIndicator.style.display = show ? 'block' : 'none';
  commandInput.disabled = show; // Disable input while loading
  if (!show) {
    // Ensure focus is returned when loading finishes
    commandInput.focus();
  }
}

/**
 * Sends the command to the Google Apps Script backend via GET request.
 * @param {string} command The command text entered by the user.
 */
async function sendCommandToAppsScript(command) {
  const trimmedCommand = command.trim();
  if (!trimmedCommand) {
    return; // Ignore empty commands
  }
  if (!idToken) {
    addOutputLine("<p style='color: #ff5555;'>Error: Not authenticated. Please sign in again.</p>");
    showLogin(); // Assumes you have a showLogin function
    return;
  }

  addOutputLine(trimmedCommand, true); // Display user command (use trimmed version)
  history.push(trimmedCommand); // Add trimmed command to history
  historyIndex = history.length; // Reset history index

  commandInput.value = ''; // Clear input field
  showLoading(true);

  // Construct URL with parameters for GET request
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.append('command', trimmedCommand);
  url.searchParams.append('token', idToken); // Send token with every command

  try {
    // Use GET method as defined in Apps Script doGet
    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors', // Usually needed
      redirect: 'follow' // Standard practice
      // No body or Content-Type header for GET requests
    });

    // Get response as TEXT because Apps Script will return HTML
    const htmlResponse = await response.text();

    if (!response.ok) {
      // Display the HTML error message returned by Apps Script if available
      console.error("Apps Script Error Status:", response.status, response.statusText, "Response:", htmlResponse);
      // Check if htmlResponse is actually HTML or just plain text error
      if (htmlResponse && htmlResponse.trim().startsWith('<')) {
        addOutputLine(htmlResponse); // Assume it's the HTML error from createErrorHtmlResponse
      } else {
        addOutputLine(`<p style='color: #ff6b6b;'>Request Failed: ${response.status} ${response.statusText}. ${escapeHtml(htmlResponse)}</p>`);
      }
    } else {
      // Add Gemini's HTML response directly to the output
      addOutputLine(htmlResponse);
    }

  } catch (error) {
    console.error("Fetch Error:", error);
    addOutputLine(`<p style='color: #ff5555;'>Network or Interface Error: ${escapeHtml(error.message)}</p>`);
  } finally {
    showLoading(false);
    // Refocus might happen in showLoading(false) now
    // Ensure scroll is at the bottom after potential content height changes
    requestAnimationFrame(() => {
      outputContainer.scrollTop = outputContainer.scrollHeight;
    });
  }
}

/**
 * Handles the response from Google Sign-In. Stores the ID token.
 * @param {object} response The credential response object from Google.
 */
function handleCredentialResponse(response) {
  loginPrompt.querySelector('.login-message').textContent = 'Authenticating...';
  idToken = response.credential; // Store the token

  // Logged in successfully from Google's side. Backend will verify on first command.
  console.log("Google Sign-In successful. ID Token obtained."); // Minimal console log
  addOutputLine("<p style='color: #50fa7b;'>Authentication successful. System Ready.</p>");

  // Hide login prompt, show command input line
  loginPrompt.style.display = 'none';
  inputLine.style.display = 'flex';
  commandInput.disabled = false; // Ensure input is enabled
  commandInput.focus();
}

/**
 * Displays the login prompt and hides the command input line. Clears the token.
 */
function showLogin() {
  idToken = null; // Clear token
  loginPrompt.style.display = 'flex';
  loginPrompt.querySelector('.login-message').textContent = 'Authentication required. Please sign in.';
  inputLine.style.display = 'none';
  commandInput.disabled = true;
}

/**
 * Initializes the terminal interface on page load.
 */
function initializeTerminal() {
  lineCounter = 0;
  lineNumbers.innerHTML = '';
  output.innerHTML = '';
  addOutputLine("Initializing CONSOLE_INTERFACE v2.0 (Gemini Powered)...");
  // Start by showing the login prompt.
  showLogin();
}

// --- Event Listeners ---

// Handle Enter key in command input
commandInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter' && !commandInput.disabled) {
    sendCommandToAppsScript(commandInput.value);
  }
});

// Handle command history navigation (Up/Down arrows)
commandInput.addEventListener('keydown', (event) => {
  if (history.length === 0) return;

  let newHistoryIndex = historyIndex;

  if (event.key === 'ArrowUp') {
    event.preventDefault(); // Prevent cursor moving to start/end
    if (historyIndex > 0) {
      newHistoryIndex--;
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault(); // Prevent cursor moving
    if (historyIndex < history.length - 1) {
      newHistoryIndex++;
    } else {
      // If pressing down at the end of history, clear the input
      historyIndex = history.length;
      commandInput.value = "";
      return; // Exit early
    }
  }

  // Update input only if index changed
  if (newHistoryIndex !== historyIndex) {
    historyIndex = newHistoryIndex;
    commandInput.value = history[historyIndex];
    // Move cursor to end of the line after setting value
    commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
  }
});

// Prevent default behavior for arrow keys if history exists,
// even if not changing index (e.g., pressing up at the top)
commandInput.addEventListener('keydown', (event) => {
  if (history.length > 0 && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault();
  }
});


// --- Initialization ---
// Initialize the terminal when the script loads.
initializeTerminal();