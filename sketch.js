// Function to generate HMAC
async function generateHMAC(secretKey) {
  const encoder = new TextEncoder();
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Calculate days since epoch
  const message = daysSinceEpoch.toString(); // Use days since epoch as the message

  // Import the key
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Generate the HMAC signature
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  // Convert ArrayBuffer to Hex String
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Function to send the request
async function sendRequest() {
  const apiUrl =
    "https://script.google.com/macros/s/AKfycbwpSQ0EpqtgHBdD2txTc5GFXi5kt1poLf6UNgJzuRP400doic2afSF594NFCkbS7Mm1/exec";

  // Prompt user for the secret key
  const secretKey = prompt("Enter your passkey:"); // Prompt for passkey
  if (!secretKey) {
    alert("No passkey provided. Aborting request.");
    return;
  }

  try {
    const signature = await generateHMAC(secretKey); // Generate HMAC signature

    // Prompt for email input (optional)
    const emailInput = prompt(
      "Do you wish to add emails? Add them here with ','"
    );

    let url = `${apiUrl}?signature=${signature}`; // Create API URL with signature only
    if (emailInput) {
      // Validate and attach email parameter to the request if provided
      const emailArray = emailInput.split(","); // Parse input as JSON
      // Append emails to the query string
      const emailParam = encodeURIComponent(JSON.stringify(emailArray));
      url += `&email=${emailParam}`;
    }

    // Make the HTTP request
    const response = await fetch(url);
    const data = await response.json();

    alert(data.message); // Log server's response
  } catch (error) {
    alert(error.message);
  }
}

// Call the function to send the request
sendRequest();
