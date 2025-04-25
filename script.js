// --- Configuration ---
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYdnxmwgVWfQYFgdGhjCF3qnq4GPq9BQgtFKZX9gvXZHrhVc1dsn9LAi-C5zoE2-22wQ/exec"; // Ends in /exec
const GOOGLE_CLIENT_ID = "490934668566-cb3piekunttaef3g2s7svoehe8do5fkj.apps.googleusercontent.com";

// --- DOM Elements ---
// (Keep the same DOM element variables as before)
const loginSection = document.getElementById('login-section');
const mainContent = document.getElementById('main-content');
const emailList = document.getElementById('email-list');
const emailInput = document.getElementById('email-input');
const addEmailBtn = document.getElementById('add-email-btn');
const loginStatus = document.getElementById('login-status');
const actionStatus = document.getElementById('action-status');
const loadingIndicator = document.getElementById('loading-indicator');
const output = document.getElementById('output');

// --- State ---
let currentEmails = [];
let idToken = null; // << Store the verified ID token

// --- Functions ---

// logToTerminal, showLoading, updateStatus, displayEmails (Keep these as before)
/**
 * Appends a message to the main output area.
 * @param {string} message The message to log.
 * @param {string} type 'info', 'success', 'error' (optional)
 */
function logToTerminal(message, type = 'info') {
  const pre = document.createElement('pre');
  const timestamp = new Date().toLocaleTimeString();
  pre.textContent = `[${timestamp}] ${message}`;
  switch (type) {
    case 'error': pre.style.color = '#f00'; break; // Red
    case 'success': pre.style.color = '#0f0'; break; // Green
    case 'warning': pre.style.color = '#ff0'; break; // Yellow
    default: pre.style.color = '#0ff'; // Cyan
  }
  output.appendChild(pre);
  output.scrollTop = output.scrollHeight; // Auto-scroll
}


/**
 * Shows or hides the loading indicator.
 * @param {boolean} show True to show, false to hide.
 */
function showLoading(show) {
  loadingIndicator.style.display = show ? 'block' : 'none';
}

/**
 * Updates the status message below the login or action area.
 * @param {string} message The message text.
 * @param {boolean} isError True if it's an error message.
 * @param {string} area 'login' or 'action'.
 */


function updateStatus(message, isError = false, area = 'action', details = null) {
  const statusElement = area === 'login' ? loginStatus : actionStatus;
  let displayMessage = message;

  // Append failed User ID if present in details
  if (isError && details && details.failedUserId) {
    displayMessage += ` (Detected User ID: ${details.failedUserId})`;
  } else if (isError && details && details.message && details.message !== message) {
    // Sometimes the core message might be in details if only details was passed
    displayMessage = details.message;
  }


  statusElement.textContent = displayMessage;
  statusElement.style.color = isError ? '#f00' : '#ff0'; // Red for error, Yellow for status

  clearTimeout(statusElement.timer);
  statusElement.timer = setTimeout(() => {
    if (statusElement.textContent === displayMessage) {
      statusElement.textContent = '';
    }
  }, isError ? 9000 : 5000); // Longer display for errors, especially with IDs
}

/**
 * Renders the list of emails in the UI.
 * @param {string[]} emails Array of email addresses.
 */
function displayEmails(emails) {
  emailList.innerHTML = ''; // Clear existing list
  currentEmails = Array.isArray(emails) ? emails : []; // Ensure it's an array
  if (!currentEmails || currentEmails.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No target emails registered.';
    li.style.fontStyle = 'italic';
    li.style.color = '#aaa';
    emailList.appendChild(li);
    return;
  }

  currentEmails.forEach(email => {
    const li = document.createElement('li');
    li.textContent = email;
    li.title = `Click to remove ${email}`;
    // Use an arrow function to properly capture the email for the handler
    li.addEventListener('click', () => handleRemoveEmail(email));
    emailList.appendChild(li);
  });
}


/**
 * Calls the Apps Script backend using GET or POST.
 * @param {string} method 'GET' or 'POST'.
 * @param {string} action The 'action' parameter/payload field.
 * @param {object} params Data for GET query string or POST body.
 * @returns {Promise<object>} Promise resolving with the JSON response.
 */

async function callAppsScript(action, params = {}) {
  showLoading(true);
  const requestParams = { ...params }; // Clone params
  let isLoginAttempt = (action === 'verify'); // Distinguish initial login

  // Add token to parameters if we have one
  if (idToken) {
    requestParams.token = idToken;
  } else if (!isLoginAttempt) {
    // If not logged in (no token) and not the initial login attempt, fail fast
    logToTerminal(`Action '${action}' requires authentication. Please sign in.`, 'error');
    updateStatus("Authentication required.", true, 'action');
    showLoading(false);
    return { success: false, message: "Client-side check: Authentication required." };
  }
  // For the initial 'verify' action, the token comes directly in params from handleCredentialResponse


  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.append('action', action);
  for (const key in requestParams) {
    // Ensure token passed in params (for verify) isn't overwritten by null idToken
    if (requestParams[key] !== undefined && requestParams[key] !== null) {
      url.searchParams.append(key, requestParams[key]);
    }
  }

  const fetchOptions = {
    method: 'GET',
    // mode: 'cors', // Usually default
    // redirect: 'follow' // Usually default
  };

  try {
    logToTerminal(`> GET Request: action=${action} (Token: ${requestParams.token ? 'Present' : 'Absent'})`);
    const response = await fetch(url.toString(), fetchOptions);

    logToTerminal(`< Response Status: ${response.status} ${response.statusText}`);

    if (response.status === 0) {
      throw new Error("Network request failed (status 0). Check CORS, network, and script deployment.");
    }
    // Try to parse JSON regardless of status to get backend error details
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      const textResponse = await response.text();
      logToTerminal(`! Failed to parse JSON response. Status: ${response.status}. Response: ${textResponse.substring(0, 500)}`, 'error');
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}. Response not JSON.`);
      } else {
        throw new Error(`Received OK status (${response.status}) but invalid JSON response.`);
      }
    }

    if (!response.ok) {
      // Use message from JSON if available, otherwise create generic one
      const errorMsg = data.message || `HTTP error ${response.status}`;
      logToTerminal(`! Backend Error: ${errorMsg}`, 'error');
      // Pass the whole data object to updateStatus for potential failedUserId
      updateStatus(errorMsg, true, isLoginAttempt ? 'login' : 'action', data);
      // Throw error to stop processing, but include data for context
      const error = new Error(errorMsg);
      error.data = data; // Attach full response data to the error
      throw error;
    }

    // Log success/failure based on the 'success' flag in the JSON response
    logToTerminal(`< Response OK: ${JSON.stringify(data).substring(0, 150)}...`, data.success ? 'success' : 'warning');

    // Handle logical failures reported by the script (e.g., email already exists)
    if (data.success === false) {
      updateStatus(data.message || 'Script reported an error.', true, isLoginAttempt ? 'login' : 'action', data);
    }

    return data; // Return the parsed JSON data

  } catch (error) {
    console.error(`Error during GET action=${action}:`, error);
    // Ensure status is updated even if error thrown before parsing data obj
    if (!error.data) { // Check if data was attached earlier
      logToTerminal(`! Fetch/Network Error: ${error.message}`, 'error');
      updateStatus(`Error: ${error.message}`, true, isLoginAttempt ? 'login' : 'action');
    }
    // No need to update status again if already done in the !response.ok block

    showLoading(false);
    // Return a standard error object, including potential data from the error object
    return {
      success: false,
      message: `Client-side/fetch error: ${error.message}`,
      ...(error.data && { details: error.data }) // Include backend data if available
    };
  } finally {
    showLoading(false);
  }
}

/**
 * Handles the response from Google Sign-In.
 * @param {object} response The credential response object.
 */
async function handleCredentialResponse(response) {
  logToTerminal("Google Sign-In successful. Verifying token...");
  updateStatus("Verifying...", false, 'login');
  const receivedToken = response.credential;

  // Send token to Apps Script for verification using GET 'verify' action
  // Pass token directly in params for this initial call
  const verificationResult = await callAppsScript('verify', { token: receivedToken });

  if (verificationResult.success) {
    logToTerminal("Backend verification successful.", 'success');
    updateStatus("Access granted.", false, 'login');
    idToken = receivedToken; // << STORE the validated token globally
    loginSection.style.display = 'none';
    mainContent.style.display = 'flex';
    displayEmails(verificationResult.emails || []);
  } else {
    logToTerminal(`Backend verification failed: ${verificationResult.message}`, 'error');
    // updateStatus is handled within callAppsScript based on the response data
    idToken = null; // Clear token on failure
  }
}


/**
 * Handles adding a new email (using POST).
 */


async function handleAddEmail() {
  const email = emailInput.value.trim();
  if (!email) {
    updateStatus("Email cannot be empty.", true, 'action');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    updateStatus("Invalid email format.", true, 'action');
    return;
  }
  // callAppsScript will add the stored idToken automatically
  if (!idToken) {
    updateStatus("Authentication required. Please sign in again.", true, 'action');
    return;
  }

  logToTerminal(`Attempting to add email: ${email}`);
  updateStatus("Adding email...", false, 'action');

  // Send request using GET. Token is added by callAppsScript.
  const result = await callAppsScript('addEmail', { email: email });

  if (result.success) {
    logToTerminal(`Email added successfully: ${email}`, 'success');
    updateStatus(result.message || "Email added.", false, 'action');
    emailInput.value = '';
    if (result.emails !== undefined) { // Update list if backend provides it
      displayEmails(result.emails);
    }
  } else {
    logToTerminal(`Failed to add email: ${result.message || 'Unknown error'}`, 'error');
    // updateStatus is handled by callAppsScript on failure
    // Still update list if backend provided it despite failure (e.g., 'email exists')
    if (result.emails !== undefined) {
      displayEmails(result.emails);
    }
  }
}

/**
 * Handles removing an email when clicked (using POST).
 * @param {string} email The email to remove.
 */


async function handleRemoveEmail(email) {
  if (!idToken) {
    updateStatus("Authentication required. Cannot remove email.", true, 'action');
    logToTerminal("Remove cancelled: Not authenticated.", 'warning');
    return;
  }
  if (!confirm(`Are you sure you want to remove ${email}?`)) {
    return;
  }

  logToTerminal(`Attempting to remove email: ${email}`);
  updateStatus("Removing email...", false, 'action');

  // Send request using GET. Token is added by callAppsScript.
  const result = await callAppsScript('removeEmail', { email: email });

  if (result.success) {
    logToTerminal(`Email removed successfully: ${email}`, 'success');
    updateStatus(result.message || "Email removed.", false, 'action');
    if (result.emails !== undefined) { // Update list if backend provides it
      displayEmails(result.emails);
    }
  } else {
    logToTerminal(`Failed to remove email: ${result.message || 'Unknown error'}`, 'error');
    // updateStatus is handled by callAppsScript on failure
    // Still update list if backend provided it despite failure (e.g., 'email not found')
    if (result.emails !== undefined) {
      displayEmails(result.emails);
    }
  }
}

// --- Event Listeners ---
// (Keep the same event listeners as before)
addEmailBtn.addEventListener('click', handleAddEmail);
emailInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    handleAddEmail();
  }
});

// --- Initialization ---
logToTerminal("Frontend script loaded. Ready for Google Sign-In.");
// Google Sign-In is initialized automatically by the library script tag.