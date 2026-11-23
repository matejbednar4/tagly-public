import { useEffect } from "react";
import { AppState } from "react-native";

export function useOnAppResume(callback: () => void) {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        callback(); // app came back to foreground
      }
    });
    return () => subscription.remove();
  }, [callback]);
}
