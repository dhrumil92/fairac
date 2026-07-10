import { useState, useMemo } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import * as ExpoDevice from 'expo-device';
import { decode as atob, encode as btoa } from 'base-64';

// Define our specific Service and Characteristic UUIDs for the FairAC ESP32
export const FAIRAC_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const CMD_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const TELEMETRY_CHARACTERISTIC_UUID = '8b368725-7b58-45e3-979f-6893e414c5b3';

const bleManager = new BleManager();

export default function useBLE() {
  const [allDevices, setAllDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [telemetryData, setTelemetryData] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Request required permissions for Bluetooth (especially Android 12+)
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'FairAC needs Location permission to scan for the AC controller.',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const isGranted =
          result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;
        return isGranted;
      }
    } else {
      return true; // iOS permissions are handled via Info.plist / Expo config
    }
  };

  const isDuplicateDevice = (devices, nextDevice) =>
    devices.findIndex(device => nextDevice.id === device.id) > -1;

  // Scan for the ESP32 devices broadcasting our Service UUID
  const scanForPeripherals = () => {
    setIsScanning(true);
    setAllDevices([]);
    
    // Scan only for our specific FairAC service
    bleManager.startDeviceScan([FAIRAC_SERVICE_UUID], null, (error, device) => {
      if (error) {
        console.error('BLE Scan Error:', error);
        setIsScanning(false);
        return;
      }

      if (device && device.name) {
        setAllDevices(prevState => {
          if (!isDuplicateDevice(prevState, device)) {
            return [...prevState, device];
          }
          return prevState;
        });
      }
    });

    // Auto-stop scanning after 10 seconds to save battery
    setTimeout(() => {
      stopScanning();
    }, 10000);
  };

  // Securely scan and connect ONLY to the target device name
  const scanForSpecificPeripheral = (targetName, onFound) => {
    setIsScanning(true);
    bleManager.startDeviceScan([FAIRAC_SERVICE_UUID], null, (error, device) => {
      if (error) {
        console.error('BLE Scan Error:', error);
        setIsScanning(false);
        return;
      }

      if (device && device.name === targetName) {
        stopScanning();
        onFound(device);
      }
    });

    setTimeout(() => {
      stopScanning();
    }, 10000);
  };

  const stopScanning = () => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
  };

  const checkBluetoothState = async () => {
    const state = await bleManager.state();
    return state === 'PoweredOn';
  };

  // Connect to the selected device
  const connectToDevice = async (device) => {
    try {
      stopScanning();

      let connected = await bleManager.connectToDevice(device.id);
      
      // Fix for JSON truncated payloads: Request higher MTU
      if (Platform.OS === 'android') {
        connected = await bleManager.requestMTUForDevice(connected.id, 512);
      }
      
      setConnectedDevice(connected);

      // Listen for unexpected disconnections (e.g., ESP32 powers off)
      bleManager.onDeviceDisconnected(connected.id, (error, disconnectedDevice) => {
        console.log('Device disconnected unexpectedly:', disconnectedDevice?.id || 'Unknown');
        setConnectedDevice(null);
        // We intentionally do NOT clear telemetryData so the last known state remains visible
      });

      await connected.discoverAllServicesAndCharacteristics();
      startStreamingData(connected);
      return true;
    } catch (e) {
      console.error('FAILED TO CONNECT', e);
      return false;
    }
  };

  // Disconnect from the device
  const disconnectFromDevice = () => {
    if (connectedDevice) {
      bleManager.cancelDeviceConnection(connectedDevice.id);
      setConnectedDevice(null);
      setTelemetryData(null);
    }
  };

  // Forcefully disconnect all active connections (useful for global events like logout)
  const forceDisconnectAll = async () => {
    try {
      const devices = await bleManager.connectedDevices([FAIRAC_SERVICE_UUID]);
      for (const dev of devices) {
        await bleManager.cancelDeviceConnection(dev.id);
      }
      setConnectedDevice(null);
      setTelemetryData(null);
    } catch (e) {
      console.log('Force disconnect error', e);
    }
  };

  // Setup notification listener for live telemetry updates
  const startStreamingData = async (device) => {
    if (device) {
      device.monitorCharacteristicForService(
        FAIRAC_SERVICE_UUID,
        TELEMETRY_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('Error reading telemetry:', error);
            return;
          }
          
          if (!characteristic?.value) {
            console.log('No Data received');
            return;
          }

          // Decode base64 value (react-native-ble-plx returns base64 string)
          // The ESP32 will send a JSON string, which we decode
          try {
            const rawData = atob(characteristic.value); // Uses base-64 polyfill
            const parsed = JSON.parse(rawData);
            setTelemetryData(parsed);
          } catch (e) {
            console.error('Failed to parse BLE telemetry:', e);
          }
        }
      );
    } else {
      console.log('No Device Connected');
    }
  };

  // Send a command to the ESP32 (e.g. START or STOP session)
  const sendCommand = async (commandObj) => {
    if (!connectedDevice) {
      throw new Error("No device connected");
    }

    try {
      const jsonStr = JSON.stringify(commandObj);
      const base64Str = btoa(jsonStr); // Encode to base64
      
      await connectedDevice.writeCharacteristicWithResponseForService(
        FAIRAC_SERVICE_UUID,
        CMD_CHARACTERISTIC_UUID,
        base64Str
      );
      return true;
    } catch (e) {
      console.error("Failed to send command:", e);
      throw e;
    }
  };

  return {
    scanForPeripherals,
    requestPermissions,
    scanForSpecificPeripheral,
    connectToDevice,
    disconnectFromDevice,
    forceDisconnectAll,
    sendCommand,
    allDevices,
    connectedDevice,
    telemetryData,
    isScanning,
    stopScanning,
    checkBluetoothState,
  };
}
