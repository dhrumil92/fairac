# FairAC: Viva & Interview Q&A Guide

*Examiners and job interviewers will try to poke holes in your system. This guide gives you the "Senior Engineer" answers to defend your architecture.*

---

### Q1: Why did you use BLE (Bluetooth) instead of connecting the ESP32 directly to Wi-Fi?
**Answer:** "University hostel Wi-Fi networks are notoriously unstable and often use captive portals (web login pages) which IoT devices cannot easily navigate. By using a pure BLE architecture, the hardware operates 100% offline. The student's mobile app—which has stable 4G/5G data—acts as a secure bridge, fetching telemetry from the offline ESP32 and syncing the billing data to our cloud backend. This guarantees the system works even during complete Wi-Fi outages."

### Q2: What happens if there is a power cut while the AC is running? Does the student lose their money?
**Answer:** "No, we engineered the system for fault tolerance. The ESP32 writes the current consumed energy (`session_kwh`) into its Non-Volatile Storage (NVS) flash memory every 60 seconds. If a power cut occurs, the hardware reboots, checks the NVS, and if an active session was running, it instantly resumes the session and the countdown. No billing data is lost."

### Q3: What if the ESP32 Flash Memory overflows because it tracks total energy forever?
**Answer:** "The total energy is tracked using a 32-bit floating-point number, which has a maximum capacity of 3.4 × 10^38. An AC unit would have to run for billions of years to overflow that variable. However, as an extra layer of security, we added strict PostgreSQL Database Constraints (`CHECK units_consumed >= 0`) on the backend to reject any mathematically impossible data, preventing hackers from injecting negative energy values to get fake refunds."

### Q4: How do you prevent two roommates from causing a race condition? For example, if both join at the exact same millisecond?
**Answer:** "We handle this at the database level using PostgreSQL ACID transactions. When a transaction is processing, we use `SELECT FOR UPDATE` to place a row-level lock on the user's wallet. This forces concurrent requests to wait in line. It is mathematically impossible for two roommates to double-spend or bypass the checks because the database guarantees the integrity of the transaction."

### Q5: If the mobile app dies or the student walks away, does the AC run forever and drain their wallet?
**Answer:** "No, the intelligence is on the edge (the hardware). When the mobile app sends the initial `START` command via BLE, it includes the exact `max_kwh` or `max_duration` limit. Once the ESP32 receives this, it tracks the limit completely autonomously. When the limit hits zero, the hardware forcefully shuts off the relay itself, completely independent of the phone."

### Q6: What if a student books a session, and then uses the 'Leave Room' feature in the app to avoid paying the final bill?
**Answer:** "We implemented strict backend checks to prevent financial deadlocks. If a student tries to leave a room, the backend API first checks if they are part of any `active` or `booked` session. If they are, the API rejects the request and throws a `403 Forbidden` error, forcing them to finish or cancel the session before they can leave."

### Q7: Why use React Native instead of Java/Swift?
**Answer:** "We wanted a cross-platform solution to cover both Android and iOS students in the hostel. React Native allowed us to maintain a single JavaScript codebase while still providing native-level access to the phone's Bluetooth hardware (via `react-native-ble-plx`) and Push Notifications."
