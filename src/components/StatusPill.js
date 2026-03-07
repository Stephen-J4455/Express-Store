import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

const toneMap = {
  pending: colors.warning,
  active: colors.success,
  draft: colors.muted,
  rejected: colors.danger,
  processing: colors.info,
  packed: colors.secondary,
  shipped: colors.primary,
  delivered: colors.success,
  canceled: colors.danger,
};

export const StatusPill = ({ value }) => {
  const normalized = value?.toLowerCase?.() || "pending";
  const tone = toneMap[normalized] || colors.muted;
  return (
    <View style={[styles.pill, { backgroundColor: tone + "22" }]}>
      <Text
        style={[styles.text, { color: tone }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    minWidth: 50,
    alignItems: "center",
  },
  text: {
    fontWeight: "700",
    textTransform: "capitalize",
    fontSize: 12,
  },
});
