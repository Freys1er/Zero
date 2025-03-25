async function generateHMAC(secretKey) {
  console.log("Generating HMAC with secretKey:", secretKey);

  const encoder = new TextEncoder();
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Calculate days since epoch
  console.log("Days since epoch:", daysSinceEpoch);

  const message = daysSinceEpoch.toString(); // Use days since epoch as the message
  console.log("HMAC message:", message);

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

    console.log("Generated HMAC signature:", signature);
    return signature;
  } catch (error) {
    console.error("Error generating HMAC:", error.message);
    throw error;
  }
}

async function updateEmailsOnServer(signature, mode, email) {
  console.log(`Updating server with mode: ${mode}, email: ${email}`);

  const apiUrl =
    "https://script.google.com/macros/s/AKfycbxlxCngh5ANvyoTuagmxXdcN8bxen6m4smuzsQlfZTKuNyx4V5jd1q9ISqQnYMRBrtd/exec";

  const params = {
    signature: signature,
    emails: JSON.stringify({ mode, emails: [email] }),
  };

  const queryString = new URLSearchParams(params).toString();
  const url = `${apiUrl}?${queryString}`;

  console.log("Request URL:", url);

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log("Server response:", data);

    if (data.status !== "Success") {
      throw new Error(data.message || "Failed to update emails on the server.");
    }

    console.log(`Successfully updated server with mode: ${mode}, email: ${email}`);
    return true; // Successfully updated
  } catch (error) {
    console.error(`Error updating server with mode: ${mode}, email: ${email}`, error.message);
    alert(`Error: Unable to ${mode.toLowerCase()} email on server.`);
    return false; // Failed to update
  }
}

async function fetchEmailsFromServer(signature) {
  console.log("Fetching emails from server with signature:", signature);

  const apiUrl =
    "https://script.google.com/macros/s/AKfycbxlxCngh5ANvyoTuagmxXdcN8bxen6m4smuzsQlfZTKuNyx4V5jd1q9ISqQnYMRBrtd/exec";

  const params = {
    signature: signature,
    emails: JSON.stringify({ mode: "", emails: [] }),
  };

  const queryString = new URLSearchParams(params).toString();
  const url = `${apiUrl}?${queryString}`;

  console.log("Request URL for fetching emails:", url);

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log("Emails fetched from server:", data);

    if (data.status === "Success") {
      return data.emails; // Return the list of emails
    } else {
      throw new Error(data.message || "Failed to fetch emails from the server.");
    }
  } catch (error) {
    console.error("Error fetching emails:", error.message);
    alert("Error: Unable to fetch emails. Please try again.");
    return [];
  }
}



function displayEmailsWithActions(emails, signature) {
  console.log("Displaying emails:", emails);

  const homeScreen = document.getElementById("home-screen");
  homeScreen.innerHTML = "<h1>Welcome to Zero</h1>";

  // Container for the list of emails
  const emailListContainer = document.createElement("div");

  // Create a list of emails represented by <li> elements
  const emailList = document.createElement("ul");
  emailList.style.listStyle = "none";
  emailList.style.padding = "0";

  emails.forEach((email, index) => {
    const emailItem = document.createElement("li");

    // Basic styling for each email item
    emailItem.style.display = "inline-block";
    emailItem.style.padding = "10px";
    emailItem.style.margin = "5px";
    emailItem.style.border = "1px solid #ccc";
    emailItem.style.borderRadius = "4px";
    emailItem.style.cursor = "pointer";
    emailItem.style.transition = "background-color 0.3s, color 0.3s";

    emailItem.textContent = email;

    // On hover, highlight with red background and white text.
    emailItem.addEventListener("mouseover", function () {
      emailItem.style.backgroundColor = "red";
      emailItem.style.color = "#fff";
    });
    emailItem.addEventListener("mouseout", function () {
      emailItem.style.backgroundColor = "";
      emailItem.style.color = "";
    });
    // On click, delete the email.
    emailItem.addEventListener("click", async function () {
      console.log("Email clicked (delete):", email);
      const success = await updateEmailsOnServer(signature, "Remove", email);
      if (success) {
        emails.splice(index, 1);
        displayEmailsWithActions(emails, signature);
      }
    });

    emailList.appendChild(emailItem);
  });

  emailListContainer.appendChild(emailList);

  // Container for adding a new email (input and button side by side)
  const addEmailContainer = document.createElement("div");
  addEmailContainer.style.display = "flex";
  addEmailContainer.style.justifyContent = "center";
  addEmailContainer.style.alignItems = "center";
  addEmailContainer.style.position = "fixed";
  addEmailContainer.style.bottom = "0";
  addEmailContainer.style.left = "50%";
  addEmailContainer.style.transform = "translateX(-50%)";
  addEmailContainer.style.padding = "10px";
  addEmailContainer.style.backgroundColor = "black";

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.placeholder = "Enter new email";
  emailInput.style.padding = "10px";
  emailInput.style.marginRight = "10px";
  emailInput.style.flex = "1";

  const addButton = document.createElement("button");
  addButton.textContent = "Add Email";
  addButton.style.padding = "10px";
  addButton.onclick = async () => {
    const newEmail = emailInput.value.trim();
    if (newEmail) {
      console.log("Add button clicked with email:", newEmail);
      const success = await updateEmailsOnServer(signature, "Add", newEmail);
      if (success) {
        emails.push(newEmail);
        emailInput.value = "";
        displayEmailsWithActions(emails, signature);
      }
    }
  };

  addEmailContainer.appendChild(emailInput);
  addEmailContainer.appendChild(addButton);

  homeScreen.appendChild(emailListContainer);
  homeScreen.appendChild(addEmailContainer);
  homeScreen.style.display = "block";
}




document
  .getElementById("submit-passcode")
  .addEventListener("click", async () => {
    const passcode = document.getElementById("passcode").value;
    const errorMessage = document.getElementById("error-message");

    if (!passcode) {
      console.log("No passcode entered.");
      return;
    }

    console.log("Passcode submitted:", passcode);
    errorMessage.textContent = ""; // Clear error
    document.getElementById("passcode-screen").style.display = "none";
    document.getElementById("animation-screen").style.display = "block";

    try {
      // Generate HMAC signature
      const signature = await generateHMAC(passcode);

      // Fetch emails from the server
      const emails = await fetchEmailsFromServer(signature);

      // Navigate to home screen and display emails
      console.log("Emails retrieved successfully:", emails);
      document.getElementById("animation-screen").style.display = "none";
      displayEmailsWithActions(emails, signature);
    } catch (error) {
      console.error("Error during passcode submission flow:", error.message);
      document.getElementById("animation-screen").style.display = "none";
      document.getElementById("passcode-screen").style.display = "block";
      errorMessage.textContent = `Error: ${error.message}`;
    }
  });

function showError(message) {
  console.log("Showing error message:", message);
  document.getElementById("error-message").textContent = message;
  document.getElementById("error-screen").style.display = "flex";
}

// Add functionality to the "Back" button
document.getElementById("back-button").addEventListener("click", () => {
  console.log("Back button clicked.");
  document.getElementById("error-screen").style.display = "none";
  document.getElementById("passcode-screen").style.display = "block";
});