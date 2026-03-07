import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors, getTheme } from "../theme/colors";
import { flashSaleService } from "../services/flashSaleService";
import { useToast } from "../context/ToastContext";
import { useSeller } from "../context/SellerContext";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { useResponsive } from "../hooks/useResponsive";

export const FlashSaleScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { product } = route.params || {};
  const toast = useToast();
  const { refresh, profile } = useSeller();
  const theme = profile?.theme_apply_store
    ? getTheme(profile?.theme_color || colors.primary)
    : getTheme(colors.primary);

  const [flashSalePrice, setFlashSalePrice] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 86400000)); // +1 day
  const [maxQuantity, setMaxQuantity] = useState("");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleStartDateChange = (event, selectedDate) => {
    setShowStartPicker(Platform.OS === "ios");
    if (selectedDate) {
      setStartDate(selectedDate);
      // If end date is before start date, adjust it
      if (endDate <= selectedDate) {
        setEndDate(new Date(selectedDate.getTime() + 86400000)); // +1 day
      }
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    setShowEndPicker(Platform.OS === "ios");
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const calculateDiscount = () => {
    if (!flashSalePrice || !product?.price) return 0;
    const originalPrice = product.price;
    const salePrice = parseFloat(flashSalePrice);
    if (salePrice >= originalPrice) return 0;
    return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
  };

  const validateForm = () => {
    if (!flashSalePrice.trim()) {
      toast.warning("Missing Price", "Please enter a flash sale price");
      return false;
    }

    const price = parseFloat(flashSalePrice);
    if (isNaN(price) || price <= 0) {
      toast.warning("Invalid Price", "Please enter a valid price");
      return false;
    }

    if (price >= product.price) {
      toast.warning(
        "Invalid Price",
        "Flash sale price must be lower than the original price",
      );
      return false;
    }

    if (endDate <= startDate) {
      toast.warning("Invalid Dates", "End date must be after start date");
      return false;
    }

    if (maxQuantity) {
      const qty = parseInt(maxQuantity);
      if (isNaN(qty) || qty <= 0) {
        toast.warning(
          "Invalid Quantity",
          "Max quantity must be a positive number",
        );
        return false;
      }
    }

    return true;
  };

  const handleCreateFlashSale = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const { success, error } = await flashSaleService.createFlashSale({
        productId: product.id,
        sellerId: product.seller_id,
        flashPrice: parseFloat(flashSalePrice),
        originalPrice: product.price,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        maxQuantity: maxQuantity ? parseInt(maxQuantity) : null,
      });

      if (success) {
        toast.success(
          "Flash Sale Created",
          "Your flash sale has been created successfully!",
        );
        refresh(); // Refresh seller data
        navigation.goBack();
      } else {
        toast.error("Creation Failed", error || "Failed to create flash sale");
      }
    } catch (error) {
      console.error("Flash sale creation error:", error);
      toast.error("Error", "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const discount = calculateDiscount();

  return (
    <ResponsiveContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color={theme.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Create Flash Sale</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Product Info */}
          <View style={styles.productCard}>
            <View style={styles.productHeader}>
              <Ionicons name="bag-outline" size={24} color={theme.primary} />
              <Text style={styles.productTitle} numberOfLines={2}>
                {product?.title}
              </Text>
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.originalPrice}>
                Original Price: GH₵
                {Number(product?.price || 0).toLocaleString()}
              </Text>
              <Text style={styles.category}>
                Category: {product?.category || "General"}
              </Text>
            </View>
          </View>

          {/* Flash Sale Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Flash Sale Price *</Text>
              <View style={styles.priceInputContainer}>
                <Text style={[styles.currencySymbol, { color: theme.primary }]}>
                  GH₵
                </Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0.00"
                  value={flashSalePrice}
                  onChangeText={setFlashSalePrice}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.muted}
                />
              </View>
              {flashSalePrice && discount > 0 && (
                <Text
                  style={[styles.discountPreview, { color: theme.primary }]}
                >
                  {discount}% discount
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Start Date & Time *</Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={theme.primary}
                />
                <View style={styles.dateTextContainer}>
                  <Text style={styles.dateText}>
                    {startDate.toLocaleDateString()}
                  </Text>
                  <Text style={styles.timeText}>
                    {startDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>End Date & Time *</Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={theme.primary}
                />
                <View style={styles.dateTextContainer}>
                  <Text style={styles.dateText}>
                    {endDate.toLocaleDateString()}
                  </Text>
                  <Text style={styles.timeText}>
                    {endDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Max Quantity (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Leave empty for unlimited"
                value={maxQuantity}
                onChangeText={setMaxQuantity}
                keyboardType="number-pad"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.inputHelp}>
                Limit the number of items available at this price
              </Text>
            </View>

            {/* Preview */}
            {flashSalePrice && discount > 0 && (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Flash Sale Preview</Text>
                <View style={styles.previewContent}>
                  <View style={styles.priceComparison}>
                    <Text style={styles.strikethroughPrice}>
                      GH₵{Number(product?.price || 0).toLocaleString()}
                    </Text>
                    <Text style={styles.salePrice}>
                      GH₵
                      {Number(parseFloat(flashSalePrice) || 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.discountBadge}>
                    <Ionicons name="flash" size={14} color="#fff" />
                    <Text style={styles.discountBadgeText}>
                      {discount}% OFF
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Date Pickers */}
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="datetime"
            display="default"
            onChange={handleStartDateChange}
            minimumDate={new Date()}
          />
        )}

        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="datetime"
            display="default"
            onChange={handleEndDateChange}
            minimumDate={startDate}
          />
        )}

        {/* Action Buttons */}
        <View style={styles.footer}>
          <Pressable
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[
              styles.createButton,
              { backgroundColor: theme.primary },
              submitting && styles.createButtonDisabled,
            ]}
            onPress={handleCreateFlashSale}
            disabled={submitting}
          >
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={styles.createButtonText}>
              {submitting ? "Creating..." : "Create Flash Sale"}
            </Text>
          </Pressable>
        </View>
      </View>
    </ResponsiveContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.dark,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  productHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  productTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.dark,
  },
  productDetails: {
    gap: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: colors.muted,
  },
  category: {
    fontSize: 12,
    color: colors.muted,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.dark,
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  currencySymbol: {
    paddingLeft: 16,
    paddingRight: 8,
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 16,
    fontSize: 16,
    color: colors.dark,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#fff",
    color: colors.dark,
  },
  inputHelp: {
    fontSize: 12,
    color: colors.muted,
  },
  discountPreview: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
    gap: 12,
  },
  dateTextContainer: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    color: colors.dark,
    fontWeight: "500",
  },
  timeText: {
    fontSize: 14,
    color: colors.muted,
  },
  previewCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.dark,
    marginBottom: 12,
  },
  previewContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceComparison: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  strikethroughPrice: {
    fontSize: 14,
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  salePrice: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  discountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  discountBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.muted,
  },
  createButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#EF4444",
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
