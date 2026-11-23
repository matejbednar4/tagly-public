// Type declarations for platform-specific CustomMedia
// Metro resolves to .native.tsx or .web.tsx at runtime
//
// ⚠️ Tappability gotcha: CustomMedia always renders its OWN touchable. Pass
// `onPress` to CustomMedia directly — never wrap it in an outer
// Pressable/TouchableOpacity (the inner one wins the responder fight and your
// press is swallowed). See the JSDoc on `CustomMedia` in CustomMedia.native.tsx.
export type { CustomMediaType } from "./CustomMedia.native";
export { CustomMedia } from "./CustomMedia.native";
