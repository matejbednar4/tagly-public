import React from "react";

export type AlertButtonStyle = "default" | "cancel" | "destructive";

export type AlertButton = {
  text?: string;
  onPress?: () => void | Promise<void>;
  style?: AlertButtonStyle;
};

type AlertContextType = {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
};

export function useCustomAlert(): AlertContextType;

export function CustomAlertProvider(props: {
  children: React.ReactNode;
}): React.JSX.Element;
