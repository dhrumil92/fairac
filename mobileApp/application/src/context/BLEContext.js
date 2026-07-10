import React, { createContext, useContext } from 'react';
import useBLEHook from '../hooks/useBLE';

const BLEContext = createContext(null);

export const BLEProvider = ({ children }) => {
  const bleState = useBLEHook();

  return (
    <BLEContext.Provider value={bleState}>
      {children}
    </BLEContext.Provider>
  );
};

export const useBLE = () => {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error('useBLE must be used within a BLEProvider');
  }
  return context;
};
