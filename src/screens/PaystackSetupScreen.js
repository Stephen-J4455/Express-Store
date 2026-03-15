import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Animated,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSeller } from "../context/SellerContext";
import { useToast } from "../context/ToastContext";
import { invokeEdgeFunction } from "../../supabase";
import { colors, getTheme } from "../theme/colors";
import { ResponsiveContainer } from "../components/ResponsiveContainer";

export const PaystackSetupScreen = ({ navigation }) => {
  const { profile, createPaystackSubaccount } = useSeller();
  const toast = useToast();
  const theme = profile?.theme_apply_store
    ? getTheme(profile?.theme_color || colors.primary)
    : getTheme(colors.primary);

  const [step, setStep] = useState(1);
  const [type, setType] = useState("bank");
  const [currency, setCurrency] = useState("NGN");
  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [bankQuery, setBankQuery] = useState("");
  const [mobileProvider, setMobileProvider] = useState("mtn");
  const [account, setAccount] = useState("");
  const [creating, setCreating] = useState(false);

  const iconAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(iconAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    if (step === 2 && type === "bank") {
      fetchBanks();
    }
  }, [step, type]);

  const fetchBanks = async () => {
    setLoadingBanks(true);
    try {
      const res = await invokeEdgeFunction("create_subaccount", {
        action: "list_banks",
        country: currency === "GHS" ? "ghana" : "nigeria",
      });
      if (res && res.data)
        setBanks(res.data.map((b) => ({ code: String(b.code), name: b.name })));
    } catch (e) {
      console.warn("Failed to load banks:", e);
    } finally {
      setLoadingBanks(false);
    }
  };

  const onCreate = async () => {
    const normalizedAccount = String(account || "")
      .replace(/\D/g, "")
      .trim();
    if (!normalizedAccount) {
      toast.error(
        type === "bank" ? "Enter account number" : "Enter phone number",
      );
      return;
    }
    if (type === "bank") {
      const expectedLen = currency === "GHS" ? 13 : 10;
      if (normalizedAccount.length !== expectedLen) {
        toast.error(
          `Account number must be ${expectedLen} digits for ${currency}`,
        );
        return;
      }
    }
    if (
      type === "mobile_money" &&
      (normalizedAccount.length < 10 || normalizedAccount.length > 13)
    ) {
      toast.error("Mobile money number must be 10 to 13 digits");
      return;
    }

    try {
      setCreating(true);
      await createPaystackSubaccount({
        settlement_bank: type === "bank" ? bankCode : mobileProvider,
        account_number: normalizedAccount,
        type,
        currency,
      });
      toast.success("Paystack subaccount created");
      navigation.goBack();
    } catch (err) {
      console.error("Create subaccount fail:", err);
      toast.error(err?.message || "Failed to create subaccount");
    } finally {
      setCreating(false);
    }
  };

  const filteredBanks = (() => {
    const q = bankQuery.trim().toLowerCase();
    const filtered = banks.filter((b) => {
      if (!q) return true;
      return (
        String(b.name || "")
          .toLowerCase()
          .includes(q) ||
        String(b.code || "")
          .toLowerCase()
          .includes(q)
      );
    });
    // Deduplicate by bank code (keep first occurrence)
    const seen = new Set();
    const unique = [];
    for (const b of filtered) {
      const key = String(b.code ?? b.name ?? "").trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(b);
      }
    }
    return unique;
  })();

  return (
    <ResponsiveContainer maxWidth={600}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.stepContainer}>
            <Animated.View
              style={[
                styles.iconWrap,
                {
                  opacity: iconAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.6],
                  }),
                },
              ]}
            >
              <Ionicons name="card" size={52} color={theme.primary} />
            </Animated.View>
            <Text style={styles.stepTitle}>Set up your Paystack account</Text>
            <Text style={styles.stepTitle}>Step {step} of 3</Text>
          </View>

          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.label}>Choose payment type</Text>
              <View style={styles.typeList}>
                <Pressable
                  style={[
                    styles.typeBtn,
                    styles.typeBtnFull,
                    type === "bank" && { borderColor: theme.primary },
                  ]}
                  onPress={() => setType("bank")}
                >
                  <Ionicons
                    name="business"
                    size={22}
                    color={type === "bank" ? theme.primary : colors.muted}
                  />
                  <Text style={styles.typeText}>Bank</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.typeBtn,
                    styles.typeBtnFull,
                    type === "mobile_money" && { borderColor: theme.primary },
                    styles.typeBtnSpacing,
                  ]}
                  onPress={() => setType("mobile_money")}
                >
                  <Ionicons
                    name="phone-portrait"
                    size={22}
                    color={
                      type === "mobile_money" ? theme.primary : colors.muted
                    }
                  />
                  <Text style={styles.typeText}>Mobile Money</Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              {type === "bank" ? (
                <>
                  <Text style={styles.label}>Choose bank</Text>
                  {loadingBanks ? (
                    <ActivityIndicator />
                  ) : (
                    <>
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search bank..."
                        value={bankQuery}
                        onChangeText={setBankQuery}
                        returnKeyType="search"
                      />
                      {filteredBanks.length === 0 ? (
                        <Text style={{ color: colors.muted, marginTop: 8 }}>
                          No banks match your search.
                        </Text>
                      ) : (
                        filteredBanks.map((b, idx) => (
                          <Pressable
                            key={`${b.code}-${idx}`}
                            style={[
                              styles.smallChip,
                              bankCode === b.code && {
                                borderColor: theme.primary,
                              },
                            ]}
                            onPress={() => setBankCode(b.code)}
                          >
                            <Text
                              style={[
                                styles.smallChipText,
                                bankCode === b.code && { color: theme.primary },
                              ]}
                            >
                              {b.name}
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.label}>Choose provider</Text>
                  <View style={styles.providerRow}>
                    {["mtn", "airteltigo", "telecel"].map((p) => (
                      <Pressable
                        key={p}
                        style={[
                          styles.typeBtn,
                          styles.typeBtnFull,
                          mobileProvider === p && {
                            borderColor: theme.primary,
                          },
                          styles.typeBtnSpacing,
                        ]}
                        onPress={() => setMobileProvider(p)}
                      >
                        <Text style={styles.typeText}>{p.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {step === 3 && (
            <View style={styles.card}>
              <Text style={styles.label}>
                {type === "bank" ? "Account number" : "Phone number"}
              </Text>
              <TextInput
                style={styles.input}
                value={account}
                onChangeText={setAccount}
                keyboardType={type === "bank" ? "numeric" : "phone-pad"}
                placeholder={
                  type === "bank" ? "Account number" : "e.g. +233..."
                }
              />
            </View>
          )}
        </ScrollView>

        <View style={styles.footer} pointerEvents="box-none">
          {step === 1 && (
            <View style={styles.footerInner}>
              <Pressable
                style={[
                  styles.primaryBtn,
                  styles.footerPrimary,
                  { backgroundColor: theme.primary },
                ]}
                onPress={() => setStep(2)}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
              </Pressable>
            </View>
          )}

          {step === 2 && (
            <View style={styles.footerInner}>
              <Pressable
                onPress={() => setStep(1)}
                style={[styles.cancelBtn, styles.footerBtn]}
              >
                <Text>Back</Text>
              </Pressable>
              <Pressable
                onPress={() => setStep(3)}
                style={[
                  styles.primaryBtn,
                  styles.footerPrimary,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
              </Pressable>
            </View>
          )}

          {step === 3 && (
            <View style={styles.footerInner}>
              <Pressable
                onPress={() => setStep(2)}
                style={[styles.cancelBtn, styles.footerBtn]}
              >
                <Text>Back</Text>
              </Pressable>
              <Pressable
                onPress={onCreate}
                style={[
                  styles.primaryBtn,
                  styles.footerPrimary,
                  { backgroundColor: theme.primary },
                ]}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </ResponsiveContainer>
  );
};

const styles = StyleSheet.create({
  stepContainer: {
    alignItems: "center",
    marginBottom: 32,
    flex: 1,
    flexDirection: "column",
    paddingTop: 20,
  },
  iconWrap: {
    backgroundColor: colors.border,
    padding: 20,
    borderRadius: 100,
  },
  stepTitle: { marginTop: 8, color: colors.muted },
  card: {
    borderRadius: 12,
    padding: 30,
    marginBottom: 12,
    flex: 1,
    flexDirection: "column",
  },
  label: {
    fontWeight: "700",
    marginBottom: 8,
    color: colors.dark,
    textAlign: "center",
  },
  typeBtn: {
    padding: 24,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "flex-start",
    flexDirection: "row",
  },
  typeBtnFull: { width: "100%" },
  typeText: { marginLeft: 12, fontWeight: "700" },
  primaryBtn: {
    padding: 24,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    padding: 24,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  smallChip: {
    padding: 24,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 6,
  },
  smallChipText: { fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 25,
    padding: 24,
    backgroundColor: colors.surface,
  },
  scrollContainer: {
    paddingTop: 40,
    paddingBottom: 140,
  },
  typeList: { flexDirection: "column", marginTop: 12 },
  typeBtnSpacing: { marginTop: 12 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  nextWrap: { marginTop: 20 },
  rowBetween: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  providerRow: { flexDirection: "column", marginTop: 12 },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 25,
    padding: 24,
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  container: { flex: 1 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 30,
    backgroundColor: "transparent",
  },
  footerInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  footerPrimary: { flex: 1 },
  footerBtn: { marginRight: 12 },
});

export default PaystackSetupScreen;
