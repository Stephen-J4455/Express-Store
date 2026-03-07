import { View, StyleSheet } from "react-native";
import { useResponsive } from "../hooks/useResponsive";

export const ResponsiveContainer = ({ children, maxWidth, style }) => {
  const { isWide, contentMaxWidth } = useResponsive();
  const effectiveMax = maxWidth ?? contentMaxWidth;

  return (
    <View
      style={[
        styles.root,
        isWide && {
          maxWidth: effectiveMax,
          alignSelf: "center",
          width: "100%",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});
