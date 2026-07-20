# Startup Security & Privacy Roadmap

As FairAC scales from a college project into a real-world, registered startup, data privacy and security will need to evolve to comply with international and national data protection laws (like GDPR or India's DPDP Act). 

The core of FairAC (password hashing via `bcrypt` and secure HTTPS API communication) is already startup-grade. However, local data storage on the mobile app will need a strict upgrade.

---

## 1. The Current State: `AsyncStorage`
Currently, the mobile app uses **`AsyncStorage`** to keep users logged in.

- **What it is:** `AsyncStorage` is the React Native equivalent of a web browser's `localStorage`. It acts like a simple text file saved on the user's phone.
- **What we store:** We store the `fairac_token` (their digital ID card) and the `fairac_user` profile (Name, Email, Mobile Number).
- **Why it is okay for now:** For an academic project, this is the standard, easiest, and most reliable way to implement persistent login. 

## 2. The Real-World Risk
The risk does **not** occur during the login process. Passwords are safe.

The vulnerability happens **after** the user logs in. Because `AsyncStorage` is **unencrypted**, it rests in plain text on the physical phone's hard drive. 
- If a student's phone is stolen.
- And the thief "roots" or "jailbreaks" the phone to bypass the OS lock screen.
- The thief can plug the phone into a computer, access the app's internal files, and read the `AsyncStorage` data.
- They would be able to extract the user's Email, Name, and Phone Number (Personally Identifiable Information / PII).

## 3. The Startup Solution: `SecureStore`
To launch FairAC to thousands of public users and pass corporate security audits, you cannot store user emails or phone numbers in plain text.

**The Fix:**
You will swap out `AsyncStorage` for a hardware-encrypted storage solution like **`expo-secure-store`**.
- **How it works:** `SecureStore` does the exact same job (saving the token so the user stays logged in), but it encrypts the data using the phone's physical hardware security chip (the Apple Keychain on iOS, and the Android Keystore on Android).
- **The Result:** Even if a hacker steals the physical phone and roots it, the data remains scrambled and completely unreadable to them. 

## Summary for Future Scaling
When launching FairAC as a business:
1. Run `npx expo install expo-secure-store`.
2. Replace all instances of `AsyncStorage.setItem` with `SecureStore.setItemAsync` for auth tokens.
3. Remove the `fairac_user` object entirely from local storage, and instead fetch it fresh from the `/api/v1/auth/me` endpoint every time the app opens.

---

## Appendix: Complete System Threat Assessment
*No system in the world is 100% secure. While the FairAC system is incredibly strong for a college project and a small pilot, deploying to thousands of users means professional hackers (or very smart engineering students) could exploit these specific theoretical gaps that currently exist in the architecture:*

### 1. Hardware Tampering (The Biggest Risk)
Since the ESP32 is sitting physically inside a hostel room, a smart engineering student could:
- **Bypass the Relay:** They could open the box and connect the AC's live wire directly to the mains, bypassing the relay entirely. The AC would run for free forever, and the ESP32 wouldn't be able to stop it.
- **Unplug the PZEM:** If they unplug the PZEM sensor wires, the ESP32 will read 0 Watts and think the AC is off, meaning they don't get billed for the electricity they use.
- **Reflash the ESP32:** They could plug a USB-C cable into the ESP32 and upload their own custom code to fake the billing data.

### 2. Bluetooth (BLE) Spoofing
Right now, the Bluetooth connection does not require a PIN code to pair. It just broadcasts openly.
- A malicious roommate could download a generic "BLE Scanner" app on their phone.
- If they figure out the JSON format `{"cmd": "STOP"}`, they could sit in their bed and maliciously turn off their roommate's AC session over Bluetooth without using the FairAC app.

### 3. API Brute Force & DDoS (Backend)
Currently, the backend Express server does not have "Rate Limiting" installed.
- A hacker could write a Python script to try 10,000 different passwords a second on the `/api/v1/auth/login` endpoint to hack into someone's account.
- They could also spam the server with 100,000 requests per second, which would crash the Oracle Cloud server (a DDoS attack).

### 4. JWT Secret Leak
When deployed to Oracle Cloud, there is a `.env` file with `JWT_SECRET=some_random_string`.
- If that string is too simple (like "mysecret"), or if someone hacks the cloud server and steals that `.env` file, they can forge digital ID tokens and log in as any user, including the Super Admin, without knowing their password.

### Resolution for Investors
Every single startup on earth (including Uber, Swiggy, and Airbnb) launched their first version with similar gaps. For a 5-10 user pilot, none of this matters. When taking this to investors or launching as a real business, these are the exact areas where engineering teams are hired to patch things up (e.g., adding tamper-proof cases for the hardware, adding PIN-code pairing to BLE, and adding `express-rate-limit` to the server).
