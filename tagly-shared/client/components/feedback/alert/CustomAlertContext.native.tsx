import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { _setWebAlertFn } from "./customAlert";

export type AlertButtonStyle = "default" | "cancel" | "destructive";

export type AlertButton = {
  text?: string;
  onPress?: () => void | Promise<void>;
  style?: AlertButtonStyle;
};

type AlertContextType = {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
};

const AlertContext = createContext<AlertContextType | null>(null);

export function useCustomAlert(): AlertContextType {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useCustomAlert must be used within a CustomAlertProvider");
  }
  return context;
}

/**
 * On native, customAlert() uses Alert.alert directly, so the provider
 * just passes through children without rendering any modal.
 * The provider still exists for API consistency.
 */
export function CustomAlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const showAlert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]) => {
      // On native, this is handled by Alert.alert in customAlert.ts
      // This is just a no-op for API consistency
    },
    [],
  );

  // Register null since native uses Alert.alert directly
  useEffect(() => {
    _setWebAlertFn(null);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
    </AlertContext.Provider>
  );
}
