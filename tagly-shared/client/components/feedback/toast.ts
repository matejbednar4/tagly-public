import Toast, { ToastShowParams } from "react-native-toast-message";

// Hides the current toast with animation.
export function hideToast() {
  Toast.hide();
}

// Shows a toast with a smooth transition - hides any existing toast first,
// waits for the hide animation, then shows the new toast.
export function showToast(params: ToastShowParams) {
  Toast.hide();
  setTimeout(() => {
    Toast.show(params);
  }, 100);
}
