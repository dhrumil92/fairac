# Initialize Mobile Application (Phase 4)

We are officially beginning Phase 4! We will create a cross-platform (Android & iOS) mobile app using **Expo (React Native)**. It will be located strictly in `g:\Project\FairAC\mobileApp\application`.

## User Review Required

> [!IMPORTANT]
> **Expo Go App Required**
> Because you cannot run a mobile app inside a regular web browser, you will need to download the free **"Expo Go"** app from the Google Play Store (or Apple App Store) on your physical phone. When we start the server, it will give you a QR code. Scanning it with the Expo Go app will instantly open your new mobile app right on your phone!

## Open Questions

> [!CAUTION]
> 1. Do you want me to automatically run the initialization commands in your terminal to create the folder, or would you prefer I give you the commands to type yourself? (I recommend letting me run it automatically to save time).
> 2. Are you ready to proceed with generating the base React Native files?

## Proposed Changes

### Component: Application Initialization

#### [NEW] `g:\Project\FairAC\mobileApp\application\`
- We will run the Expo bootstrap command: `npx -y create-expo-app@latest application` inside the `mobileApp/` folder. This will automatically generate the entire React Native folder structure.

#### [NEW] Mobile Dependencies
- We will install essential libraries including:
  - `@react-navigation/native` and `@react-navigation/native-stack` (for page routing, since mobile apps don't use web URLs).
  - `axios` (to talk to your existing Node.js backend API).
  - `react-native-ble-plx` (for the Bluetooth connection to the ESP32 later).

#### [NEW] `application/src/`
- We will create a clean folder structure for our code:
  - `src/screens/` (This will hold the mobile versions of your Web Pages, like `DashboardScreen.jsx` and `LoginScreen.jsx`).
  - `src/components/` (For reusable UI pieces).
  - `src/services/` (For API and Bluetooth logic).

## Verification Plan

### Manual Verification
Once initialized, we will ask you to open your terminal and run `npm start` inside the `application/` folder. It will generate a QR code. You will scan it with the Expo Go app on your physical phone to verify the blank app successfully boots up.
