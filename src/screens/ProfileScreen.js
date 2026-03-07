import { useState, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  FlatList,
  RefreshControl,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { PieChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { useSeller } from "../context/SellerContext";
import { useToast } from "../context/ToastContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors, getTheme, THEMES } from "../theme/colors";
import { supabase, invokeEdgeFunction } from "../../supabase";
import { LoadingAnimation } from "../components/LoadingAnimation";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { useResponsive } from "../hooks/useResponsive";
import { FeedbackScreen } from "./FeedbackScreen";

const BADGE_CONFIG = {
  verified: { label: "Verified", icon: "checkmark-circle", color: "#10B981" },
  top_seller: { label: "Top Seller", icon: "trophy", color: "#F59E0B" },
  fast_shipping: { label: "Fast Shipping", icon: "flash", color: "#3B82F6" },
  eco_friendly: { label: "Eco Friendly", icon: "leaf", color: "#22C55E" },
  local: { label: "Local", icon: "location", color: "#8B5CF6" },
  trending: { label: "Trending", icon: "trending-up", color: "#EC4899" },
  premium: { label: "Premium", icon: "star", color: "#EAB308" },
};

const THEME_OPTIONS = Object.values(THEMES).map((t) => t.primary);

export const ProfileScreen = () => {
  const {
    profile,
    categories,
    products,
    orders,
    metrics,
    createSupportTicket,
    updateProfile,
    sellerId,
    needsSubaccount,
    createPaystackSubaccount,
  } = useSeller();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();
  const { isWide } = useResponsive();
  const theme = profile?.theme_apply_store
    ? getTheme(profile?.theme_color || colors.primary)
    : getTheme(colors.primary);
  const [activeTab, setActiveTab] = useState("main");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showLoadingPreview, setShowLoadingPreview] = useState(false);
  const [editName, setEditName] = useState(profile?.name || "");
  const [editEmail, setEditEmail] = useState(profile?.email || "");
  const [editPhone, setEditPhone] = useState(profile?.phone || "");
  const [editLocation, setEditLocation] = useState(profile?.location || "");
  const [editFulfillmentSpeed, setEditFulfillmentSpeed] = useState(
    profile?.fulfillment_speed || "",
  );
  const [editWeeklyTarget, setEditWeeklyTarget] = useState(
    profile?.weekly_target?.toString() || "",
  );
  const [editAvatar, setEditAvatar] = useState(profile?.avatar || "");
  const [editFacebook, setEditFacebook] = useState(
    profile?.social_facebook || "",
  );
  const [editInstagram, setEditInstagram] = useState(
    profile?.social_instagram || "",
  );
  const [editTwitter, setEditTwitter] = useState(profile?.social_twitter || "");
  const [editWhatsapp, setEditWhatsapp] = useState(
    profile?.social_whatsapp || "",
  );
  const [editWebsite, setEditWebsite] = useState(profile?.social_website || "");

  const [editThemeColor, setEditThemeColor] = useState(
    profile?.theme_color || colors.primary,
  );
  const [saving, setSaving] = useState(false);
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);
  const [editApplyToStore, setEditApplyToStore] = useState(
    profile?.theme_apply_store || profile?.theme_apply_store_app || false,
  );
  const [editApplyToCustomer, setEditApplyToCustomer] = useState(
    profile?.theme_apply_customer || profile?.theme_apply_customer_app || false,
  );
  // Minimal payment modal state (used when Paystack requires bank details)
  const [paymentEditVisible, setPaymentEditVisible] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  // Paystack-supported banks (fetched from edge function). Start with a small fallback list.
  const DEFAULT_PAYSTACK_BANKS = [
    { code: "044", name: "Access Bank" },
    { code: "050", name: "Ecobank" },
    { code: "058", name: "GTBank" },
    { code: "057", name: "Zenith Bank" },
    { code: "011", name: "First Bank" },
    { code: "033", name: "UBA" },
    { code: "032", name: "Sterling Bank" },
    { code: "039", name: "Stanbic IBTC" },
  ];
  const [PAYSTACK_BANKS, setPAYSTACK_BANKS] = useState(DEFAULT_PAYSTACK_BANKS);

  // (store payments removed)

  // Followers state
  const [followers, setFollowers] = useState([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [computedRating, setComputedRating] = useState(null);

  const categoryCounts = useMemo(() => {
    const counts = {};
    products
      .filter((p) => p.status === "active")
      .forEach((product) => {
        const category = product.category;
        counts[category] = (counts[category] || 0) + 1;
      });
    return counts;
  }, [products]);

  const weeklyOrderCount = useMemo(() => {
    if (!orders?.length) return 0;
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - now.getDay(),
    );
    start.setHours(0, 0, 0, 0);
    return orders.filter((o) => new Date(o.created_at) >= start).length;
  }, [orders]);

  // Jump to tab when navigated with initialTab param
  useEffect(() => {
    const tab = route.params?.initialTab;
    if (tab) setActiveTab(tab);
  }, [route.params?.initialTab]);

  // Fetch followers (kept minimal)
  const fetchFollowers = async () => {
    if (!sellerId) return;
    setFollowersLoading(true);
    try {
      const { data, error } = await supabase
        .from("express_follows")
        .select("id,created_at,user_id")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        const userIds = data.map((f) => f.user_id);
        const { data: users } = await supabase
          .from("express_profiles")
          .select("id,full_name,avatar_url")
          .in("id", userIds);
        const merged = (data || []).map((f) => ({
          ...f,
          user: (users || []).find((u) => u.id === f.user_id),
        }));
        setFollowers(merged || []);
      } else {
        setFollowers([]);
      }
    } catch (err) {
      console.error("Error fetching followers:", err);
      setFollowers([]);
    } finally {
      setFollowersLoading(false);
    }
  };

  // Load followers once in background and subscribe for realtime updates
  useEffect(() => {
    if (!sellerId) return;

    // initial load
    fetchFollowers();

    // subscribe to follower changes for this seller
    const channel = supabase
      .channel(`seller-follows-${sellerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "express_follows",
          filter: `seller_id=eq.${sellerId}`,
        },
        async (payload) => {
          try {
            if (payload.eventType === "INSERT") {
              // fetch the follower profile and prepend
              const { data: user } = await supabase
                .from("express_profiles")
                .select("id,full_name,avatar_url")
                .eq("id", payload.new.user_id)
                .single();
              const newFollow = { ...payload.new, user };
              setFollowers((prev) => [newFollow, ...(prev || [])]);
            } else if (payload.eventType === "DELETE") {
              setFollowers((prev) =>
                (prev || []).filter((f) => f.id !== payload.old.id),
              );
            } else if (payload.eventType === "UPDATE") {
              setFollowers((prev) =>
                (prev || []).map((f) =>
                  f.id === payload.new.id ? { ...f, ...payload.new } : f,
                ),
              );
            }
          } catch (err) {
            console.error("Follower realtime handling error:", err);
          }
        },
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [sellerId]);

  useEffect(() => {
    if (!editing) {
      setEditName(profile?.name || "");
      setEditEmail(profile?.email || "");
      setEditPhone(profile?.phone || "");
      setEditLocation(profile?.location || "");
      setEditFulfillmentSpeed(profile?.fulfillment_speed || "");
      setEditWeeklyTarget(profile?.weekly_target?.toString() || "");
      setEditAvatar(profile?.avatar || "");
      setEditFacebook(profile?.social_facebook || "");
      setEditInstagram(profile?.social_instagram || "");
      setEditTwitter(profile?.social_twitter || "");
      setEditWhatsapp(profile?.social_whatsapp || "");
      setEditWebsite(profile?.social_website || "");
    }
    // sync theme color and apply toggles when not editing
    if (!editing) {
      setEditThemeColor(profile?.theme_color || colors.primary);
      setEditApplyToStore(
        profile?.theme_apply_store || profile?.theme_apply_store_app || false,
      );
      setEditApplyToCustomer(
        profile?.theme_apply_customer ||
          profile?.theme_apply_customer_app ||
          false,
      );
    }
  }, [profile, editing]);

  // store payments removed

  // Compute rating fallback if SellerContext didn't provide one
  useEffect(() => {
    let mounted = true;
    const computeRating = async () => {
      try {
        if (profile?.rating != null) {
          if (mounted) setComputedRating(null);
          return;
        }
        if (!products || products.length === 0) {
          if (mounted) setComputedRating(null);
          return;
        }
        const productIds = products.map((p) => p.id).filter(Boolean);
        if (productIds.length === 0) {
          if (mounted) setComputedRating(null);
          return;
        }
        const { data, error } = await supabase
          .from("express_reviews")
          .select("rating,stars")
          .in("product_id", productIds);
        if (error) {
          console.error("Error fetching reviews for rating fallback:", error);
          if (mounted) setComputedRating(null);
          return;
        }
        const nums = (data || [])
          .map((r) => Number(r.rating ?? r.stars ?? 0))
          .filter((n) => !Number.isNaN(n));
        if (nums.length > 0) {
          const avg = nums.reduce((s, v) => s + v, 0) / nums.length;
          if (mounted) setComputedRating(Math.round(avg * 10) / 10);
        } else {
          if (mounted) setComputedRating(null);
        }
      } catch (err) {
        console.error("Compute rating error:", err);
        if (mounted) setComputedRating(null);
      }
    };
    computeRating();
    return () => {
      mounted = false;
    };
  }, [profile?.rating, products, sellerId]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      toast.error("Camera permission is required");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setEditAvatar(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const ext = uri.split(".").pop() || "jpg";
      const fileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const fileData = new Uint8Array(arrayBuffer);
      const { data, error } = await supabase.storage
        .from("express-products")
        .upload(fileName, fileData, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("express-products")
        .getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      let avatarUrl = editAvatar;
      if (
        editAvatar &&
        editAvatar !== profile?.avatar &&
        !editAvatar.startsWith("http")
      ) {
        avatarUrl = await uploadImage(editAvatar);
      }
      const updates = {
        name: editName,
        // email is intentionally not updatable from the seller app
        phone: editPhone,
        location: editLocation,
        fulfillment_speed: editFulfillmentSpeed,
        weekly_target: editWeeklyTarget ? parseFloat(editWeeklyTarget) : null,
        avatar: avatarUrl,
        social_facebook: editFacebook,
        social_instagram: editInstagram,
        social_twitter: editTwitter,
        social_whatsapp: editWhatsapp,
        social_website: editWebsite,

        theme_color: editThemeColor,
        theme_apply_store: editApplyToStore,
        theme_apply_customer: editApplyToCustomer,
      };
      await updateProfile(updates);
      setEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setEditName(profile?.name || "");
    setEditEmail(profile?.email || "");
    setEditPhone(profile?.phone || "");
    setEditLocation(profile?.location || "");
    setEditFulfillmentSpeed(profile?.fulfillment_speed || "");
    setEditWeeklyTarget(profile?.weekly_target?.toString() || "");
    setEditAvatar(profile?.avatar || "");
    setEditFacebook(profile?.social_facebook || "");
    setEditInstagram(profile?.social_instagram || "");
    setEditTwitter(profile?.social_twitter || "");
    setEditWhatsapp(profile?.social_whatsapp || "");
    setEditWebsite(profile?.social_website || "");
    setEditing(true);
  };

  const submitTicket = async () => {
    if (!subject || !message) return;
    setSubmitting(true);
    await createSupportTicket({ subject, message, priority });
    setSubject("");
    setMessage("");
    setPriority("medium");
    setSubmitting(false);
  };

  return (
    <ResponsiveContainer>
      <View style={styles.container}>
        {/* Tabs */}
        <View style={styles.tabBar}>
          <Pressable
            style={[
              styles.tab,
              activeTab === "main" && { borderBottomColor: theme.primary },
            ]}
            onPress={() => setActiveTab("main")}
          >
            <Ionicons
              name="person"
              size={20}
              color={activeTab === "main" ? theme.primary : colors.muted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "main" && { color: theme.primary },
              ]}
            >
              Main
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              activeTab === "followers" && { borderBottomColor: theme.primary },
            ]}
            onPress={() => setActiveTab("followers")}
          >
            <Ionicons
              name="people"
              size={20}
              color={activeTab === "followers" ? theme.primary : colors.muted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "followers" && { color: theme.primary },
              ]}
            >
              Followers
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              activeTab === "support" && { borderBottomColor: theme.primary },
            ]}
            onPress={() => setActiveTab("support")}
          >
            <Ionicons
              name="help-circle"
              size={20}
              color={activeTab === "support" ? theme.primary : colors.muted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "support" && { color: theme.primary },
              ]}
            >
              Support
            </Text>
          </Pressable>
          {!isWide && (
            <Pressable
              style={[
                styles.tab,
                activeTab === "feedback" && {
                  borderBottomColor: theme.primary,
                },
              ]}
              onPress={() => setActiveTab("feedback")}
            >
              <Ionicons
                name="star"
                size={20}
                color={activeTab === "feedback" ? theme.primary : colors.muted}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "feedback" && { color: theme.primary },
                ]}
              >
                Reviews
              </Text>
            </Pressable>
          )}
        </View>

        {activeTab === "feedback" ? (
          <FeedbackScreen embedded />
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
            {/* Main Tab */}
            {activeTab === "main" && (
              <View style={styles.tabContent}>
                {/* Hero */}
                <View style={styles.heroCard}>
                  <LinearGradient
                    colors={[theme.gradientStart, theme.gradientEnd]}
                    style={styles.heroGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <View style={styles.heroRow}>
                      <View style={styles.heroLeft}>
                        {profile?.avatar ? (
                          <Image
                            source={{ uri: profile.avatar }}
                            style={styles.heroAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              styles.heroAvatar,
                              styles.avatarPlaceholder,
                            ]}
                          >
                            <Ionicons name="person" size={44} color="#fff" />
                          </View>
                        )}
                        <Pressable
                          onPress={startEditing}
                          style={styles.heroEditButton}
                        >
                          <Ionicons name="pencil" size={16} color="#fff" />
                        </Pressable>
                      </View>
                      <View style={styles.heroRight}>
                        <Text style={styles.heroTitle}>
                          {profile?.name || "Seller"}
                        </Text>
                        <Text style={styles.heroSubtitle}>
                          {profile?.location || "—"}
                        </Text>
                        {/* seller badges moved to its own card below */}
                      </View>
                    </View>

                    <View style={styles.heroMetricsRow}>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Rating</Text>
                        <Text style={styles.statValue}>
                          {profile?.rating ?? computedRating ?? "--"}
                        </Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Products</Text>
                        <Text style={styles.statValue}>
                          {products.filter((p) => p.status === "active").length}
                        </Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Followers</Text>
                        <Text style={styles.statValue}>{followers.length}</Text>
                      </View>
                    </View>
                    {/* Prompt to create Paystack subaccount if missing */}
                    {needsSubaccount ? (
                      <View
                        style={[
                          styles.card,
                          {
                            marginTop: 12,
                            padding: 12,
                            backgroundColor: "#FFF8ED",
                            borderColor: "#FDE3BF",
                          },
                        ]}
                      >
                        <Text style={{ fontWeight: "600", marginBottom: 8 }}>
                          Receive payments with Paystack
                        </Text>
                        <Text style={{ color: "#6B7280", marginBottom: 8 }}>
                          We didn't find a Paystack subaccount for your store.
                          Create one now to accept payments.
                        </Text>
                        <View style={{ flexDirection: "row" }}>
                          <Pressable
                            onPress={() => navigation.navigate("PaystackSetup")}
                            style={[
                              styles.button,
                              {
                                backgroundColor: theme.primary,
                                paddingHorizontal: 16,
                              },
                            ]}
                          >
                            <Text style={{ color: "#fff", fontWeight: "600" }}>
                              Create Paystack account
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.card,
                          {
                            marginTop: 12,
                            padding: 0,
                            overflow: "hidden",
                            backgroundColor: "transparent",
                            borderColor: "transparent",
                          },
                        ]}
                      >
                        <View style={isWide && styles.visaCardWide}>
                          <LinearGradient
                            colors={["#1a1a2e", "#16213e", "#0f3460"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.visaCard}
                          >
                            {/* Top: chip + platform */}
                            <View style={styles.visaTopRow}>
                              <View style={styles.visaChip}>
                                <View style={styles.visaChipLine} />
                                <View style={styles.visaChipGrid} />
                              </View>
                              <View style={styles.visaActivePill}>
                                <View style={styles.visaActiveDot} />
                                <Text style={styles.visaActiveText}>
                                  Active
                                </Text>
                              </View>
                            </View>

                            {/* Card number */}
                            <Text style={styles.visaCardNumber}>
                              {"•••• •••• •••• " +
                                (profile?.payment_account || "0000").slice(-4)}
                            </Text>

                            {/* Bottom: name + VISA logo */}
                            <View style={styles.visaBottomRow}>
                              <View>
                                <Text style={styles.visaLabel}>
                                  Account Holder
                                </Text>
                                <Text style={styles.visaValue}>
                                  {profile?.name || "Business Account"}
                                </Text>
                              </View>
                              <Text style={styles.visaLogo}>
                                {(profile?.payment_platform || "Paystack")
                                  .toUpperCase()
                                  .slice(0, 8)}
                              </Text>
                            </View>
                          </LinearGradient>

                          <Pressable
                            onPress={() => setPaymentEditVisible(true)}
                            style={[
                              styles.visaEditButton,
                              { borderColor: theme.primary },
                            ]}
                          >
                            <Ionicons
                              name="pencil-outline"
                              size={14}
                              color={theme.primary}
                            />
                            <Text
                              style={[
                                styles.visaEditText,
                                { color: theme.primary },
                              ]}
                            >
                              Edit Payment Info
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </LinearGradient>
                </View>

                {/* Quick actions removed */}

                {/* Payment details modal — edit bank info / create subaccount */}
                <Modal
                  visible={paymentEditVisible}
                  animationType="slide"
                  transparent={false}
                  onRequestClose={() => setPaymentEditVisible(false)}
                >
                  <ScrollView
                    contentContainerStyle={{ padding: 16, paddingTop: 60 }}
                  >
                    <View style={styles.card}>
                      <Text style={styles.section}>
                        {needsSubaccount
                          ? "Add Bank Details"
                          : "Edit Payment Details"}
                      </Text>
                      <Text
                        style={{
                          color: "#6B7280",
                          marginBottom: 16,
                          fontSize: 13,
                        }}
                      >
                        {needsSubaccount
                          ? "Add your bank details to receive payments."
                          : "Update your bank details. Changes will be used for future payouts."}
                      </Text>
                      <Text style={styles.label}>Bank name</Text>
                      <TextInput
                        style={styles.input}
                        value={bankName}
                        onChangeText={setBankName}
                        placeholder="e.g. XYZ Bank"
                      />
                      <Text style={styles.label}>Account number</Text>
                      <TextInput
                        style={styles.input}
                        value={bankAccount}
                        onChangeText={setBankAccount}
                        placeholder="Account number"
                        keyboardType="numeric"
                      />

                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "flex-end",
                          gap: 12,
                          marginTop: 12,
                        }}
                      >
                        <Pressable
                          onPress={() => setPaymentEditVisible(false)}
                          style={styles.cancelButton}
                        >
                          <Text
                            style={{ color: colors.muted, fontWeight: "700" }}
                          >
                            Cancel
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={async () => {
                            if (!sellerId) return;
                            setPaymentSaving(true);
                            try {
                              // If bank name matches a known PAYSTACK_BANKS entry, store the bank code instead
                              const matched = PAYSTACK_BANKS.find(
                                (b) =>
                                  b.name.toLowerCase() ===
                                  (bankName || "").toLowerCase(),
                              );
                              const bankValueToStore = matched
                                ? matched.code
                                : bankName || null;

                              const payload = {
                                seller_id: sellerId,
                                type: "bank",
                                bank_name: bankValueToStore,
                                account_number: bankAccount || null,
                                account_name: null,
                                is_primary: true,
                              };
                              const { data: existing } = await supabase
                                .from("store_payments")
                                .select("id")
                                .eq("seller_id", sellerId)
                                .eq("type", "bank")
                                .maybeSingle();
                              if (existing?.id) {
                                await supabase
                                  .from("store_payments")
                                  .update(payload)
                                  .eq("id", existing.id);
                              } else {
                                await supabase
                                  .from("store_payments")
                                  .insert(payload);
                              }
                              setPaymentEditVisible(false);
                              // Retry creating the Paystack subaccount now that bank details exist
                              try {
                                setCreatingSubaccount(true);
                                await createPaystackSubaccount({
                                  settlement_bank: bankValueToStore,
                                  account_number: bankAccount,
                                });
                                toast.success("Paystack subaccount created");
                              } catch (err) {
                                console.error(
                                  "Retry subaccount creation failed:",
                                  err,
                                );
                                toast.error(
                                  "Failed to create Paystack subaccount after saving bank details",
                                );
                              } finally {
                                setCreatingSubaccount(false);
                              }
                            } catch (err) {
                              console.error("Error saving bank details:", err);
                              toast.error("Failed to save bank details");
                            } finally {
                              setPaymentSaving(false);
                            }
                          }}
                          style={[
                            styles.saveButton,
                            { backgroundColor: theme.primary },
                          ]}
                        >
                          {paymentSaving ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={{ color: "#fff", fontWeight: "800" }}>
                              Save
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </ScrollView>
                </Modal>

                {/* Weekly Target Progress */}
                {profile?.weekly_target > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.section}>Weekly Target</Text>
                    <View
                      style={[
                        { alignItems: "center", paddingVertical: 8 },
                        isWide && {
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 32,
                        },
                      ]}
                    >
                      {/* Explicit size container so SVG renders on web/desktop */}
                      <View
                        style={{
                          width: 148,
                          height: 148,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <PieChart
                          donut
                          data={[
                            {
                              value: Math.min(
                                weeklyOrderCount,
                                profile.weekly_target,
                              ),
                              color: theme.primary,
                            },
                            {
                              value: Math.max(
                                profile.weekly_target - weeklyOrderCount,
                                0,
                              ),
                              color: "#F1F5F9",
                            },
                          ]}
                          radius={64}
                          innerRadius={44}
                          isAnimated
                          animationDuration={800}
                          centerLabelComponent={() => (
                            <View style={{ alignItems: "center" }}>
                              <Text
                                style={{
                                  fontSize: 18,
                                  fontWeight: "900",
                                  color: colors.dark,
                                }}
                              >
                                {weeklyOrderCount}
                              </Text>
                              <Text
                                style={{ fontSize: 10, color: colors.muted }}
                              >
                                / {profile.weekly_target}
                              </Text>
                            </View>
                          )}
                        />
                      </View>
                      <View
                        style={{ alignItems: isWide ? "flex-start" : "center" }}
                      >
                        <Text
                          style={{
                            fontSize: 28,
                            fontWeight: "900",
                            color: colors.dark,
                          }}
                        >
                          {weeklyOrderCount}
                          <Text
                            style={{
                              fontSize: 16,
                              color: colors.muted,
                              fontWeight: "500",
                            }}
                          >
                            {" "}
                            / {profile.weekly_target} orders
                          </Text>
                        </Text>
                        <Text
                          style={{
                            marginTop: 6,
                            fontSize: 13,
                            color:
                              weeklyOrderCount >= profile.weekly_target
                                ? colors.success
                                : colors.muted,
                            fontWeight: "600",
                          }}
                        >
                          {weeklyOrderCount >= profile.weekly_target
                            ? "🎯 Weekly target reached!"
                            : `${profile.weekly_target - weeklyOrderCount} orders to go this week`}
                        </Text>
                        <View
                          style={{
                            marginTop: 12,
                            height: 8,
                            width: isWide ? 200 : 160,
                            backgroundColor: "#F1F5F9",
                            borderRadius: 6,
                            overflow: "hidden",
                          }}
                        >
                          <View
                            style={{
                              height: "100%",
                              width: `${Math.min(
                                (weeklyOrderCount / profile.weekly_target) *
                                  100,
                                100,
                              )}%`,
                              backgroundColor: theme.primary,
                              borderRadius: 6,
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Seller Badges */}
                <View style={styles.card}>
                  <Text style={styles.section}>Seller Badges</Text>
                  {!profile?.badges || profile.badges.length === 0 ? (
                    <Text style={styles.subtitle}>No badges yet</Text>
                  ) : (
                    <View style={styles.badgesGrid}>
                      {profile.badges.map((badgeId) => {
                        const badge = BADGE_CONFIG[badgeId];
                        if (!badge) return null;
                        return (
                          <View
                            key={badgeId}
                            style={[
                              styles.badgeItemLarge,
                              { backgroundColor: badge.color + "20" },
                            ]}
                          >
                            <Ionicons
                              name={badge.icon}
                              size={16}
                              color={badge.color}
                            />
                            <Text
                              style={[
                                styles.badgeItemText,
                                { color: badge.color },
                              ]}
                            >
                              {badge.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Followers preview */}
                <View style={styles.card}>
                  <Text style={styles.section}>Followers</Text>
                  {followers.length === 0 ? (
                    <Text style={styles.subtitle}>No followers yet</Text>
                  ) : (
                    <FlatList
                      data={followers.slice(0, 10)}
                      keyExtractor={(i) => i.id}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      renderItem={({ item }) => (
                        <View style={styles.followerPreview}>
                          {item.user?.avatar_url ? (
                            <Image
                              source={{ uri: item.user.avatar_url }}
                              style={styles.followerAvatarSmall}
                            />
                          ) : (
                            <View
                              style={[
                                styles.followerAvatarSmall,
                                styles.avatarPlaceholder,
                              ]}
                            >
                              <Ionicons
                                name="person"
                                size={20}
                                color={colors.muted}
                              />
                            </View>
                          )}
                          <Text style={styles.followerNameSmall}>
                            {item.user?.full_name || "Customer"}
                          </Text>
                        </View>
                      )}
                    />
                  )}
                </View>

                {/* Top products */}
                <View style={styles.card}>
                  <Text style={styles.section}>Top Products</Text>
                  <FlatList
                    data={products
                      .filter((p) => p.status === "active")
                      .slice(0, 8)}
                    keyExtractor={(p) => p.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => {
                      const thumb =
                        item.thumbnails?.[0] || item.thumbnail || null;
                      return (
                        <View style={styles.productPreview}>
                          {thumb ? (
                            <Image
                              source={{ uri: thumb }}
                              style={styles.productImageSmall}
                            />
                          ) : (
                            <View
                              style={[
                                styles.productImageSmall,
                                styles.avatarPlaceholder,
                              ]}
                            />
                          )}
                          <Text
                            style={[
                              styles.productTitleSmall,
                              { color: theme.primary },
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={[
                              styles.productPriceSmall,
                              { color: theme.primary },
                            ]}
                          >
                            GH₵{Number(item.price || 0).toLocaleString()}
                          </Text>
                        </View>
                      );
                    }}
                  />
                </View>
              </View>
            )}

            {/* Followers Tab */}
            {activeTab === "followers" && (
              <View style={styles.tabContent}>
                <View style={styles.card}>
                  <View style={styles.followersHeader}>
                    <Text style={styles.section}>Your Followers</Text>
                    <View
                      style={[
                        styles.followerCountBadge,
                        { backgroundColor: theme.primary + "20" },
                      ]}
                    >
                      <Text style={styles.followerCountText}>
                        {followers.length}
                      </Text>
                    </View>
                  </View>

                  {followersLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={theme.primary} />
                      <Text style={styles.loadingText}>
                        Loading followers...
                      </Text>
                    </View>
                  ) : followers.length === 0 ? (
                    <View style={styles.emptyFollowers}>
                      <Ionicons
                        name="people-outline"
                        size={64}
                        color={colors.muted}
                      />
                      <Text style={styles.emptyFollowersTitle}>
                        No followers yet
                      </Text>
                      <Text style={styles.emptyFollowersText}>
                        When customers follow your store, they'll appear here.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.followersList}>
                      {followers.map((follow) => (
                        <View key={follow.id} style={styles.followerItem}>
                          <View style={styles.followerAvatar}>
                            {follow.user?.avatar_url ? (
                              <Image
                                source={{ uri: follow.user.avatar_url }}
                                style={styles.followerAvatarImage}
                              />
                            ) : (
                              <Ionicons
                                name="person"
                                size={24}
                                color={theme.primary}
                              />
                            )}
                          </View>
                          <View style={styles.followerInfo}>
                            <Text style={styles.followerName}>
                              {follow.user?.full_name || "Customer"}
                            </Text>
                            <Text style={styles.followerDate}>
                              Followed{" "}
                              {new Date(follow.created_at).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Support Tab */}
            {activeTab === "support" && (
              <View style={styles.tabContent}>
                <View style={styles.card}>
                  <Text style={styles.section}>Need support?</Text>
                  <Text style={styles.subtitle}>
                    Create a ticket and our admin team will respond quickly.
                  </Text>
                  <Text style={styles.label}>Subject</Text>
                  <TextInput
                    style={styles.input}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="e.g. Featured placement"
                  />
                  <Text style={styles.label}>Message</Text>
                  <TextInput
                    style={[styles.input, { height: 120 }]}
                    multiline
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Share details..."
                  />

                  <View style={styles.priorityRow}>
                    {[
                      { key: "low", label: "Low" },
                      { key: "medium", label: "Medium" },
                      { key: "high", label: "High" },
                    ].map(({ key, label }) => (
                      <Pressable
                        key={key}
                        style={[
                          styles.priorityChip,
                          priority === key && styles.priorityChipActive,
                        ]}
                        onPress={() => setPriority(key)}
                      >
                        <Text
                          style={[
                            styles.priorityText,
                            priority === key && styles.priorityTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    style={[
                      styles.primaryButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={submitTicket}
                    disabled={submitting || !subject || !message}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send ticket</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* App Version - Clickable */}
        <View style={styles.versionSection}>
          <Pressable onPress={() => setShowLoadingPreview(true)}>
            <Text style={styles.versionText}>Express Seller v1.0.0</Text>
          </Pressable>
        </View>

        {/* Edit Profile Modal */}
        <Modal
          visible={editing}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setEditing(false)}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          >
            <View style={styles.card}>
              <View style={styles.header}>
                <View style={styles.avatarEdit}>
                  <Pressable onPress={pickImage} style={styles.avatarContainer}>
                    {editAvatar ? (
                      <Image
                        source={{ uri: editAvatar }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Ionicons
                          name="person"
                          size={40}
                          color={colors.muted}
                        />
                      </View>
                    )}
                    <View
                      style={[
                        styles.cameraIcon,
                        { backgroundColor: theme.primary },
                      ]}
                    >
                      <Ionicons name="camera" size={16} color="#fff" />
                    </View>
                  </Pressable>
                </View>
              </View>

              <View style={styles.editForm}>
                <Text style={styles.label}>Store Name</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Store name"
                />
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: "#F3F4F6" }]}
                  value={editEmail}
                  editable={false}
                  placeholder="Email"
                  keyboardType="email-address"
                />
                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                />
                <Text style={styles.label}>Location</Text>
                <TextInput
                  style={styles.input}
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder="Store location"
                />
                <Text style={styles.label}>Fulfillment Speed</Text>
                <TextInput
                  style={styles.input}
                  value={editFulfillmentSpeed}
                  onChangeText={setEditFulfillmentSpeed}
                  placeholder="e.g., Same day, 2-3 days"
                />
                <Text style={styles.label}>Weekly Target ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editWeeklyTarget}
                  onChangeText={setEditWeeklyTarget}
                  placeholder="Target revenue"
                  keyboardType="numeric"
                />

                <Text style={styles.sectionTitle}>Social Media Links</Text>
                <Text style={styles.label}>Facebook</Text>
                <TextInput
                  style={styles.input}
                  value={editFacebook}
                  onChangeText={setEditFacebook}
                  placeholder="https://facebook.com/yourpage"
                  keyboardType="url"
                />
                <Text style={styles.label}>Instagram</Text>
                <TextInput
                  style={styles.input}
                  value={editInstagram}
                  onChangeText={setEditInstagram}
                  placeholder="https://instagram.com/yourhandle"
                  keyboardType="url"
                />
                <Text style={styles.label}>Twitter/X</Text>
                <TextInput
                  style={styles.input}
                  value={editTwitter}
                  onChangeText={setEditTwitter}
                  placeholder="https://twitter.com/yourhandle"
                  keyboardType="url"
                />
                <Text style={styles.label}>WhatsApp</Text>
                <TextInput
                  style={styles.input}
                  value={editWhatsapp}
                  onChangeText={setEditWhatsapp}
                  placeholder="+1234567890"
                  keyboardType="phone-pad"
                />
                <Text style={styles.label}>Website</Text>
                <TextInput
                  style={styles.input}
                  value={editWebsite}
                  onChangeText={setEditWebsite}
                  placeholder="https://yourwebsite.com"
                  keyboardType="url"
                />

                {/* Payment fields moved to the Store Payments card on the main tab */}

                <Text style={styles.label}>Theme color</Text>
                <View style={styles.themeSwatchesContainer}>
                  {THEME_OPTIONS.map((c) => (
                    <View key={c} style={styles.themeSwatchItem}>
                      <Pressable onPress={() => setEditThemeColor(c)}>
                        <View
                          style={[
                            styles.themeSwatchCircle,
                            {
                              backgroundColor: c,
                              borderWidth: editThemeColor === c ? 3 : 1,
                              borderColor:
                                editThemeColor === c ? "#000" : "#E6EDF3",
                            },
                          ]}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.label, { marginBottom: 8 }]}>
                    Apply theme to
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 16,
                      alignItems: "center",
                    }}
                  >
                    <Pressable
                      onPress={() => setEditApplyToStore(!editApplyToStore)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View style={{ width: 40 }}>
                        <View
                          style={{
                            width: 36,
                            height: 20,
                            borderRadius: 12,
                            backgroundColor: editApplyToStore
                              ? theme.primary
                              : "#E5E7EB",
                            justifyContent: "center",
                          }}
                        >
                          <View
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              backgroundColor: "#fff",
                              marginLeft: editApplyToStore ? 18 : 2,
                            }}
                          />
                        </View>
                      </View>
                      <Text style={styles.tabText}>Store app</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setEditApplyToCustomer(!editApplyToCustomer)
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View style={{ width: 40 }}>
                        <View
                          style={{
                            width: 36,
                            height: 20,
                            borderRadius: 12,
                            backgroundColor: editApplyToCustomer
                              ? theme.primary
                              : "#E5E7EB",
                            justifyContent: "center",
                          }}
                        >
                          <View
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              backgroundColor: "#fff",
                              marginLeft: editApplyToCustomer ? 18 : 2,
                            }}
                          />
                        </View>
                      </View>
                      <Text style={styles.tabText}>Customer app</Text>
                    </Pressable>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: 12,
                    marginTop: 16,
                  }}
                >
                  <Pressable
                    onPress={() => setEditing(false)}
                    style={styles.cancelButton}
                  >
                    <Text style={{ color: colors.muted, fontWeight: "700" }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={saveProfile}
                    style={[
                      styles.saveButton,
                      { backgroundColor: theme.primary },
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff", fontWeight: "800" }}>
                        Save
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </Modal>

        {/* Loading Animation Preview Modal */}
        <Modal
          visible={showLoadingPreview}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setShowLoadingPreview(false)}
        >
          <View style={styles.modalContainer}>
            <Pressable
              style={styles.closeButton}
              onPress={() => setShowLoadingPreview(false)}
            >
              <View style={styles.closeButtonInner}>
                <Ionicons name="close" size={24} color={colors.dark} />
              </View>
            </Pressable>
            <LoadingAnimation />
          </View>
        </Modal>
      </View>
    </ResponsiveContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingTop: 50,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E4E8F0",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E4E8F0",
    marginBottom: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  headerView: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    backgroundColor: colors.light,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    padding: 8,
  },
  avatarEdit: {
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    padding: 10,
    backgroundColor: colors.light,
    borderRadius: 8,
  },
  saveButton: {
    padding: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  editForm: {
    marginTop: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.dark,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "uppercase",
  },
  metaValue: {
    color: colors.dark,
    marginTop: 4,
    fontWeight: "700",
  },
  section: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.dark,
    marginBottom: 12,
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tag: {
    backgroundColor: colors.light,
    padding: 12,
    borderRadius: 12,
    flexBasis: "48%",
  },
  tagTitle: {
    fontWeight: "700",
    color: colors.dark,
  },
  tagSubtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
  },
  /* New main redesign styles */
  heroCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
  },
  heroGradient: {
    padding: 18,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroLeft: {
    marginRight: 16,
    position: "relative",
  },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEditButton: {
    position: "absolute",
    right: -6,
    bottom: -6,
    backgroundColor: "#0006",
    padding: 8,
    borderRadius: 18,
  },
  heroRight: {
    flex: 1,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#fff",
    marginTop: 6,
  },
  badgeContainerSmall: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  smallBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  smallBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 10,
    borderRadius: 12,
    marginRight: 8,
  },
  statLabel: {
    color: "#fff",
    fontSize: 12,
  },
  statValue: {
    color: "#fff",
    fontWeight: "800",
    marginTop: 6,
    fontSize: 16,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  actionButton: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  actionButtonText: {
    fontWeight: "700",
    color: colors.dark,
  },

  followerPreview: {
    alignItems: "center",
    marginRight: 12,
  },
  followerAvatarSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.light,
    alignItems: "center",
    justifyContent: "center",
  },
  followerNameSmall: {
    marginTop: 6,
    fontSize: 12,
    color: colors.dark,
    fontWeight: "600",
  },
  productPreview: {
    width: 120,
    marginRight: 12,
  },
  productImageSmall: {
    width: 120,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.light,
  },
  productTitleSmall: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: colors.dark,
  },
  productPriceSmall: {
    marginTop: 4,
    fontSize: 12,
    color: colors.primary,
    fontWeight: "800",
  },
  paymentMasterCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  // Visa card styles
  visaCard: {
    borderRadius: 16,
    padding: 20,
    aspectRatio: 1.586,
    justifyContent: "space-between",
  },
  visaCardWide: {
    maxWidth: 320,
  },
  visaTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  visaChip: {
    width: 40,
    height: 30,
    backgroundColor: "#D4AF37",
    borderRadius: 5,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  visaChipLine: {
    position: "absolute",
    width: "100%",
    height: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  visaChipGrid: {
    width: "70%",
    height: "70%",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)",
    borderRadius: 2,
  },
  visaActivePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  visaActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  visaActiveText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  visaCardNumber: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 3,
    textAlign: "center",
  },
  visaBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  visaLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  visaValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  visaLogo: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1,
  },
  visaEditButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  visaEditText: {
    fontSize: 13,
    fontWeight: "700",
  },
  paymentEditButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  paymentTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#F8FAFC",
  },
  paymentTabText: {
    fontWeight: "700",
    color: colors.muted,
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E6EEF8",
    backgroundColor: "#fff",
  },
  smallChipText: {
    fontWeight: "700",
    color: colors.muted,
    fontSize: 12,
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  badgeItemLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeItemText: {
    fontWeight: "700",
  },
  themeSwatchesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 8,
  },
  themeSwatchItem: {
    width: "20%",
    alignItems: "center",
    marginBottom: 12,
  },
  themeSwatchCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  badgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  label: {
    marginTop: 16,
    marginBottom: 6,
    fontWeight: "600",
    color: colors.dark,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D8DDE8",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
  },
  priorityRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D8DDE8",
  },
  priorityChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  priorityText: {
    color: colors.dark,
    fontWeight: "600",
  },
  priorityTextActive: {
    color: "#fff",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.dark,
    marginTop: 24,
    marginBottom: 12,
  },
  // Followers styles
  followersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  followerCountBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  followerCountText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
  emptyFollowers: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyFollowersTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.dark,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyFollowersText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  followersList: {
    gap: 12,
  },
  followerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light,
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  followerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  followerAvatarImage: {
    width: 48,
    height: 48,
  },
  followerInfo: {
    flex: 1,
  },
  followerName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.dark,
  },
  followerDate: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  // Version section
  versionSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
  },
  versionText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.light,
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
  },
  closeButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.dark,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
});
