# FairAC: Viva Presentation Slides

*Below is the exact outline you should use to build your PowerPoint Presentation. Keep the text on the slides minimal, and use diagrams as much as possible.*

---

## Slide 1: Title Slide
- **Title:** FairAC: Decentralized AC Billing Ecosystem
- **Subtitle:** Fair split-billing using IoT, BLE, and React Native
- **Your Name & Details**

## Slide 2: The Problem
- **Current Scenario:** Hostels split room electricity bills equally among roommates.
- **The Issue:** If Roommate A runs the AC all day, Roommate B (who was in class) is forced to pay for it.
- **Result:** Financial disputes, lack of transparency, and energy wastage.

## Slide 3: The Solution (FairAC)
- A **Smart AC Controller** installed on the AC unit.
- A **Mobile App** that acts as a digital wallet and remote control.
- **Pay-as-you-go:** You only pay for the exact kWh you consume. If a roommate joins you, the cost is split dynamically in real-time.

## Slide 4: System Architecture (The "Wow" Slide)
> [!TIP]
> Copy the code block below into [Mermaid Live Editor](https://mermaid.live/) to generate a high-quality image of your architecture, and paste that image onto this slide!

```mermaid
graph TD
    subgraph Mobile App (React Native)
        UI[Student Dashboard]
        BLE_Client[BLE Module]
        FCM_Receiver[Push Notifications]
    end

    subgraph IoT Hardware (ESP32)
        BLE_Server[BLE Server]
        Core[Logic & NVS Flash]
        PZEM[PZEM-004T Meter]
        Relay[5V AC Relay]
    end

    subgraph Cloud Backend (Node.js)
        API[Express API]
        DB[(PostgreSQL)]
        FCM_Server[Firebase Cloud Messaging]
    end

    UI <--> |HTTP/REST| API
    API <--> DB
    API --> |Trigger| FCM_Server
    FCM_Server --> |Alert| FCM_Receiver

    UI <--> |Bluetooth Low Energy| BLE_Client
    BLE_Client <--> |Offline Commands| BLE_Server
    
    BLE_Server <--> Core
    Core <--> |I2C/Serial| PZEM
    Core --> |GPIO| Relay
```

## Slide 5: Why Offline-First (BLE)?
- **Challenge:** University Wi-Fi is notoriously unstable and requires complex web portal logins. IoT devices struggle to stay connected.
- **Solution:** We used Bluetooth Low Energy (BLE).
- **Result:** The ESP32 is completely offline. The Mobile App acts as a "Bridge" passing the billing data from the offline hardware to the Cloud Backend.

## Slide 6: Hardware Fault Tolerance
- **Power Cuts:** What happens if the power goes out mid-session?
- **Our Engineering:** The ESP32 writes the consumed energy (`session_kwh`) into Non-Volatile Storage (Flash Memory) every 60 seconds.
- **Recovery:** When power is restored, the ESP32 instantly resumes the session and countdown autonomously.

## Slide 7: Database & Security (Transactions)
- **Challenge:** What if two roommates try to join a session at the exact same millisecond? Or try to leave the room to avoid paying?
- **Our Engineering:** The backend uses **PostgreSQL ACID Transactions**.
- **Result:** Money is "held" (blocked) safely. We use `SELECT FOR UPDATE` locks to ensure mathematically perfect wallet balances without race conditions.

## Slide 8: Push Notifications & Collaboration
- When a student turns on the AC, the backend automatically triggers **Firebase Cloud Messaging (FCM)**.
- Roommates receive a push notification instantly.
- They can tap "Accept" on the notification to join the session and split the bill dynamically based on the exact second they joined.

## Slide 9: Conclusion & Future Scope
- **Conclusion:** Built a fully operational, fault-tolerant, fair billing ecosystem.
- **Future Scope:** 
  1. **Version 2.0 Hardware:** Moving from modules to a custom integrated PCB holding the ESP32, SMPS, and dual PZEM/Relays to govern TWO rooms simultaneously from one controller, drastically reducing manufacturing costs.
  2. Actionable push notification buttons (Accept/Reject session without opening app).
  3. Web-based Admin Dashboard & iOS App.

## Slide 10: Thank You / Q&A
- Questions?

---

## 🤖 AI Presentation Maker Prompt

*Copy and paste the exact text below into an AI Presentation Maker (like Gamma.app or Tome.app) to instantly generate your slide deck!*

**Prompt for AI:**
> "Please create a highly professional, 10-slide academic presentation for a computer science summer internship viva. The project is called 'FairAC: A Decentralized IoT and Mobile Ecosystem for Fair Air Conditioning Billing'. Use a modern, dark-mode tech aesthetic with clean typography. 
> 
> Here is the exact slide-by-slide outline to follow:
> Slide 1: Title (FairAC: Decentralized AC Billing Ecosystem. Fair split-billing using IoT, BLE, and React Native). 
> Slide 2: The Problem (Hostels split bills equally, leading to unfairness and disputes when usage differs). 
> Slide 3: The Solution (Smart AC Controller + Mobile App Digital Wallet + Pay-as-you-go split billing). 
> Slide 4: System Architecture (Leave a blank space for an image I will upload later. Mention: Mobile App, Cloud Backend, IoT ESP32). 
> Slide 5: Why Offline-First? (University Wi-Fi is unstable. Used Bluetooth Low Energy so the hardware works 100% offline). 
> Slide 6: Hardware Fault Tolerance (ESP32 saves energy data to Flash NVS memory every 60s. Auto-recovers from power cuts). 
> Slide 7: Database Transactions (Used PostgreSQL ACID transactions and row-level locks to prevent financial race conditions). 
> Slide 8: Push Notifications (Firebase Cloud Messaging instantly alerts roommates to split the bill dynamically). 
> Slide 9: Conclusion & Future Scope (Future: Version 2.0 custom PCB to govern two rooms from one ESP32 to cut manufacturing costs). 
> Slide 10: Thank You / Q&A."
