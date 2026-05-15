import { useState, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  ImageBackground,
  FlatList,
  RefreshControl,
  Modal,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { PieChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { useSeller } from "../context/SellerContext";
import { useToast } from "../context/ToastContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, getTheme, THEMES } from "../theme/colors";
import { supabase, invokeEdgeFunction } from "../../supabase";
import { LoadingAnimation } from "../components/LoadingAnimation";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { useResponsive } from "../hooks/useResponsive";
import { FeedbackScreen } from "./FeedbackScreen";
import { getImageContentType, getWebUploadPayload } from "../utils/webUpload";

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
// Supabase storage bucket for seller profile images
const PROFILE_BUCKET = "profile";

const resolveProfileImageUri = (rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value) return "";

  // Already a usable URI (remote or local preview)
  if (/^https?:\/\//i.test(value) || value.startsWith("file://")) {
    return value;
  }

  // Stored object path; convert to public URL from profile bucket
  const normalizedPath = value.replace(/^\/+/, "");
  const { data } = supabase.storage
    .from(PROFILE_BUCKET)
    .getPublicUrl(normalizedPath);
  return data?.publicUrl || "";
};

const getProfileAvatarValue = (profile) => {
  const candidates = [
    profile?.avatar,
    profile?.avatar_url,
    profile?.profile_image,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return "";
};

export const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    profile,
    categories,
    products,
    orders,
    metrics,
    updateProfile,
    sellerId,
    needsSubaccount,
    createPaystackSubaccount,
    createSupportTicket,
    deleteAccount,
  } = useSeller();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();
  const { isWide } = useResponsive();
  const theme = profile?.theme_apply_store
    ? getTheme(profile?.theme_color || colors.primary)
    : getTheme(colors.primary);
  const heroBackgroundUri = resolveProfileImageUri(
    getProfileAvatarValue(profile),
  );
  const hasHeroBackgroundImage = Boolean(heroBackgroundUri);
  const [activeTab, setActiveTab] = useState("main");
  const [editing, setEditing] = useState(false);
  const [showLoadingPreview, setShowLoadingPreview] = useState(false);
  const [editName, setEditName] = useState(profile?.name || "");
  const [editEmail, setEditEmail] = useState(profile?.email || "");
  const [editPhone, setEditPhone] = useState(profile?.phone || "");
  const [editLocation, setEditLocation] = useState(profile?.location || "");
  const [editStoreDescription, setEditStoreDescription] = useState(
    profile?.store_description || "",
  );
  const [editFulfillmentSpeed, setEditFulfillmentSpeed] = useState(
    profile?.fulfillment_speed || "",
  );
  const [editWeeklyTarget, setEditWeeklyTarget] = useState(
    profile?.weekly_target?.toString() || "",
  );
  const [editAvatar, setEditAvatar] = useState(getProfileAvatarValue(profile));
  const [editAvatarFile, setEditAvatarFile] = useState(null);
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
  // Payment editor state
  const [paymentEditVisible, setPaymentEditVisible] = useState(false);
  const [paymentType, setPaymentType] = useState("bank");
  const [paymentCurrency, setPaymentCurrency] = useState("GHS");
  const [paymentBankCode, setPaymentBankCode] = useState("");
  const [paymentBankDropdownVisible, setPaymentBankDropdownVisible] =
    useState(false);
  const [paymentMobileProvider, setPaymentMobileProvider] = useState("mtn");
  const [paymentAccount, setPaymentAccount] = useState("");
  const [paymentDetailsLoading, setPaymentDetailsLoading] = useState(false);
  const [paymentLoadError, setPaymentLoadError] = useState("");
  const [loadingPaymentBanks, setLoadingPaymentBanks] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [showFullPaymentAccount, setShowFullPaymentAccount] = useState(false);
  const [securePromptVisible, setSecurePromptVisible] = useState(false);
  const [securePassword, setSecurePassword] = useState("");
  const [secureSubmitting, setSecureSubmitting] = useState(false);
  const [secureAction, setSecureAction] = useState(null);
  const [privacyVisible, setPrivacyVisible] = useState(false);

  const PRIVACY_POLICY_TEXT = `Privacy Policy

Last updated: March 1, 2026

Your privacy is important to us. This Privacy Policy explains how ExpressMart ("we", "us", or "our") collects, uses, and protects your personal information when you use our mobile application and services.

1. Information We Collect
- Account information: name, email address, phone number and delivery addresses you provide during registration or checkout.
- Order data: products purchased, order amounts, shipping details and payment references.
- Device information: device model, operating system version, unique device identifiers and push-notification tokens used to deliver order updates.
- Usage data: pages viewed, search queries, and interactions within the app, collected to improve your experience.

We do not collect or store your payment card details. All payment processing is handled securely by our third-party payment provider (Paystack).

2. How We Use Your Information
- Process and fulfill your orders
- Send order status updates and delivery notifications
- Provide customer support and respond to your inquiries
- Personalize your shopping experience and show relevant product recommendations
- Communicate promotional offers (only with your consent)
- Detect and prevent fraud or unauthorized activity
- Improve and maintain the performance and security of our services

3. Information Sharing
- With sellers on our platform — we share your name, delivery address and order details so that sellers can fulfill your orders.
- With payment processors — we share transaction references with Paystack for payment verification.
- With delivery partners — we share delivery addresses and order details to enable shipment.
- When required by law — we may disclose information in response to valid legal requests from authorities.

We never sell your personal information to third parties for marketing purposes.

4. Data Security
- We implement industry-standard security measures to protect your personal information, including encrypted data transmission (TLS/SSL), secure database storage, access controls and regular security audits.

5. Your Rights
- Access and review the personal data we hold about you
- Update or correct inaccurate information via your Profile settings
- Request deletion of your account and associated data
- Opt out of promotional communications at any time
- Withdraw consent for data processing where consent is the legal basis

To exercise any of these rights, please contact us through the Help & Support section of the app or email expressmart233@gmail.com.

6. Data Retention
- We retain your personal information for as long as your account is active or as needed to provide you with our services. When you delete your account, we will remove your personal data within 30 days, except where retention is required by law.

7. Children's Privacy
- ExpressMart is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children.

8. Changes to This Policy
- We may update this Privacy Policy from time to time. When we make changes, we will update the Last Updated date and notify you for significant changes.

9. Contact Us
- In-app: Account → Help & Support
- Email: expressmart233@gmail.com

Company: ExpressMart`;
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
  const MOBILE_MONEY_PROVIDERS = ["mtn", "airteltigo", "telecel"];

  // (store payments removed)

  // Followers state
  const [followers, setFollowers] = useState([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [computedRating, setComputedRating] = useState(null);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportPriority, setSupportPriority] = useState("medium");
  const [supportSubmitting, setSupportSubmitting] = useState(false);

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

  const followersThisMonth = useMemo(() => {
    if (!followers?.length) return 0;
    const now = new Date();
    return followers.filter((f) => {
      const followedAt = new Date(f.created_at);
      return (
        followedAt.getMonth() === now.getMonth() &&
        followedAt.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [followers]);

  const latestFollower = useMemo(
    () => followers?.[0]?.user?.full_name || "No recent follower",
    [followers],
  );

  // Jump to tab when navigated with initialTab param
  useEffect(() => {
    const tab = route.params?.initialTab;
    if (!tab) return;

    setActiveTab(tab);
  }, [route.params?.initialTab]);

  const startEditing = () => {
    setEditName(profile?.name || "");
    setEditEmail(profile?.email || "");
    setEditPhone(profile?.phone || "");
    setEditLocation(profile?.location || "");
    setEditStoreDescription(profile?.store_description || "");
    setEditFulfillmentSpeed(profile?.fulfillment_speed || "");
    setEditWeeklyTarget(profile?.weekly_target?.toString() || "");
    setEditAvatar(getProfileAvatarValue(profile));
    setEditAvatarFile(null);
    setEditFacebook(profile?.social_facebook || "");
    setEditInstagram(profile?.social_instagram || "");
    setEditTwitter(profile?.social_twitter || "");
    setEditWhatsapp(profile?.social_whatsapp || "");
    setEditWebsite(profile?.social_website || "");
    setEditing(true);
  };

  const openSocialLink = async (cfg) => {
    if (!cfg?.value) return;
    let url = String(cfg.value).trim();
    try {
      if (cfg.type === "whatsapp") {
        const digits = url.replace(/\D/g, "");
        if (digits.length) url = `https://wa.me/${digits}`;
      } else if (cfg.type === "website") {
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      } else {
        // facebook/instagram/twitter - treat as handle when no scheme
        if (!/^https?:\/\//i.test(url)) {
          const handle = url.replace(/^@/, "");
          const domain = cfg.domain || cfg.type;
          url = `https://${domain}/${handle}`;
        }
      }

      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
      else toast.error("Cannot open link");
    } catch (err) {
      toast.error("Failed to open link");
    }
  };

  const menuSections = [
    {
      title: "Account Settings",
      items: [
        { icon: "person-outline", label: "Edit Profile", action: startEditing },
        {
          icon: "people-outline",
          label: "Followers",
          action: () => setActiveTab("followers"),
        },
        {
          icon: "notifications-outline",
          label: "Notifications",
          action: () => {
            try {
              Linking.openSettings();
            } catch (e) {
              navigation.navigate("Profile");
            }
          },
        },
      ],
    },
    {
      title: "Legal",
      items: [
        {
          icon: "help-circle-outline",
          label: "Support",
          action: () => setActiveTab("support"),
        },
        {
          icon: "document-text-outline",
          label: "Terms & Policies",
          action: () => setPrivacyVisible(true),
        },
      ],
    },
  ];

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

    return () => {
      channel?.unsubscribe?.();
    };
  }, [sellerId]);

  useEffect(() => {
    if (!editing) {
      setEditName(profile?.name || "");
      setEditEmail(profile?.email || "");
      setEditPhone(profile?.phone || "");
      setEditLocation(profile?.location || "");
      setEditStoreDescription(profile?.store_description || "");
      setEditFulfillmentSpeed(profile?.fulfillment_speed || "");
      setEditWeeklyTarget(profile?.weekly_target?.toString() || "");
      setEditAvatar(getProfileAvatarValue(profile));
      setEditAvatarFile(null);
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

  const fetchPaymentBanks = async () => {
    setLoadingPaymentBanks(true);
    try {
      const res = await invokeEdgeFunction("create_subaccount", {
        action: "list_banks",
        country: "ghana",
      });
      if (res?.data?.length) {
        const seen = new Set();
        const uniqueBanks = [];
        for (const b of res.data) {
          const code = String(b?.code || "").trim();
          const name = String(b?.name || "").trim();
          if (!code || !name) continue;
          const key = code;
          if (seen.has(key)) continue;
          seen.add(key);
          uniqueBanks.push({ code, name });
        }
        setPAYSTACK_BANKS(uniqueBanks);
      }
    } catch (err) {
      console.warn("Failed to load Paystack banks for payment editor:", err);
    } finally {
      setLoadingPaymentBanks(false);
    }
  };

  const openPaymentEditor = async () => {
    if (!sellerId) return;

    setPaymentEditVisible(true);
    setPaymentLoadError("");
    setPaymentDetailsLoading(true);

    // Defaults match the current setup flow.
    setPaymentType("bank");
    setPaymentCurrency("GHS");
    setPaymentBankCode("");
    setPaymentBankDropdownVisible(false);
    setPaymentMobileProvider("mtn");
    setPaymentAccount("");

    try {
      await fetchPaymentBanks();

      if (
        profile?.payment_platform === "paystack" &&
        profile?.payment_account
      ) {
        const subaccountCandidates = [profile?.payment_account].filter(Boolean);

        try {
          let paystackData = null;
          for (const subaccountCode of subaccountCandidates) {
            try {
              const paystackResp = await invokeEdgeFunction(
                "create_subaccount",
                {
                  action: "get_subaccount",
                  subaccount_code: subaccountCode,
                },
              );
              if (paystackResp?.data) {
                paystackData = paystackResp.data;
                break;
              }
            } catch (innerErr) {
              // Try the next candidate identifier.
            }
          }

          if (paystackData) {
            setPaymentCurrency("GHS");
            await fetchPaymentBanks();

            const settlementValue = String(
              paystackData.settlement_bank || "",
            ).toLowerCase();
            const provider = MOBILE_MONEY_PROVIDERS.find(
              (p) => p === settlementValue,
            );
            if (provider) {
              setPaymentType("mobile_money");
              setPaymentMobileProvider(provider);
            } else if (settlementValue) {
              setPaymentType("bank");
              setPaymentBankCode(String(paystackData.settlement_bank));
            }

            if (paystackData.account_number) {
              setPaymentAccount(String(paystackData.account_number));
            }
          } else {
            setPaymentLoadError(
              "Could not load existing details from Paystack. You can still update and save.",
            );
            if (profile?.account_code) {
              setPaymentAccount(String(profile.account_code));
            }
          }
        } catch (paystackErr) {
          console.warn(
            "Failed to load Paystack subaccount details:",
            paystackErr,
          );
          if (profile?.account_code) {
            setPaymentAccount(String(profile.account_code));
          }
          setPaymentLoadError(
            "Could not load existing details from Paystack. You can still update and save.",
          );
        }
      } else if (profile?.account_code) {
        setPaymentAccount(String(profile.account_code));
      }
    } catch (err) {
      console.error("Error loading payment details:", err);
      setPaymentLoadError("Failed to load existing payment details.");
    } finally {
      setPaymentDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (!paymentEditVisible || paymentType !== "bank") return;
    fetchPaymentBanks();
  }, [paymentEditVisible, paymentType]);

  const selectedPaymentBankName = useMemo(() => {
    if (!paymentBankCode) return "";
    const found = PAYSTACK_BANKS.find(
      (b) => String(b.code) === String(paymentBankCode),
    );
    return found?.name || "";
  }, [PAYSTACK_BANKS, paymentBankCode]);

  const maskedPaymentAccount = useMemo(() => {
    const raw = String(profile?.payment_account || "").trim();
    if (!raw) return "No subaccount";
    if (showFullPaymentAccount) return raw;
    return `••••${raw.slice(-4)}`;
  }, [profile?.payment_account, showFullPaymentAccount]);

  const requestSecureAction = (action) => {
    setSecureAction(action);
    setSecurePassword("");
    setSecurePromptVisible(true);
  };

  const runSecureAction = async () => {
    if (!securePassword) {
      toast.error("Enter password to continue");
      return;
    }

    setSecureSubmitting(true);
    try {
      // Handle account deletion separately to avoid double re-auth
      if (secureAction === "delete") {
        try {
          const res = await deleteAccount(securePassword);
          setSecurePromptVisible(false);
          setSecurePassword("");
          setSecureAction(null);
          if (res?.error) throw res.error;
          toast.success("Account deleted");
          try {
            await supabase.auth.signOut();
          } catch (e) {}
          return;
        } catch (err) {
          toast.error(err?.message || "Account deletion failed");
          return;
        }
      }
      let email = profile?.email || "";
      if (!email) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        email = user?.email || "";
      }
      if (!email) throw new Error("Could not resolve account email");

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: securePassword,
      });
      if (error) throw error;

      setSecurePromptVisible(false);
      setSecurePassword("");

      if (secureAction === "edit") {
        await openPaymentEditor();
      } else if (secureAction === "reveal") {
        setShowFullPaymentAccount(true);
      }
      setSecureAction(null);
    } catch (err) {
      toast.error(err?.message || "Password verification failed");
    } finally {
      setSecureSubmitting(false);
    }
  };

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
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        toast.error("Camera permission is required");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      const selectedAsset = result.assets[0];
      setEditAvatar(selectedAsset.uri);
      if (Platform.OS === "web") {
        setEditAvatarFile(selectedAsset.file || null);
      }
    }
  };

  const uploadImage = async (uri, pickedFile = null) => {
    try {
      console.log("uploadImage start:", { uri, platform: Platform.OS });

      const getImageExtension = (imageUri) => {
        const cleanUri = imageUri?.split("?")[0] || "";
        const fileNameSegment = cleanUri.split("/").pop() || "";
        const ext = fileNameSegment.includes(".")
          ? fileNameSegment.split(".").pop()?.toLowerCase()
          : null;

        if (!ext || ext.length > 5) return "jpg";
        return ext === "jpeg" ? "jpg" : ext;
      };

      const ext = getImageExtension(uri);
      const fileName = `avatar.${ext}`;
      const objectPath = sellerId ? `${sellerId}/${fileName}` : fileName;

      const contentType = getImageContentType(uri);

      // Ensure we replace any previous avatar files for this seller by cleaning the folder first
      if (sellerId) {
        try {
          const { data: existing, error: listErr } = await supabase.storage
            .from(PROFILE_BUCKET)
            .list(sellerId);
          if (listErr) {
            console.warn("Failed to list existing profile objects:", listErr);
          } else if (existing && existing.length > 0) {
            const pathsToDelete = (existing || []).map(
              (e) => `${sellerId}/${e.name}`,
            );
            const { error: removeErr } = await supabase.storage
              .from(PROFILE_BUCKET)
              .remove(pathsToDelete);
            if (removeErr) {
              console.warn(
                "Failed to remove existing avatar files:",
                removeErr,
              );
            } else {
              console.log("Removed existing avatar files:", pathsToDelete);
            }
          }
        } catch (e) {
          console.warn("Error cleaning existing profile images:", e);
        }
      }

      // Use Blob on web, FormData on native (React Native) to ensure uploads work across platforms
      let uploadRes;
      if (Platform.OS === "web") {
        const { fileBody, contentType: resolvedContentType } =
          await getWebUploadPayload({
            uri,
            pickedFile,
            preferredContentType: contentType,
          });
        uploadRes = await supabase.storage
          .from(PROFILE_BUCKET)
          .upload(objectPath, fileBody, {
            contentType: resolvedContentType,
            cacheControl: "3600",
            upsert: true,
          });
      } else {
        const formDataUpload = new FormData();
        formDataUpload.append("file", {
          uri: uri,
          type: contentType,
          name: fileName,
        });

        uploadRes = await supabase.storage
          .from(PROFILE_BUCKET)
          .upload(objectPath, formDataUpload, {
            contentType,
            cacheControl: "3600",
            upsert: true,
          });
      }

      console.log("supabase.storage.upload result:", uploadRes);
      if (uploadRes.error) throw uploadRes.error;

      const { data: urlData } = supabase.storage
        .from(PROFILE_BUCKET)
        .getPublicUrl(objectPath);
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
        editAvatar !== getProfileAvatarValue(profile) &&
        !editAvatar.startsWith("http")
      ) {
        avatarUrl = await uploadImage(editAvatar, editAvatarFile);
      }
      const updates = {
        name: editName,
        // email is intentionally not updatable from the seller app
        phone: editPhone,
        location: editLocation,
        store_description: editStoreDescription.trim() || null,
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
      setEditAvatarFile(null);
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const submitSupport = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) {
      toast.error("Add a subject and message");
      return;
    }

    try {
      setSupportSubmitting(true);
      await createSupportTicket({
        subject: supportSubject.trim(),
        message: supportMessage.trim(),
        priority: supportPriority,
      });
      setSupportSubject("");
      setSupportMessage("");
      setSupportPriority("medium");
      toast.success("Support request sent");
    } catch (error) {
      toast.error("Failed to send support request");
    } finally {
      setSupportSubmitting(false);
    }
  };
  return (
    <ResponsiveContainer>
      <View style={styles.container}>
        {/* Tabs */}
        <View style={styles.profileTabBar}>
          <Pressable
            style={[
              styles.profileTabItem,
              activeTab === "main" && {
                backgroundColor: `${theme.primary}15`,
              },
            ]}
            onPress={() => setActiveTab("main")}
          >
            <Ionicons
              name="person"
              size={16}
              color={activeTab === "main" ? theme.primary : colors.muted}
            />
            <Text
              style={[
                styles.profileTabText,
                activeTab === "main" && { color: theme.primary },
              ]}
            >
              Main
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.profileTabItem,
              activeTab === "followers" && {
                backgroundColor: `${theme.primary}15`,
              },
            ]}
            onPress={() => setActiveTab("followers")}
          >
            <Ionicons
              name="people"
              size={16}
              color={activeTab === "followers" ? theme.primary : colors.muted}
            />
            <Text
              style={[
                styles.profileTabText,
                activeTab === "followers" && { color: theme.primary },
              ]}
            >
              Followers
            </Text>
            {followers.length > 0 && (
              <View
                style={[
                  styles.profileTabBadge,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Text style={styles.profileTabBadgeText}>
                  {followers.length}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.profileTabItem,
              activeTab === "support" && {
                backgroundColor: `${theme.primary}15`,
              },
            ]}
            onPress={() => setActiveTab("support")}
          >
            <Ionicons
              name="help-circle"
              size={16}
              color={activeTab === "support" ? theme.primary : colors.muted}
            />
            <Text
              style={[
                styles.profileTabText,
                activeTab === "support" && { color: theme.primary },
              ]}
            >
              Support
            </Text>
          </Pressable>

          {!isWide && (
            <Pressable
              style={[
                styles.profileTabItem,
                activeTab === "feedback" && {
                  backgroundColor: `${theme.primary}15`,
                },
              ]}
              onPress={() => setActiveTab("feedback")}
            >
              <Ionicons
                name="star"
                size={16}
                color={activeTab === "feedback" ? theme.primary : colors.muted}
              />
              <Text
                style={[
                  styles.profileTabText,
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
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 40,
            }}
          >
            {activeTab === "main" && (
              <>
                {/* Profile hero */}
                <View style={[styles.heroCard]}>
                  <ImageBackground
                    source={
                      hasHeroBackgroundImage ? { uri: heroBackgroundUri } : null
                    }
                    style={[
                      styles.heroGradient,
                      !hasHeroBackgroundImage && {
                        backgroundColor: theme.primary,
                      },
                    ]}
                    imageStyle={styles.heroBackgroundImage}
                  >
                    <LinearGradient
                      colors={[
                        "rgba(12,18,30,0.72)",
                        "rgba(14,26,43,0.6)",
                        "rgba(14,26,43,0.72)",
                      ]}
                      style={styles.heroOverlay}
                    >
                      <View style={styles.heroRow}>
                        <View style={styles.heroRight}>
                          <View style={styles.heroTopActions}>
                            <Pressable
                              style={styles.heroEditButton}
                              onPress={startEditing}
                            >
                              <Ionicons name="pencil" size={14} color="#fff" />
                              <Text style={styles.heroEditButtonText}>
                                Edit
                              </Text>
                            </Pressable>
                          </View>
                          <Text style={styles.heroTitle}>
                            {profile?.name || "Seller"}
                          </Text>
                          <Text style={styles.heroSubtitle}>
                            {profile?.location || ""}
                          </Text>
                          {!!profile?.badges?.length && (
                            <View style={styles.heroBadgeRow}>
                              {profile.badges.slice(0, 4).map((badgeId) => {
                                const badge = BADGE_CONFIG[badgeId];
                                if (!badge) return null;
                                return (
                                  <View
                                    key={badgeId}
                                    style={[
                                      styles.heroBadgeChip,
                                      { backgroundColor: `${badge.color}33` },
                                    ]}
                                  >
                                    <Ionicons
                                      name={badge.icon}
                                      size={12}
                                      color="#fff"
                                    />
                                    <Text style={styles.heroBadgeChipText}>
                                      {badge.label}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                          {/* Social links row */}
                          {(() => {
                            const socialConfigs = [
                              {
                                key: "social_facebook",
                                icon: "logo-facebook",
                                type: "facebook",
                                domain: "facebook.com",
                              },
                              {
                                key: "social_instagram",
                                icon: "logo-instagram",
                                type: "instagram",
                                domain: "instagram.com",
                              },
                              {
                                key: "social_twitter",
                                icon: "logo-twitter",
                                type: "twitter",
                                domain: "twitter.com",
                              },
                              {
                                key: "social_whatsapp",
                                icon: "logo-whatsapp",
                                type: "whatsapp",
                              },
                              {
                                key: "social_website",
                                icon: "globe-outline",
                                type: "website",
                              },
                            ];
                            const links = socialConfigs
                              .map((c) => ({ ...c, value: profile?.[c.key] }))
                              .filter((s) => s.value && String(s.value).trim());

                            if (links.length === 0) return null;
                            return (
                              <View style={styles.heroSocialRow}>
                                {links.map((s) => (
                                  <Pressable
                                    key={s.key}
                                    style={styles.socialIcon}
                                    onPress={() => openSocialLink(s)}
                                  >
                                    <Ionicons
                                      name={s.icon}
                                      size={16}
                                      color="#fff"
                                    />
                                  </Pressable>
                                ))}
                              </View>
                            );
                          })()}
                          <View style={styles.heroMetricsRow}>
                            <View style={styles.statBox}>
                              <Text style={styles.statLabel}>Orders</Text>
                              <Text style={styles.statValue}>
                                {orders?.length || 0}
                              </Text>
                            </View>
                            <View style={styles.statBox}>
                              <Text style={styles.statLabel}>Followers</Text>
                              <Text style={styles.statValue}>
                                {followers.length}
                              </Text>
                            </View>
                            <View style={styles.statBox}>
                              <Text style={styles.statLabel}>Products</Text>
                              <Text style={styles.statValue}>
                                {products?.filter((p) => p.status === "active")
                                  .length || 0}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </ImageBackground>
                </View>

                {/* Paystack / Payout card */}
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
                            <View
                              style={[
                                styles.visaActiveDot,
                                !profile?.account_verified &&
                                  styles.visaInactiveDot,
                              ]}
                            />
                            <Text style={styles.visaActiveText}>
                              {profile?.account_verified
                                ? "Verified"
                                : "Unverified"}
                            </Text>
                          </View>
                        </View>

                        {/* Card number */}
                        <View style={styles.visaNumberRow}>
                          <Text style={styles.visaCardNumber}>
                            {maskedPaymentAccount}
                          </Text>
                          <Pressable
                            onPress={() => {
                              if (showFullPaymentAccount)
                                setShowFullPaymentAccount(false);
                              else requestSecureAction("reveal");
                            }}
                            style={styles.visaRevealBtn}
                          >
                            <Ionicons
                              name={
                                showFullPaymentAccount
                                  ? "eye-off-outline"
                                  : "eye-outline"
                              }
                              size={16}
                              color="#fff"
                            />
                          </Pressable>
                        </View>

                        {/* Bottom: name + VISA logo */}
                        <View style={styles.visaBottomRow}>
                          <View>
                            <Text style={styles.visaLabel}>Account Holder</Text>
                            <Text style={styles.visaValue}>
                              {profile?.name || "Business Account"}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.visaLogo}>
                              {(profile?.payment_platform || "Paystack")
                                .toUpperCase()
                                .slice(0, 8)}
                            </Text>
                            <Text
                              style={[
                                styles.visaSubValue,
                                styles.visaSubValueRight,
                              ]}
                            >
                              {profile?.account_code || "Not set"}
                            </Text>
                          </View>
                        </View>
                      </LinearGradient>

                      <Pressable
                        onPress={() => requestSecureAction("edit")}
                        style={[
                          styles.visaEditButton,
                          { borderColor: "#E2E8F0" },
                        ]}
                      >
                        <Ionicons
                          name="pencil-outline"
                          size={14}
                          color={colors.dark}
                        />
                        <Text
                          style={[styles.visaEditText, { color: colors.dark }]}
                        >
                          Edit Payment Info
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Menu Sections */}
                {menuSections.map((section) => (
                  <View
                    key={section.title}
                    style={[styles.card, { marginTop: 12 }]}
                  >
                    <Text style={styles.section}>{section.title}</Text>
                    <View>
                      {section.items.map((item, idx) => (
                        <Pressable
                          key={item.label}
                          style={[
                            styles.menuItem,
                            idx < section.items.length - 1 &&
                              styles.menuItemBorder,
                          ]}
                          onPress={() => item.action && item.action()}
                        >
                          <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconContainer}>
                              <Ionicons
                                name={item.icon}
                                size={20}
                                color={colors.muted}
                              />
                            </View>
                            <Text style={styles.menuItemLabel}>
                              {item.label}
                            </Text>
                          </View>
                          <View style={styles.menuItemRight}>
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color="#CBD5E1"
                            />
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}

                {/* Danger Zone */}
                <View
                  style={[
                    styles.card,
                    {
                      marginTop: 8,
                      backgroundColor: "#FFF8F8",
                      borderColor: "#FEE2E2",
                    },
                  ]}
                >
                  <Text style={styles.section}>Danger Zone</Text>
                  <Text style={{ color: colors.muted, marginBottom: 12 }}>
                    Permanently delete your seller account and all associated
                    data. This action cannot be undone.
                  </Text>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        "Delete Account",
                        "This permanently deletes your seller account and cannot be undone.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Continue",
                            style: "destructive",
                            onPress: () => requestSecureAction("delete"),
                          },
                        ],
                      )
                    }
                    style={[
                      styles.saveButton,
                      { backgroundColor: "#EF4444", alignItems: "center" },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800" }}>
                      Delete Account
                    </Text>
                  </Pressable>
                </View>

                {/* Quick actions removed */}

                {/* Payment details modal — edit bank info / create subaccount */}
                <Modal
                  visible={paymentEditVisible}
                  animationType="slide"
                  transparent={false}
                  statusBarTranslucent
                  onRequestClose={() => setPaymentEditVisible(false)}
                >
                  <ScrollView
                    contentContainerStyle={[
                      styles.editPageContainer,
                      { paddingTop: Math.max(insets.top, 0) + 12 },
                    ]}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.editHeroWrap}>
                      <LinearGradient
                        colors={["#0F172A", "#1E293B"]}
                        style={styles.editHeroGradient}
                      >
                        <Pressable
                          onPress={() => setPaymentEditVisible(false)}
                          style={styles.editHeroCloseButton}
                        >
                          <Ionicons name="close" size={18} color="#fff" />
                        </Pressable>
                        <Text style={styles.editHeroTitle}>
                          {needsSubaccount
                            ? "Add Payment Details"
                            : "Edit Payment Details"}
                        </Text>
                        <Text style={styles.editHeroSubtitle}>
                          {needsSubaccount
                            ? "Set up payout details to start receiving funds."
                            : "Update payout destination for your Paystack account."}
                        </Text>
                      </LinearGradient>
                    </View>

                    <View style={styles.card}>
                      <Text style={styles.section}>Payout Setup</Text>

                      {paymentLoadError ? (
                        <Text style={styles.paymentErrorText}>
                          {paymentLoadError}
                        </Text>
                      ) : null}

                      {paymentDetailsLoading ? (
                        <View style={styles.paymentLoadingWrap}>
                          <ActivityIndicator color={theme.primary} />
                          <Text style={styles.paymentLoadingText}>
                            Loading existing payment details...
                          </Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.label}>Payment type</Text>
                          <View style={styles.typeList}>
                            <Pressable
                              style={[
                                styles.typeBtn,
                                styles.typeBtnFull,
                                paymentType === "bank" && {
                                  borderColor: theme.primary,
                                },
                              ]}
                              onPress={() => setPaymentType("bank")}
                            >
                              <Ionicons
                                name="business"
                                size={20}
                                color={
                                  paymentType === "bank"
                                    ? theme.primary
                                    : colors.muted
                                }
                              />
                              <Text style={styles.typeText}>Bank</Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.typeBtn,
                                styles.typeBtnFull,
                                styles.typeBtnSpacing,
                                paymentType === "mobile_money" && {
                                  borderColor: theme.primary,
                                },
                              ]}
                              onPress={() => setPaymentType("mobile_money")}
                            >
                              <Ionicons
                                name="phone-portrait"
                                size={20}
                                color={
                                  paymentType === "mobile_money"
                                    ? theme.primary
                                    : colors.muted
                                }
                              />
                              <Text style={styles.typeText}>Mobile Money</Text>
                            </Pressable>
                          </View>

                          <View style={styles.editInfoPill}>
                            <Ionicons
                              name="wallet-outline"
                              size={14}
                              color={colors.muted}
                            />
                            <Text style={styles.editInfoPillText}>
                              Currency: GHS
                            </Text>
                          </View>

                          {paymentType === "bank" ? (
                            <>
                              <Text style={styles.label}>Choose bank</Text>
                              <Pressable
                                style={styles.dropdownTrigger}
                                onPress={() =>
                                  !loadingPaymentBanks &&
                                  setPaymentBankDropdownVisible(true)
                                }
                              >
                                <Text
                                  style={[
                                    styles.dropdownValue,
                                    !selectedPaymentBankName &&
                                      styles.dropdownPlaceholder,
                                  ]}
                                >
                                  {loadingPaymentBanks
                                    ? "Loading banks..."
                                    : selectedPaymentBankName || "Select bank"}
                                </Text>
                                <Ionicons
                                  name="chevron-down"
                                  size={18}
                                  color={colors.muted}
                                />
                              </Pressable>
                            </>
                          ) : (
                            <>
                              <Text style={styles.label}>Choose provider</Text>
                              <View style={styles.typeList}>
                                {MOBILE_MONEY_PROVIDERS.map((p) => (
                                  <Pressable
                                    key={p}
                                    style={[
                                      styles.typeBtn,
                                      styles.typeBtnFull,
                                      styles.typeBtnSpacing,
                                      paymentMobileProvider === p && {
                                        borderColor: theme.primary,
                                      },
                                    ]}
                                    onPress={() => setPaymentMobileProvider(p)}
                                  >
                                    <Text style={styles.typeText}>
                                      {p.toUpperCase()}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </>
                          )}

                          <Text style={styles.label}>
                            {paymentType === "bank"
                              ? "Account number"
                              : "Phone number"}
                          </Text>
                          <TextInput
                            style={styles.input}
                            value={paymentAccount}
                            onChangeText={setPaymentAccount}
                            placeholder={
                              paymentType === "bank"
                                ? "Account number"
                                : "e.g. +233..."
                            }
                            keyboardType={
                              paymentType === "bank" ? "numeric" : "phone-pad"
                            }
                          />
                        </>
                      )}

                      <View style={styles.editActionsRow}>
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
                              const selectedSettlement =
                                paymentType === "bank"
                                  ? paymentBankCode
                                  : paymentMobileProvider;
                              const normalizedAccount = String(
                                paymentAccount || "",
                              )
                                .replace(/\D/g, "")
                                .trim();

                              if (!selectedSettlement) {
                                toast.error(
                                  paymentType === "bank"
                                    ? "Select a bank"
                                    : "Select a mobile money provider",
                                );
                                return;
                              }
                              if (!normalizedAccount) {
                                toast.error(
                                  paymentType === "bank"
                                    ? "Enter account number"
                                    : "Enter phone number",
                                );
                                return;
                              }
                              if (
                                paymentType === "bank" &&
                                normalizedAccount.length !== 13
                              ) {
                                toast.error(
                                  "Bank account number must be 13 digits for GHS",
                                );
                                return;
                              }
                              if (
                                paymentType === "mobile_money" &&
                                (normalizedAccount.length < 10 ||
                                  normalizedAccount.length > 13)
                              ) {
                                toast.error(
                                  "Mobile money number must be 10 to 13 digits",
                                );
                                return;
                              }

                              try {
                                setCreatingSubaccount(true);
                                await createPaystackSubaccount({
                                  settlement_bank: selectedSettlement,
                                  account_number: normalizedAccount,
                                  type: paymentType,
                                  currency: paymentCurrency,
                                });
                                setPaymentEditVisible(false);
                                toast.success("Payment details updated");
                              } catch (err) {
                                console.error(
                                  "Retry subaccount creation failed:",
                                  err,
                                );
                                toast.error(
                                  "Failed to update Paystack payment details",
                                );
                              } finally {
                                setCreatingSubaccount(false);
                              }
                            } catch (err) {
                              console.error(
                                "Error saving payment details:",
                                err,
                              );
                              toast.error("Failed to update payment details");
                            } finally {
                              setPaymentSaving(false);
                            }
                          }}
                          style={[
                            styles.saveButton,
                            { backgroundColor: theme.primary },
                          ]}
                          disabled={paymentDetailsLoading || paymentSaving}
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

                <Modal
                  visible={paymentBankDropdownVisible}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setPaymentBankDropdownVisible(false)}
                >
                  <Pressable
                    style={styles.dropdownBackdrop}
                    onPress={() => setPaymentBankDropdownVisible(false)}
                  >
                    <View style={styles.dropdownSheet}>
                      <Text style={styles.dropdownTitle}>Select bank</Text>
                      <ScrollView style={styles.dropdownList}>
                        {PAYSTACK_BANKS.map((b, idx) => (
                          <Pressable
                            key={`${String(b.code)}-${String(b.name)}-${idx}`}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setPaymentBankCode(String(b.code));
                              setPaymentBankDropdownVisible(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.dropdownItemText,
                                paymentBankCode === String(b.code) && {
                                  color: theme.primary,
                                },
                              ]}
                            >
                              {b.name}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </Pressable>
                </Modal>

                <Modal
                  visible={securePromptVisible}
                  transparent
                  animationType="fade"
                  onRequestClose={() => {
                    setSecurePromptVisible(false);
                    setSecurePassword("");
                    setSecureAction(null);
                  }}
                >
                  <Pressable
                    style={styles.dropdownBackdrop}
                    onPress={() => {
                      setSecurePromptVisible(false);
                      setSecurePassword("");
                      setSecureAction(null);
                    }}
                  >
                    <Pressable style={styles.dropdownSheet} onPress={() => {}}>
                      <Text style={styles.dropdownTitle}>Confirm Password</Text>
                      <Text style={styles.paymentHintText}>
                        Enter your password to continue.
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={securePassword}
                        onChangeText={setSecurePassword}
                        secureTextEntry
                        autoCapitalize="none"
                        placeholder="Password"
                      />
                      <View style={styles.secureActionsRow}>
                        <Pressable
                          style={styles.cancelButton}
                          onPress={() => {
                            setSecurePromptVisible(false);
                            setSecurePassword("");
                            setSecureAction(null);
                          }}
                        >
                          <Text
                            style={{ color: colors.muted, fontWeight: "700" }}
                          >
                            Cancel
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.saveButton,
                            { backgroundColor: theme.primary },
                          ]}
                          onPress={runSecureAction}
                          disabled={secureSubmitting}
                        >
                          {secureSubmitting ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={{ color: "#fff", fontWeight: "800" }}>
                              Continue
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </Pressable>
                  </Pressable>
                </Modal>
              </>
            )}

            {/* Followers Tab */}
            {activeTab === "followers" && (
              <View style={[styles.tabContent, styles.followersPageContent]}>
                <LinearGradient
                  colors={["#0F172A", "#1E293B", "#0F172A"]}
                  style={styles.followersHero}
                >
                  <View style={styles.followersHeroHeader}>
                    <View>
                      <Text style={styles.followersHeroTitle}>Followers</Text>
                      <Text style={styles.followersHeroSubtitle}>
                        Community growth and latest supporter activity
                      </Text>
                    </View>
                    <View style={styles.followersHeroBadge}>
                      <Ionicons name="people" size={14} color="#fff" />
                      <Text style={styles.followersHeroBadgeText}>
                        {followers.length}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.followersSummaryGrid}>
                    <View style={styles.followersSummaryCard}>
                      <Text style={styles.followersSummaryLabel}>
                        Total followers
                      </Text>
                      <Text style={styles.followersSummaryValue}>
                        {followers.length}
                      </Text>
                    </View>
                    <View style={styles.followersSummaryCard}>
                      <Text style={styles.followersSummaryLabel}>
                        New this month
                      </Text>
                      <Text style={styles.followersSummaryValue}>
                        {followersThisMonth}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.followersLatestRow}>
                    <Ionicons
                      name="sparkles-outline"
                      size={14}
                      color="rgba(255,255,255,0.85)"
                    />
                    <Text style={styles.followersLatestText}>
                      Latest follower: {latestFollower}
                    </Text>
                  </View>
                </LinearGradient>

                {followersLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={styles.loadingText}>Loading followers...</Text>
                  </View>
                ) : followers.length === 0 ? (
                  <View style={styles.emptyFollowers}>
                    <Ionicons name="people-outline" size={44} color="#94A3B8" />
                    <Text style={styles.emptyFollowersTitle}>No followers yet</Text>
                    <Text style={styles.emptyFollowersText}>
                      Your followers will appear here as customers follow your
                      store.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.followersList}>
                    {followers.map((follow, index) => {
                      const followerName = follow.user?.full_name || "Customer";
                      const initials = followerName
                        .split(" ")
                        .map((part) => part?.[0] || "")
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      const followedDate = new Date(
                        follow.created_at,
                      ).toLocaleDateString();

                      return (
                        <View key={follow.id} style={styles.followerItemRedesign}>
                          <View style={styles.followerRankBadge}>
                            <Text style={styles.followerRankText}>
                              #{index + 1}
                            </Text>
                          </View>
                          <View style={styles.followerAvatar}>
                            {follow.user?.avatar_url ? (
                              <Image
                                source={{ uri: follow.user.avatar_url }}
                                style={styles.followerAvatarImage}
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.followerAvatarInitials,
                                  { color: theme.primary },
                                ]}
                              >
                                {initials || "CU"}
                              </Text>
                            )}
                          </View>
                          <View style={styles.followerInfo}>
                            <Text style={styles.followerName}>{followerName}</Text>
                            <View style={styles.followerMetaRow}>
                              <Ionicons
                                name="calendar-outline"
                                size={12}
                                color={colors.muted}
                              />
                              <Text style={styles.followerDate}>
                                Followed on {followedDate}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.followerPill}>
                            <Text style={styles.followerPillText}>Active</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {activeTab === "support" && (
              <View style={[styles.tabContent, styles.supportPageContent]}>
                <LinearGradient
                  colors={["#0F172A", "#1E293B", "#0F172A"]}
                  style={styles.supportHero}
                >
                  <Text style={styles.supportHeroTitle}>Support Center</Text>
                  <Text style={styles.supportHeroSubtitle}>
                    Get help with payouts, account settings, and store operations.
                  </Text>
                  <View style={styles.supportHeroMetaRow}>
                    <View style={styles.supportHeroMetaPill}>
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color="rgba(255,255,255,0.9)"
                      />
                      <Text style={styles.supportHeroMetaText}>
                        Avg. response: within 24h
                      </Text>
                    </View>
                    <View style={styles.supportHeroMetaPill}>
                      <Ionicons
                        name="mail-outline"
                        size={13}
                        color="rgba(255,255,255,0.9)"
                      />
                      <Text style={styles.supportHeroMetaText}>
                        expressmart233@gmail.com
                      </Text>
                    </View>
                  </View>
                </LinearGradient>

                <View style={styles.supportQuickActionsRow}>
                  <View style={styles.supportQuickActionCard}>
                    <Ionicons
                      name="headset-outline"
                      size={18}
                      color={theme.primary}
                    />
                    <Text style={styles.supportQuickActionTitle}>Live help</Text>
                    <Text style={styles.supportQuickActionText}>
                      Reach out with account or payout questions.
                    </Text>
                  </View>
                  <View style={styles.supportQuickActionCard}>
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={theme.primary}
                    />
                    <Text style={styles.supportQuickActionTitle}>Ticket</Text>
                    <Text style={styles.supportQuickActionText}>
                      Submit details and track support updates.
                    </Text>
                  </View>
                </View>

                <View style={styles.supportFormCard}>
                  <Text style={styles.supportFormTitle}>Create support request</Text>
                  <Text style={styles.supportHint}>
                    Tell us what you need and we will follow up by email.
                  </Text>

                  <Text style={styles.label}>Subject</Text>
                  <TextInput
                    style={styles.input}
                    value={supportSubject}
                    onChangeText={setSupportSubject}
                    placeholder="What do you need help with?"
                  />

                  <Text style={styles.label}>Priority</Text>
                  <View style={styles.supportPriorityRow}>
                    {[
                      { key: "low", label: "Low" },
                      { key: "medium", label: "Medium" },
                      { key: "high", label: "High" },
                    ].map((p) => (
                      <Pressable
                        key={p.key}
                        style={[
                          styles.supportPriorityChip,
                          supportPriority === p.key && {
                            borderColor: theme.primary,
                            backgroundColor: `${theme.primary}14`,
                          },
                        ]}
                        onPress={() => setSupportPriority(p.key)}
                      >
                        <Text
                          style={[
                            styles.supportPriorityChipText,
                            supportPriority === p.key && {
                              color: theme.primary,
                            },
                          ]}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.label}>Message</Text>
                  <TextInput
                    style={[styles.input, styles.supportMessageInput]}
                    value={supportMessage}
                    onChangeText={setSupportMessage}
                    placeholder="Describe the issue in detail"
                    multiline
                    textAlignVertical="top"
                  />

                  <Pressable
                    onPress={submitSupport}
                    style={[styles.supportSubmitButton, { backgroundColor: theme.primary }]}
                    disabled={supportSubmitting}
                  >
                    {supportSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.supportSubmitButtonText}>
                        Send Request
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Privacy Policy modal */}
        <Modal
          visible={privacyVisible}
          animationType="slide"
          transparent={false}
          statusBarTranslucent
          onRequestClose={() => setPrivacyVisible(false)}
        >
          <ScrollView
            contentContainerStyle={[
              styles.editPageContainer,
              { paddingTop: Math.max(insets.top, 0) + 12 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.editHeroWrap}>
              <LinearGradient
                colors={["#111827", "#1F2937"]}
                style={styles.editHeroGradient}
              >
                <Pressable
                  onPress={() => setPrivacyVisible(false)}
                  style={styles.editHeroCloseButton}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </Pressable>
                <Text style={styles.editHeroTitle}>Terms & Policies</Text>
                <Text style={styles.editHeroSubtitle}>
                  Read our privacy and data handling policy for seller accounts.
                </Text>
              </LinearGradient>
            </View>

            <View style={styles.legalMetaRow}>
              <View style={styles.legalMetaChip}>
                <Ionicons name="calendar-outline" size={14} color={colors.muted} />
                <Text style={styles.legalMetaText}>Updated: March 1, 2026</Text>
              </View>
              <View style={styles.legalMetaChip}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={14}
                  color={colors.muted}
                />
                <Text style={styles.legalMetaText}>ExpressMart Policy</Text>
              </View>
            </View>

            <Text style={styles.legalBodyText}>{PRIVACY_POLICY_TEXT}</Text>

            <View style={styles.legalHelpCard}>
              <Ionicons
                name="mail-unread-outline"
                size={18}
                color={theme.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.legalHelpTitle}>Need clarification?</Text>
                <Text style={styles.legalHelpText}>
                  Contact support at expressmart233@gmail.com for policy
                  questions.
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.saveButton, { marginTop: 12 }]}
              onPress={() => setPrivacyVisible(false)}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>Close</Text>
            </Pressable>
          </ScrollView>
        </Modal>

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
          statusBarTranslucent
          onRequestClose={() => setEditing(false)}
        >
          <KeyboardAvoidingView
            style={styles.editModalRoot}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          >
            <ScrollView
              contentContainerStyle={[
                styles.editPageContainer,
                isWide && styles.editPageContainerWide,
                { paddingTop: Math.max(insets.top, 0) + 12 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.editHeroWrap}>
                <ImageBackground
                  source={editAvatar ? { uri: editAvatar } : undefined}
                  style={styles.editHeroImage}
                  imageStyle={styles.editHeroImageInner}
                >
                  <LinearGradient
                    colors={["rgba(15,23,42,0.65)", "rgba(15,23,42,0.86)"]}
                    style={styles.editHeroGradient}
                  >
                    <Pressable
                      onPress={() => setEditing(false)}
                      style={styles.editHeroCloseButton}
                    >
                      <Ionicons name="close" size={18} color="#fff" />
                    </Pressable>
                    <Text style={styles.editHeroTitle}>Edit Profile</Text>
                    <Text style={styles.editHeroSubtitle}>
                      Update store identity, social links, and brand settings.
                    </Text>
                    <View style={styles.editInfoPill}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={14}
                        color={colors.muted}
                      />
                      <Text style={styles.editInfoPillText}>
                        Changes are visible to customers after saving
                      </Text>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </View>

              <View style={[styles.editGrid, isWide && styles.editGridWide]}>
                <View style={styles.editSectionCard}>
                  <Text style={styles.editSectionCaption}>Business details</Text>
                  <View style={styles.editMediaRow}>
                    <Pressable onPress={pickImage} style={styles.editPhotoButton}>
                      <Ionicons
                        name="image-outline"
                        size={18}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.editPhotoButtonText,
                          { color: theme.primary },
                        ]}
                      >
                        Change Cover Image
                      </Text>
                    </Pressable>
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
                    <Text style={styles.label}>Store Description</Text>
                    <TextInput
                      style={[styles.input, styles.textAreaInput]}
                      value={editStoreDescription}
                      onChangeText={setEditStoreDescription}
                      placeholder="Tell customers what your store is about"
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      maxLength={600}
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
                  </View>
                </View>

                <View style={styles.editSectionColumn}>
                  <View style={styles.editSectionCard}>
                    <Text style={styles.editSectionCaption}>Social links</Text>
                    <View style={styles.editForm}>
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
                    </View>
                  </View>

                  <View style={styles.editSectionCard}>
                    <Text style={styles.editSectionCaption}>Brand settings</Text>
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
                    <View style={styles.toggleGroup}>
                      <Text style={styles.toggleGroupTitle}>Apply theme to</Text>
                      <Pressable
                        onPress={() => setEditApplyToStore(!editApplyToStore)}
                        style={styles.toggleRow}
                      >
                        <Text style={styles.toggleLabel}>Store app</Text>
                        <View
                          style={[
                            styles.toggleTrack,
                            {
                              backgroundColor: editApplyToStore
                                ? theme.primary
                                : "#E5E7EB",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.toggleThumb,
                              editApplyToStore && styles.toggleThumbActive,
                            ]}
                          />
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setEditApplyToCustomer(!editApplyToCustomer)
                        }
                        style={styles.toggleRow}
                      >
                        <Text style={styles.toggleLabel}>Customer app</Text>
                        <View
                          style={[
                            styles.toggleTrack,
                            {
                              backgroundColor: editApplyToCustomer
                                ? theme.primary
                                : "#E5E7EB",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.toggleThumb,
                              editApplyToCustomer && styles.toggleThumbActive,
                            ]}
                          />
                        </View>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.editFooterBar}>
              <View style={styles.editActionsRow}>
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
                    { backgroundColor: theme.primary, minWidth: 108 },
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "800" }}>
                      Save Changes
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  editModalRoot: {
    flex: 1,
    backgroundColor: "#F8FAFD",
  },
  editPageContainer: {
    padding: 16,
    paddingBottom: 180,
    paddingTop: 16,
  },
  editPageContainerWide: {
    paddingHorizontal: 24,
    maxWidth: 1180,
    width: "100%",
    alignSelf: "center",
  },
  editGrid: {
    gap: 14,
  },
  editGridWide: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  editSectionColumn: {
    flex: 1,
    gap: 14,
  },
  editSectionCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  editHeroWrap: {
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  editHeroImage: {
    minHeight: 164,
  },
  editHeroImageInner: {
    resizeMode: "cover",
  },
  editHeroGradient: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 164,
    justifyContent: "flex-end",
  },
  editHeroCloseButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  editHeroTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  editHeroSubtitle: {
    color: "rgba(255,255,255,0.88)",
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
  editMediaRow: {
    alignItems: "flex-start",
  },
  editPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  editPhotoButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  editSectionCaption: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#64748B",
    marginTop: 2,
    marginBottom: 2,
    fontWeight: "800",
  },
  editActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
  },
  editFooterBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "rgba(248,250,253,0.98)",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  editInfoPill: {
    marginTop: 12,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editInfoPillText: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  legalMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  legalMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  legalMetaText: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  legalBodyText: {
    color: colors.muted,
    lineHeight: 20,
    fontSize: 13,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#FCFCFD",
  },
  legalHelpCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#DDE3FF",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  legalHelpTitle: {
    color: colors.dark,
    fontWeight: "800",
    fontSize: 13,
  },
  legalHelpText: {
    color: colors.muted,
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingTop: 50,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#E4E8F0",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 8,
    fontWeight: "600",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabContent: {
    paddingVertical: 8,
  },
  profileTabBar: {
    flexDirection: "row",
    marginTop: 50,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  profileTabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.light,
  },
  profileTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  profileTabBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 7,
    minWidth: 18,
    alignItems: "center",
  },
  profileTabBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
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
  toggleGroup: {
    marginTop: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  toggleGroupTitle: {
    color: colors.dark,
    fontWeight: "700",
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  toggleLabel: {
    color: colors.dark,
    fontWeight: "600",
    fontSize: 13,
  },
  toggleTrack: {
    width: 40,
    height: 22,
    borderRadius: 999,
    padding: 2,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  toggleThumbActive: {
    marginLeft: "auto",
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
    minHeight: 220,
    width: "100%",
  },
  heroBackgroundImage: {
    resizeMode: "cover",
  },
  heroOverlay: {
    padding: 18,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  heroEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.42)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  heroEditButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  heroRight: {
    flex: 1,
  },
  heroTopActions: {
    alignItems: "flex-end",
    marginBottom: 8,
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
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  heroBadgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroBadgeChipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
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
  heroSocialRow: {
    flexDirection: "row",
    marginTop: 10,
    alignItems: "center",
  },
  socialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
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
  visaInactiveDot: {
    backgroundColor: "#F59E0B",
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
  visaNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  visaRevealBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
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
  visaSubValue: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  visaSubValueRight: {
    textAlign: "right",
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
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  visaEditText: {
    fontSize: 13,
    fontWeight: "700",
  },
  secureActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 14,
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
  paymentHintText: {
    color: "#6B7280",
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  paymentErrorText: {
    color: "#B91C1C",
    fontSize: 13,
    marginBottom: 12,
  },
  paymentLoadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 10,
  },
  paymentLoadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  typeList: {
    flexDirection: "column",
    marginTop: 8,
  },
  typeBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8DDE8",
    alignItems: "center",
    justifyContent: "flex-start",
    flexDirection: "row",
  },
  typeBtnFull: {
    width: "100%",
  },
  typeBtnSpacing: {
    marginTop: 10,
  },
  typeText: {
    marginLeft: 12,
    fontWeight: "700",
    color: colors.dark,
  },
  dropdownTrigger: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#D8DDE8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownValue: {
    color: colors.dark,
    fontWeight: "600",
  },
  dropdownPlaceholder: {
    color: colors.muted,
    fontWeight: "500",
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  dropdownSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: "65%",
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.dark,
    marginBottom: 12,
  },
  dropdownList: {
    maxHeight: 420,
  },
  dropdownItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  dropdownItemText: {
    color: colors.dark,
    fontWeight: "600",
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
    ...(Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {}),
  },
  textAreaInput: {
    minHeight: 110,
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
  followersHero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 16,
    marginBottom: 14,
  },
  followersHeroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  followersHeroTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  followersHeroSubtitle: {
    color: "rgba(255,255,255,0.76)",
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  followersHeroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  followersHeroBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  followersSummaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  followersSummaryCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  followersSummaryLabel: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  followersSummaryValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  followersLatestRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  followersLatestText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
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
    paddingVertical: 44,
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
    gap: 10,
    paddingHorizontal: 2,
  },
  followerItemRedesign: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  followerRankBadge: {
    minWidth: 34,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#DDE3FF",
  },
  followerRankText: {
    color: "#4338CA",
    fontSize: 11,
    fontWeight: "800",
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
  followerAvatarInitials: {
    fontSize: 15,
    fontWeight: "800",
  },
  followerName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.dark,
  },
  followerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  followerDate: {
    fontSize: 12,
    color: colors.muted,
  },
  followerPill: {
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  followerPillText: {
    color: "#047857",
    fontSize: 11,
    fontWeight: "800",
  },
  supportHint: {
    color: colors.muted,
    marginBottom: 10,
    lineHeight: 20,
  },
  followersPageContent: {
    paddingHorizontal: 0,
    paddingBottom: 16,
  },
  supportPageContent: {
    paddingHorizontal: 0,
    paddingBottom: 20,
    gap: 12,
  },
  supportHero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 16,
  },
  supportHeroTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  supportHeroSubtitle: {
    color: "rgba(255,255,255,0.78)",
    marginTop: 6,
    lineHeight: 19,
    fontSize: 13,
  },
  supportHeroMetaRow: {
    marginTop: 14,
    gap: 8,
  },
  supportHeroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  supportHeroMetaText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  supportQuickActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  supportQuickActionCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  supportQuickActionTitle: {
    marginTop: 8,
    color: colors.dark,
    fontSize: 14,
    fontWeight: "800",
  },
  supportQuickActionText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  supportFormCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  supportFormTitle: {
    color: colors.dark,
    fontSize: 18,
    fontWeight: "800",
  },
  supportSubmitButton: {
    marginTop: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  supportSubmitButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  supportPriorityRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  supportPriorityChip: {
    borderWidth: 1,
    borderColor: "#D8DDE8",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  supportPriorityChipText: {
    color: colors.dark,
    fontWeight: "700",
    fontSize: 12,
  },
  supportMessageInput: {
    minHeight: 120,
    marginBottom: 12,
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
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemLabel: {
    fontWeight: "700",
    color: colors.dark,
  },
  menuItemRight: {
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
});
