import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, invokeEdgeFunction } from "../../supabase";
import notificationService from "../services/notificationService";

const SellerContext = createContext();

// AsyncStorage keys
const AUTH_USER_KEY = "express_seller_user";
const AUTH_ROLE_KEY = "express_seller_role";

// Local fallback categories in case the DB returns empty
const DEFAULT_CATEGORIES = [
  {
    id: "default-fashion",
    name: "Fashion",
    icon: "shirt-outline",
    color: "#F3F6FF",
  },
  {
    id: "default-grocery",
    name: "Grocery",
    icon: "basket-outline",
    color: "#FFF4E5",
  },
  {
    id: "default-beauty",
    name: "Beauty",
    icon: "sparkles-outline",
    color: "#FDF0FF",
  },
  {
    id: "default-electronics",
    name: "Electronics",
    icon: "hardware-chip-outline",
    color: "#E8F4FF",
  },
  { id: "default-home", name: "Home", icon: "home-outline", color: "#EAF7F0" },
];

export const SellerProvider = ({ children }) => {
  // Seed with defaults so UI always has something to show
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [profile, setProfile] = useState(null);
  const [sellerId, setSellerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsSubaccount, setNeedsSubaccount] = useState(false);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState({});
  const appStateRef = useRef(AppState.currentState);
  const presenceChannelRef = useRef(null);

  const updateLastSeen = useCallback(async (currentSellerId) => {
    if (!supabase || !currentSellerId) return;

    try {
      await supabase
        .from("express_sellers")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", currentSellerId);
    } catch (error) {
      console.warn("Seller last-seen update failed:", error);
    }
  }, []);

  const stopPresence = useCallback(
    async (currentSellerId, recordLastSeen = true) => {
      if (recordLastSeen) {
        await updateLastSeen(currentSellerId);
      }

      if (!presenceChannelRef.current) return;

      try {
        await presenceChannelRef.current.untrack();
      } catch (error) {
        console.warn("Seller presence untrack failed:", error);
      }

      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    },
    [updateLastSeen],
  );

  const startPresence = useCallback(
    async (currentSellerId) => {
      if (!supabase || !currentSellerId) return;

      const currentTopic = `presence:seller:${currentSellerId}`;
      if (presenceChannelRef.current?.topic === currentTopic) return;

      await stopPresence(currentSellerId, false);

      const channel = supabase.channel(currentTopic, {
        config: { presence: { key: String(currentSellerId) } },
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await channel.track({
              actor_id: currentSellerId,
              actor_type: "seller",
              app_state: "active",
              online_at: new Date().toISOString(),
            });
          } catch (error) {
            console.error("Seller presence track failed:", error);
          }
        }
      });

      presenceChannelRef.current = channel;
    },
    [stopPresence],
  );

  // Get seller ID from user profile
  const getSellerId = useCallback(async () => {
    if (!supabase) return null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // Helper to either fetch or create seller row for this user
      const ensureSellerRecord = async () => {
        // Try fetch first
        const { data: existing } = await supabase
          .from("express_sellers")
          .select("id, name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) return existing;

        const baseName =
          user.user_metadata?.name || user.email?.split("@")[0] || "Seller";
        let candidateName = baseName;
        let attempt = 0;
        while (attempt < 3) {
          const { data: created, error: insertErr } = await supabase
            .from("express_sellers")
            .insert({
              user_id: user.id,
              name: candidateName,
              email: user.email,
              phone: user.user_metadata?.phone || null,
            })
            .select("id, name")
            .single();

          if (!insertErr) {
            // Fire-and-forget: request creation of a Paystack subaccount via edge function.
            (async () => {
              try {
                if (created && created.id) {
                  // Try to include bank details from `store_payments` if the seller has them
                  try {
                    const { data: bank, error: bankErr } = await supabase
                      .from("store_payments")
                      .select("*")
                      .eq("seller_id", created.id)
                      .eq("type", "bank")
                      .maybeSingle();

                    const payload = {
                      seller_id: created.id,
                      name: created.name,
                      email: user.email,
                    };
                    if (bank && !bankErr) {
                      payload.settlement_bank = bank.bank_name || null;
                      payload.account_number = bank.account_number || null;
                    }
                    // include phone if available
                    if (user.user_metadata?.phone)
                      payload.primary_contact_phone = user.user_metadata.phone;

                    await invokeEdgeFunction("create_subaccount", payload);
                  } catch (innerErr) {
                    console.warn(
                      "Failed to fetch store_payments for subaccount creation:",
                      innerErr,
                    );
                    // fallback to minimal payload
                    await invokeEdgeFunction("create_subaccount", {
                      seller_id: created.id,
                      name: created.name,
                      email: user.email,
                    });
                  }
                }
              } catch (err) {
                console.warn(
                  "Failed to create Paystack subaccount:",
                  err?.message || err,
                );
              }
            })();

            return created;
          }

          // Handle unique name collisions by appending suffix
          if (insertErr.code === "23505") {
            attempt += 1;
            candidateName = `${baseName}-${user.id.slice(0, 6 + attempt)}`;
            continue;
          }

          console.error("Error creating seller row:", insertErr);
          return null;
        }
        return null;
      };

      const seller = await ensureSellerRecord();
      return seller;
    } catch (error) {
      console.error("Error getting seller:", error);
      return null;
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await stopPresence(sellerId);
      await supabase.auth.signOut();
      await AsyncStorage.removeItem(AUTH_USER_KEY);
      await AsyncStorage.removeItem(AUTH_ROLE_KEY);
      setSellerId(null);
      setProfile(null);
      setProducts([]);
      setOrders([]);
      setConversations([]);
      setReviews([]);
      setPayments([]);
      setCategories(DEFAULT_CATEGORIES);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, [sellerId, stopPresence]);

  // Fetch chats with user relationship
  const fetchChats = useCallback(async (sellerIdParam) => {
    if (!supabase || !sellerIdParam) return;

    try {
      const { data, error } = await supabase
        .from("express_chat_conversations")
        .select(
          `
          id,
          seller_id,
          user_id,
          last_message,
          last_message_at,
          created_at,
          updated_at,
          express_profiles!express_chat_conversations_user_id_fkey(id, full_name, email, avatar_url)
        `,
        )
        .eq("seller_id", sellerIdParam)
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("❌ Chats fetch error:", error);
        return;
      }

      // Map the data to have a 'user' property for consistency
      const conversationsData = (data || []).map((conv) => ({
        ...conv,
        user: conv.express_profiles,
      }));

      setConversations(conversationsData);
    } catch (error) {
      console.error("Error fetching chats:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    console.log("fetchAll called, supabase:", !!supabase);
    if (!supabase) return;
    setLoading(true);
    setError("");

    try {
      const seller = await getSellerId();
      if (!seller) {
        setCategories((prev) => (prev.length ? prev : DEFAULT_CATEGORIES));
        setLoading(false);
        return;
      }

      setSellerId(seller.id);

      const [categoriesRes, productsRes, ordersRes, profileRes] =
        await Promise.all([
          supabase.from("express_categories").select("id,name,icon,color"),
          supabase
            .from("express_products")
            .select(
              `
              *,
              flash_sale:express_flash_sales(
                id,
                flash_price,
                original_price,
                discount_percentage,
                start_time,
                end_time,
                max_quantity,
                is_active
              )
            `,
            )
            .eq("seller_id", seller.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("express_orders")
            .select(
              "id,order_number,user_id,status,total,service_fee,shipping_fee,service_fee_pct,customer,shipping_address,eta,payment_status,created_at,items:express_order_items(id,title,quantity,price,thumbnail,shipping_fee)",
            )
            .eq("seller_id", seller.id)
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("express_sellers")
            .select("*")
            .eq("id", seller.id)
            .single(),
        ]);

      // Fetch global settings (service_fee_percentage, etc.)
      let settingsMap = {};
      try {
        const { data: settingsData, error: settingsErr } = await supabase
          .from("express_settings")
          .select("key, value");
        if (!settingsErr && settingsData) {
          settingsData.forEach((s) => {
            settingsMap[s.key] = s.value;
          });
        }
      } catch (settingsErr) {
        console.warn("Failed to fetch settings:", settingsErr);
      }
      setSettings(settingsMap);

      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (profileRes.error) throw profileRes.error;

      // Fetch payment records for this seller's orders to track Paystack fee deductions
      const orderIds = (ordersRes.data || []).map((o) => o.id).filter(Boolean);
      let paymentsData = [];
      if (orderIds.length > 0) {
        try {
          const { data: pData, error: pErr } = await supabase
            .from("express_payments")
            .select(
              "id,order_id,amount,paystack_fee_pesewas,paystack_fee_split,service_fee_amount,platform_commission,seller_amount,platform_amount,status,created_at",
            )
            .in("order_id", orderIds)
            .eq("status", "success")
            .order("created_at", { ascending: false });
          if (!pErr) {
            paymentsData = pData || [];
          } else {
            console.warn("Payment records fetch error (non-fatal):", pErr);
          }
        } catch (pCatchErr) {
          console.warn("Failed to fetch seller payment records:", pCatchErr);
        }
      }

      // Fetch reviews for items that belong to this seller
      const productIds = productsRes.data?.map((p) => p.id) || [];
      let reviewsData = [];
      if (productIds.length > 0) {
        try {
          const { data: revs, error: revsError } = await supabase
            .from("express_reviews")
            .select("*, express_profiles(full_name, avatar_url)")
            .in("product_id", productIds)
            .order("created_at", { ascending: false });

          if (revsError) {
            console.error("Reviews fetch error:", revsError);
            // Fallback: try fetching without the join if join fails
            if (
              revsError.code === "PGRST200" ||
              revsError.message.includes("relationship")
            ) {
              const { data: fallbackRevs } = await supabase
                .from("express_reviews")
                .select("*")
                .in("product_id", productIds)
                .order("created_at", { ascending: false });
              reviewsData = fallbackRevs || [];
            }
          } else {
            reviewsData = revs || [];
          }
        } catch (revCatchError) {
          console.error("Critical reviews fetch error:", revCatchError);
        }
      }

      // Fetch chats separately with proper user mapping
      await fetchChats(seller.id);

      setCategories(categoriesRes.data || DEFAULT_CATEGORIES);
      setProducts(productsRes.data || []);
      setOrders(ordersRes.data || []);
      setReviews(reviewsData);
      setPayments(paymentsData);

      // Compute aggregated rating from reviews if available and attach to profile
      let profileObj = profileRes.data || {};
      try {
        if (reviewsData && reviewsData.length > 0) {
          const numericRatings = reviewsData
            .map((r) => Number(r.rating || r.stars || 0))
            .filter((n) => !Number.isNaN(n));
          if (numericRatings.length > 0) {
            const avg =
              numericRatings.reduce((s, v) => s + v, 0) / numericRatings.length;
            profileObj = { ...profileObj, rating: Math.round(avg * 10) / 10 };
          } else if (profileObj.rating == null) {
            profileObj = { ...profileObj, rating: null };
          }
        } else if (profileObj.rating == null) {
          profileObj = { ...profileObj, rating: null };
        }
      } catch (err) {
        console.error("Error computing aggregated rating:", err);
      }

      setProfile(profileObj);

      // Detect missing Paystack subaccount
      try {
        const hasPaystack =
          profileObj?.payment_platform === "paystack" &&
          profileObj?.payment_account;
        setNeedsSubaccount(!hasPaystack);
      } catch (err) {
        setNeedsSubaccount(false);
      }
      setLoading(false);
    } catch (error) {
      console.error("❌ fetchAll error:", error);
      setLoading(false);
    }
  }, [getSellerId, fetchChats]);

  const createPaystackSubaccount = useCallback(
    async (opts = {}) => {
      if (!supabase) throw new Error("Supabase not configured");
      // Ensure we have seller id
      const ensured = sellerId || (await getSellerId())?.id;
      if (!ensured) throw new Error("Seller not found");

      try {
        // If caller didn't provide bank details, try to load primary bank from `store_payments`.
        let settlement_bank = opts.settlement_bank;
        let account_number = opts.account_number;
        if (!settlement_bank || !account_number) {
          try {
            const { data: bank, error: bankErr } = await supabase
              .from("store_payments")
              .select("*")
              .eq("seller_id", ensured)
              .eq("type", "bank")
              .maybeSingle();
            if (!bankErr && bank) {
              settlement_bank = settlement_bank || bank.bank_name || null;
              account_number = account_number || bank.account_number || null;
            }
          } catch (bankFetchErr) {
            console.warn(
              "Failed to fetch bank details from store_payments:",
              bankFetchErr,
            );
          }
        }

        const resp = await invokeEdgeFunction("create_subaccount", {
          seller_id: ensured,
          name: profile?.name || opts.name || null,
          email: profile?.email || opts.email || null,
          settlement_bank,
          account_number,
          primary_contact_phone: opts.primary_contact_phone,
        });

        // Refresh seller profile after creation
        const { data: refreshed, error: refErr } = await supabase
          .from("express_sellers")
          .select("*")
          .eq("id", ensured)
          .single();
        if (!refErr && refreshed) {
          setProfile(refreshed);
          const hasPaystack =
            refreshed?.payment_platform === "paystack" &&
            refreshed?.payment_account;
          setNeedsSubaccount(!hasPaystack);
        }
        return resp;
      } catch (err) {
        console.error("createPaystackSubaccount error:", err);
        throw err;
      }
    },
    [sellerId, profile, getSellerId],
  );

  // Setup realtime subscriptions
  useEffect(() => {
    if (!supabase || !sellerId) return;

    // Subscribe to order changes
    const ordersChannel = supabase
      .channel("seller-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "express_orders",
          filter: `seller_id=eq.${sellerId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // Fetch full order with items
            supabase
              .from("express_orders")
              .select("*,items:express_order_items(*)")
              .eq("id", payload.new.id)
              .single()
              .then(({ data }) => {
                if (data) setOrders((prev) => [data, ...prev]);
              });
          } else if (payload.eventType === "UPDATE") {
            setOrders((prev) =>
              prev.map((order) =>
                order.id === payload.new.id
                  ? { ...order, ...payload.new }
                  : order,
              ),
            );
          }
        },
      )
      .subscribe();

    // Subscribe to product changes
    const productsChannel = supabase
      .channel("seller-products")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "express_products",
          filter: `seller_id=eq.${sellerId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setProducts((prev) =>
              prev.map((product) =>
                product.id === payload.new.id
                  ? { ...product, ...payload.new }
                  : product,
              ),
            );
            // Notify on status change
            if (payload.old.status !== payload.new.status) {
              // Status change is handled by state updates above.
            }
          }
        },
      )
      .subscribe();

    // Subscribe to flash sale changes
    const flashSalesChannel = supabase
      .channel("seller-flash-sales")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "express_flash_sales",
          filter: `seller_id=eq.${sellerId}`,
        },
        async (payload) => {
          // Refresh products to get updated flash sale data
          try {
            const { data: updatedProducts } = await supabase
              .from("express_products")
              .select(
                `
                *,
                flash_sale:express_flash_sales(
                  id,
                  flash_price,
                  original_price,
                  discount_percentage,
                  start_time,
                  end_time,
                  max_quantity,
                  is_active
                )
              `,
              )
              .eq("seller_id", sellerId)
              .order("created_at", { ascending: false });

            setProducts(updatedProducts || []);
          } catch (error) {
            console.error(
              "Error refreshing products after flash sale change:",
              error,
            );
          }
        },
      )
      .subscribe();

    // Subscribe to chat changes
    const chatsChannel = supabase
      .channel("seller-chats")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "express_chat_conversations",
          filter: `seller_id=eq.${sellerId}`,
        },
        (payload) => {
          // Re-fetch all chats to ensure user relationship data is preserved
          fetchChats(sellerId);
        },
      )
      .subscribe();

    return () => {
      ordersChannel.unsubscribe();
      productsChannel.unsubscribe();
      flashSalesChannel.unsubscribe();
      chatsChannel.unsubscribe();
    };
  }, [sellerId, fetchChats]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!supabase) return;

    const syncPresence = async (nextAppState = appStateRef.current) => {
      if (sellerId && nextAppState === "active") {
        await startPresence(sellerId);
        return;
      }

      await stopPresence(sellerId);
    };

    syncPresence();

    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        appStateRef.current = nextAppState;
        await syncPresence(nextAppState);
      },
    );

    return () => {
      subscription.remove();
      stopPresence(sellerId);
    };
  }, [sellerId, startPresence, stopPresence]);

  const metrics = useMemo(() => {
    const pendingProducts = products.filter(
      (p) => p.status === "pending",
    ).length;
    const activeProducts = products.filter((p) => p.status === "active").length;
    const draftProducts = products.filter((p) => p.status === "draft").length;
    const revenue = orders
      .filter((o) => o.payment_status === "success")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    const inProgressOrders = orders.filter((o) =>
      ["processing", "packed"].includes(o.status),
    ).length;
    const totalSold = products.reduce((sum, p) => sum + (p.sold_count || 0), 0);
    const unreadChats = conversations.filter((c) => c.unread_count > 0).length;

    // Payment fee metrics — Paystack deductions and net earnings
    // Service fee percentage from admin settings — only used for display, NOT for calculating
    // historic commission amounts (rate may change over time, stored per-order values are canonical)
    const serviceFeePercentage = parseFloat(
      settings.service_fee_percentage || "0",
    );

    const successfulOrders = orders.filter(
      (o) => o.payment_status === "success",
    );

    // totalPaystackFees: sum of Paystack processing fees in GHS (stored in pesewas)
    const totalPaystackFeesFromPayments =
      payments.reduce(
        (sum, p) => sum + (Number(p.paystack_fee_pesewas) || 0),
        0,
      ) / 100;
    // commissionPaid: total service fee deducted by ExpressMart platform
    const commissionPaidFromPayments = payments.reduce(
      (sum, p) => sum + Number(p.platform_commission || 0),
      0,
    );
    // netRevenue: total earnings after service fee deduction
    // Falls back to order-level stored values when payments table is empty
    const netRevenueFromPayments = payments.reduce(
      (sum, p) => sum + Number(p.seller_amount || 0),
      0,
    );

    // Order-level fallbacks: use the service_fee stored on each order at the time it was placed.
    // This ensures historic figures stay correct even if the admin changes the service fee rate.
    const commissionPaidFromOrders = successfulOrders.reduce(
      (sum, o) => sum + Number(o.service_fee || 0),
      0,
    );
    const netRevenueFromOrders = successfulOrders.reduce(
      (sum, o) => sum + (Number(o.total || 0) - Number(o.service_fee || 0)),
      0,
    );

    // Prefer real payment records; fall back to per-order stored service_fee; last resort: raw revenue
    const commissionPaid =
      commissionPaidFromPayments > 0
        ? commissionPaidFromPayments
        : commissionPaidFromOrders;

    // Paystack Ghana fee estimate: 1.5% + GHS 0.50 per successful order, capped at GHS 2000
    const totalPaystackFees =
      totalPaystackFeesFromPayments > 0
        ? totalPaystackFeesFromPayments
        : revenue > 0
          ? successfulOrders.reduce((sum, o) => {
              const amt = Number(o.total || 0);
              return sum + Math.min(amt * 0.015 + 0.5, 2000);
            }, 0)
          : 0;

    const netRevenue =
      netRevenueFromPayments > 0
        ? netRevenueFromPayments
        : netRevenueFromOrders > 0
          ? netRevenueFromOrders
          : revenue;

    // True when fee values are estimated (no real payment records and no per-order service_fee stored)
    const feesAreEstimated =
      commissionPaidFromPayments === 0 &&
      totalPaystackFeesFromPayments === 0 &&
      commissionPaidFromOrders === 0;

    return {
      pendingProducts,
      activeProducts,
      draftProducts,
      revenue,
      inProgressOrders,
      totalSold,
      unreadChats,
      // Payment fee metrics
      totalPaystackFees,
      commissionPaid,
      netRevenue,
      serviceFeePercentage,
      feesAreEstimated,
    };
  }, [products, orders, conversations, payments, settings]);

  const createProduct = useCallback(
    async ({
      title,
      price,
      shipping_fee,
      category,
      thumbnails,
      badges,
      description,
      discount,
      sizes,
      colors,
      quantity,
      sku,
      weight,
      weight_unit,
      barcode,
      vendor,
      slug,
      compare_at_price,
      cost_price,
      tags,
      track_inventory,
      allow_backorder,
      specifications,
    }) => {
      if (!supabase) {
        throw new Error("Not authenticated as seller");
      }

      // Re-fetch seller id in case local state is stale
      const ensuredSellerId = sellerId || (await getSellerId())?.id;
      if (!ensuredSellerId) {
        throw new Error(
          "Seller profile missing. Please re-login or contact support.",
        );
      }

      if (!sellerId) setSellerId(ensuredSellerId);

      const numericPrice = Number(price);
      if (Number.isNaN(numericPrice)) {
        throw new Error("Price must be numeric");
      }

      const categoryObj = categories.find((c) => c.name === category);

      const payload = {
        seller_id: ensuredSellerId,
        vendor: vendor || profile?.name || "Seller",
        title,
        price: numericPrice,
        shipping_fee: Number(shipping_fee) || 0,
        category,
        category_id: categoryObj?.id || null,
        thumbnail: thumbnails?.[0] || null,
        thumbnails: thumbnails?.length ? thumbnails : null,
        status: "pending",
        badges: badges?.length ? badges : null,
        description: description || null,
        discount: discount || 0,
        sizes: sizes?.length ? sizes : null,
        colors: colors?.length ? colors : null,
        quantity: quantity || 0,
        sku: sku || null,
        weight: weight || null,
        weight_unit: weight_unit || "kg",
        barcode: barcode || null,
        slug: slug || null,
        compare_at_price: compare_at_price || null,
        cost_price: cost_price || null,
        tags: tags?.length ? tags : null,
        track_inventory: track_inventory !== false,
        allow_backorder: allow_backorder === true,
        specifications: specifications || null,
      };

      const { data, error: insertError } = await supabase
        .from("express_products")
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      setProducts((prev) => [data, ...prev]);
      return data;
    },
    [sellerId, profile, getSellerId, categories],
  );

  const updateProductStatus = useCallback(async (productId, status) => {
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from("express_products")
      .update({ status })
      .eq("id", productId);
    if (updateError) {
      throw new Error(updateError.message);
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, status } : p)),
    );
  }, []);

  const updateProduct = useCallback(async (productId, updates) => {
    if (!supabase) return;
    const { data, error: updateError } = await supabase
      .from("express_products")
      .update(updates)
      .eq("id", productId)
      .select()
      .single();
    if (updateError) {
      throw new Error(updateError.message);
    }
    setProducts((prev) => prev.map((p) => (p.id === productId ? data : p)));
    return data;
  }, []);

  const deleteProduct = useCallback(async (productId) => {
    if (!supabase) return;
    const { error: deleteError } = await supabase
      .from("express_products")
      .delete()
      .eq("id", productId);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const advanceOrderStatus = useCallback(
    async (orderId, status) => {
      if (!supabase) return;

      // keep a reference to the order so we can notify the customer after the update
      const existingOrder = orders.find((o) => o.id === orderId);

      const updates = { status, updated_at: new Date().toISOString() };
      if (status === "shipped") {
        updates.shipped_at = new Date().toISOString();
      } else if (status === "delivered") {
        updates.delivered_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("express_orders")
        .update(updates)
        .eq("id", orderId);
      if (updateError) {
        throw new Error(updateError.message);
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)),
      );

      // fire off notification to customer if we have the necessary info
      try {
        let customerId = existingOrder?.user_id;
        let orderNumber = existingOrder?.order_number;

        if (!customerId) {
          // fetch minimal order record to grab user_id and order_number
          const { data: freshOrder, error: fetchErr } = await supabase
            .from("express_orders")
            .select("user_id,order_number")
            .eq("id", orderId)
            .single();
          if (fetchErr) {
            console.error("Failed to fetch order for notification:", fetchErr);
          } else if (freshOrder) {
            customerId = freshOrder.user_id;
            orderNumber = freshOrder.order_number;
          }
        }

        if (customerId) {
          await notificationService.notifyCustomerOrderUpdate(
            customerId,
            orderId,
            status,
            orderNumber,
          );
        }
      } catch (err) {
        console.error("Failed to send order status notification:", err);
      }
    },
    [orders],
  );

  const createSupportTicket = useCallback(
    async ({ subject, message, priority }) => {
      if (!supabase || !sellerId) return;
      const body = {
        seller_id: sellerId,
        vendor: profile?.name,
        subject,
        priority: priority || "medium",
        messages: [
          {
            at: new Date().toISOString(),
            author: profile?.name || "Seller",
            body: message,
          },
        ],
      };
      const { error: ticketError } = await supabase
        .from("express_support_tickets")
        .insert(body);
      if (ticketError) {
        throw new Error(ticketError.message);
      }
    },
    [sellerId, profile],
  );

  const replyToReview = useCallback(
    async (reviewId, comment) => {
      if (!supabase || !sellerId) return;
      const { data, error } = await supabase
        .from("express_review_comments")
        .insert({
          review_id: reviewId,
          seller_id: sellerId,
          comment,
          is_approved: true, // Seller replies are auto-approved for now
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    [sellerId],
  );

  const updateProfile = useCallback(
    async (updates) => {
      if (!supabase || !sellerId) return;
      // Try updating profile. If DB doesn't have `theme_color` column (42703),
      // retry without that field so the app remains compatible with older schemas.
      try {
        const { data, error: updateError } = await supabase
          .from("express_sellers")
          .update(updates)
          .eq("id", sellerId)
          .select()
          .single();
        if (updateError) throw updateError;
        setProfile(data);
        return data;
      } catch (err) {
        // If error is missing column (42703) and we attempted to update theme-related fields,
        // remove them and retry once so older DB schemas remain compatible.
        if (err && err.code === "42703" && updates) {
          const filtered = { ...updates };
          // Remove theme fields that may not exist in older schemas
          delete filtered.theme_color;
          Object.keys(filtered).forEach((k) => {
            if (k.startsWith("theme_apply") || k.startsWith("apply_theme")) {
              delete filtered[k];
            }
          });
          const { data, error: retryErr } = await supabase
            .from("express_sellers")
            .update(filtered)
            .eq("id", sellerId)
            .select()
            .single();
          if (retryErr) throw retryErr;
          setProfile(data);
          return data;
        }
        throw new Error(err.message || String(err));
      }
    },
    [sellerId],
  );

  const value = {
    categories,
    products,
    orders,
    conversations,
    chats: conversations,
    profile,
    seller: profile,
    sellerId,
    vendorName: profile?.name || "Seller",
    loading,
    error,
    metrics,
    settings,
    refresh: fetchAll,
    refreshChats: () => fetchChats(sellerId),
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductStatus,
    advanceOrderStatus,
    createSupportTicket,
    updateProfile,
    replyToReview,
    reviews,
    logout,
    needsSubaccount,
    createPaystackSubaccount,
    payments,
  };

  return (
    <SellerContext.Provider value={value}>{children}</SellerContext.Provider>
  );
};

export const useSeller = () => {
  const context = useContext(SellerContext);
  if (!context) {
    throw new Error("useSeller must be used inside SellerProvider");
  }
  return context;
};
