async function generateHMAC(secretKey) {
  //Dont show secretKey
  const encoder = new TextEncoder();
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Calculate days since epoch
  log("Days since epoch: "+ daysSinceEpoch);

  const message = daysSinceEpoch.toString(); // Use days since epoch as the message
  log("HMAC message: " + message);

  try {
    // Import the key
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secretKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Generate the HMAC signature
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(message)
    );

    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    log("Generated HMAC signature: "+ signature);
    return signature;
  } catch (error) {
    console.error("Error generating HMAC:", error.message);
    throw error;
  }
}

async function updateEmailsOnServer(signature, mode, email) {
  log(`Updating server with mode: ${mode}, email: ${email}`);

  const apiUrl =
    "https://script.google.com/macros/s/AKfycbwYdnxmwgVWfQYFgdGhjCF3qnq4GPq9BQgtFKZX9gvXZHrhVc1dsn9LAi-C5zoE2-22wQ/exec";

  const params = {
    signature: signature,
    emails: JSON.stringify({ mode, emails: [email] }),
  };

  const queryString = new URLSearchParams(params).toString();
  const url = `${apiUrl}?${queryString}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    log("Server response: "+ data);

    if (data.status !== "Success") {
      showError("Error");
      return false;
    }

    log(`Successfully updated server with mode: ${mode}, email: ${email}`);
    return true; // Successfully updated
  } catch (error) {
    showError("Incorrect passkey");
    return false; // Failed to update
  }
}

async function fetchEmailsFromServer(signature) {
  log("Fetching emails from server with signature: "+ signature);

  const apiUrl =
    "https://script.google.com/macros/s/AKfycbwYdnxmwgVWfQYFgdGhjCF3qnq4GPq9BQgtFKZX9gvXZHrhVc1dsn9LAi-C5zoE2-22wQ/exec";

  const params = {
    signature: signature,
    emails: JSON.stringify({ mode: "", emails: [] }),
  };

  const queryString = new URLSearchParams(params).toString();
  const url = `${apiUrl}?${queryString}`;


  try {
    const response = await fetch(url);
    const data = await response.json();

    log("Emails fetched from server: "+ data);

    if (data.status === "Success") {
      return data.emails; // Return the list of emails
    } else {
      showError("Incorrect passkey")
      return false;
    }
  } catch (error) {
    showError("Incorrect passkey")
    return [];
  }
}
// Global log storage
const logMessages = []; // Array to store all log messages

// Global log function
function log(message) {
  console.log(message); // Log to browser console

  // Record the message in the array
  logMessages.push(message);
}

// Function to render logMessages in the custom console
function renderLogMessages() {
  const consoleSection = document.getElementById('consoleSection');

  // Make sure the console section exists before rendering
  if (consoleSection) {
    // Clear any existing content in the console
    consoleSection.innerHTML = "<p>Console</p><br>";

    // Loop through the logMessages array and display each message
    logMessages.forEach((msg) => {
      const logEntry = document.createElement("div");
      logEntry.textContent = msg;
      logEntry.style.margin = "5px 0";

      // Append each log entry to the custom console
      consoleSection.appendChild(logEntry);
    });

    // Auto-scroll to the bottom
    consoleSection.scrollTop = consoleSection.scrollHeight;
  }
}


function displayEmailsWithActions(emails, signature) {
  log("Displaying emails:", emails);

  // Select the home screen and clear existing content
  const homeScreen = document.getElementById("home-screen");
  homeScreen.style.overflowY = "scroll"; // Enable vertical scrolling
  homeScreen.style.maxHeight = "100vh"; // Limit the height to the viewport
  homeScreen.style.padding = "50px 0px 50px 0px"; // Add padding for aesthetic spacing

  homeScreen.innerHTML = ""; // Clear previous content

  // Define a consistent width for all sections
  const sectionWidth = "80%";

  // File Uploading Section
  const fileSection = document.createElement("div");
  fileSection.style.width = sectionWidth;
  fileSection.style.border = "2px solid #ccc";
  fileSection.style.padding = "10px";
  fileSection.style.margin = "10px auto";
  fileSection.style.borderRadius = "8px";
  fileSection.innerHTML = `
      <div id="titleDiv">Welcome to Zero.</div>
      <p>File uploading</p>
      <form id="uploadForm">
          <input type="file" id="fileUpload" />
          <button type="button" id="uploadButton">Upload</button>
      </form>
  `;
  homeScreen.appendChild(fileSection);

  // Email Content Section
  const emailContentSection = document.createElement("div");
  emailContentSection.style.width = sectionWidth;
  emailContentSection.style.border = "2px solid #ccc";
  emailContentSection.style.padding = "10px";
  emailContentSection.style.margin = "10px auto";
  emailContentSection.style.borderRadius = "8px";
  emailContentSection.innerHTML = `
      <p>Compose Email</p>
      <textarea id="emailTextBox" placeholder="Write your email here" rows="6" style="width: 100%;"></textarea>
  `;
  homeScreen.appendChild(emailContentSection);

  // Email List Section
  const emailListSection = document.createElement("div");
  emailListSection.style.width = sectionWidth;
  emailListSection.style.border = "2px solid #ccc";
  emailListSection.style.padding = "10px";
  emailListSection.style.margin = "10px auto";
  emailListSection.style.borderRadius = "8px";

  const emailListTitle = document.createElement("p");
  emailListTitle.textContent = "Email List";
  emailListSection.appendChild(emailListTitle);

  // Add "Add Email" functionality
  const addEmailContainer = createAddEmailSection(emails, signature);
  emailListSection.appendChild(addEmailContainer);

  const emailListContainer = document.createElement("div");
  const emailList = document.createElement("ul");
  emailList.style.listStyle = "none";
  emailList.style.padding = "0";

  // Populate email list with actions
  emails.forEach((email, index) => {
    const emailItem = createEmailItem(email, index, emails, signature);
    emailList.appendChild(emailItem);
  });

  emailListContainer.appendChild(emailList);
  emailListSection.appendChild(emailListContainer);
  homeScreen.appendChild(emailListSection);

  // Custom Console Section

  let consoleSection = document.getElementById('consoleSection');
  if (!consoleSection) {
    const consoleSection = document.createElement("div");
    consoleSection.id = "consoleSection";
    consoleSection.style.width = sectionWidth;
    consoleSection.style.border = "2px solid #FFFFFF";
    consoleSection.style.backgroundColor = "#000";
    consoleSection.style.padding = "10px";
    consoleSection.style.margin = "10px auto";
    consoleSection.style.borderRadius = "8px";
    consoleSection.style.color = "#00FF00";
    consoleSection.style.fontFamily = "'Courier New', Courier, monospace";
    consoleSection.style.whiteSpace = "pre-wrap";
    consoleSection.innerHTML = "<p>Console</p><br>";
    homeScreen.appendChild(consoleSection);

  }
  // Append the custom console to the home screen

  renderLogMessages();

  // Custom log function to output to console and custom console

  // Example usage of the log function
  log("Page initialized.");
  log("Number of emails displayed: " + emails.length);

  homeScreen.style.display = "block";
}


// Helper Function: Create an email item with hover and click actions
function createEmailItem(email, index, emails, signature) {
  const emailItem = document.createElement("li");

  // Basic styling
  emailItem.style.display = "inline-block";
  emailItem.style.padding = "10px";
  emailItem.style.margin = "5px";
  emailItem.style.border = "1px solid #ccc";
  emailItem.style.borderRadius = "4px";
  emailItem.style.cursor = "pointer";
  emailItem.style.transition = "background-color 0.3s, color 0.3s";

  // Set the email text
  emailItem.textContent = email;

  // Add hover effects
  emailItem.addEventListener("mouseover", () => {
    emailItem.style.backgroundColor = "red";
    emailItem.style.color = "#fff";
  });
  emailItem.addEventListener("mouseout", () => {
    emailItem.style.backgroundColor = "";
    emailItem.style.color = "";
  });

  // Add click action to delete the email
  emailItem.addEventListener("click", async () => {
    log("Email clicked (delete):", email);
    const success = await updateEmailsOnServer(signature, "Remove", email);
    if (success) {
      emails.splice(index, 1);
      displayEmailsWithActions(emails, signature);
    }
  });

  return emailItem;
}
// Helper Function: Create the "Add Email" section
// Helper Function: Create the "Add Email" section
function createAddEmailSection(emails, signature) {
  const addEmailContainer = document.createElement("div");
  addEmailContainer.style.display = "flex"; // Align items in a row
  addEmailContainer.style.justifyContent = "center"; // Center align
  addEmailContainer.style.alignItems = "center"; // Align vertically

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.id = "emailInput";
  emailInput.placeholder = "Enter new email and press Enter";
  emailInput.style.padding = "10px";
  emailInput.style.border = "2px solid #00FF00";
  emailInput.style.borderRadius = "5px";
  emailInput.style.backgroundColor = "black";
  emailInput.style.color = "#00FF00";
  emailInput.style.fontFamily = "'Courier New', Courier, monospace";

  // Function to handle adding an email
  const addEmailHandler = async () => {
    const newEmail = emailInput.value.trim();
    if (newEmail) {
      log("Enter pressed with email:", newEmail);

      // Temporarily clear the input field to show something is happening
      emailInput.value = "Adding...";
      emailInput.disabled = true;

      const success = await updateEmailsOnServer(signature, "Add", newEmail);
      if (success) {
        emails.push(newEmail);
      }

      // Reset the input field
      emailInput.value = "";
      emailInput.disabled = false;

      // Re-render the email list
      displayEmailsWithActions(emails, signature);
    }
  };

  // Add "Enter" key functionality for the input field
  emailInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent form submission or other defaults
      addEmailHandler();
    }
  });

  addEmailContainer.appendChild(emailInput);

  return addEmailContainer;
}



document
  .getElementById("submit-passcode")
  .addEventListener("click", async () => {
    const passcode = document.getElementById("passcode").value;
    const errorMessage = document.getElementById("error-message");

    if (!passcode) {
      log("No passcode entered.");
      return;
    }

    log("Passcode submitted: -----");
    errorMessage.textContent = ""; // Clear error
    document.getElementById("passcode-screen").style.display = "none";
    document.getElementById("animation-screen").style.display = "block";

    try {
      // Generate HMAC signature
      const signature = await generateHMAC(passcode);

      // Fetch emails from the server
      const emails = await fetchEmailsFromServer(signature);

      // Navigate to home screen and display emails
      log("Emails retrieved successfully");
      document.getElementById("animation-screen").style.display = "none";
      displayEmailsWithActions(emails, signature);
    } catch (error) {
      showError("Incorrect Passkey")
    }
  });

function showError(message) {
  document.getElementById("error-message").textContent = message;
  document.getElementById("error-screen").style.display = "flex";
  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("passcode-screen").style.display = "none";
    document.getElementById("animation-screen").style.display = "none";
  });
}


// Add functionality to the "Back" button
document.getElementById("back-button").addEventListener("click", () => {
  log("Back button clicked.");
  document.getElementById("error-screen").style.display = "none";
  document.getElementById("passcode-screen").style.display = "flex";
});
