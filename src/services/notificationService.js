// Notification Service Helper for Express-Seller
// Provides helper functions for sellers to send notifications

import { supabase } from '../../supabase';

/**
 * Send notification to customer about order status
 */
export const notifyCustomerOrderUpdate = async (customerId, orderId, status, orderNumber) => {
    // normalize spelling differences (some parts of code use "canceled")
    const normalizedStatus = status === 'canceled' ? 'cancelled' : status;

    const statusMessages = {
        confirmed: { title: 'Order Confirmed! 🎉', body: `Your order #${orderNumber} has been confirmed by the seller.` },
        processing: { title: 'Order Processing', body: `Your order #${orderNumber} is being prepared.` },
        packed: { title: 'Order Packed 🧩', body: `Your order #${orderNumber} has been packed and is ready to ship.` },
        ready: { title: 'Order Ready! 📦', body: `Your order #${orderNumber} is ready for pickup/delivery.` },
        shipped: { title: 'Order Shipped! 🚚', body: `Your order #${orderNumber} is on its way!` },
        delivered: { title: 'Order Delivered! ✅', body: `Your order #${orderNumber} has been delivered. Enjoy!` },
        cancelled: { title: 'Order Cancelled', body: `Your order #${orderNumber} has been cancelled.` },
    };

    const message = statusMessages[normalizedStatus] || {
        title: 'Order Update',
        body: `Your order #${orderNumber} status: ${status}`
    };

    try {
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
            body: {
                userId: customerId,
                appType: 'customer',
                title: message.title,
                body: message.body,
                data: {
                    orderId,
                    status,
                    orderNumber,
                    screen: 'OrderDetail',
                },
                notificationType: 'order',
                android: {
                    channelId: 'orders',
                    priority: 'high',
                },
            },
        });

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Failed to notify customer:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Send notification to customer about chat message
 */
export const notifyCustomerNewMessage = async (customerId, sellerName, messagePreview, chatId) => {
    try {
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
            body: {
                userId: customerId,
                appType: 'customer',
                title: `Message from ${sellerName}`,
                body: messagePreview.substring(0, 100) + (messagePreview.length > 100 ? '...' : ''),
                data: {
                    chatId,
                    screen: 'Chat',
                },
                notificationType: 'chat',
                android: {
                    channelId: 'chat',
                    priority: 'high',
                },
            },
        });

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Failed to notify customer about message:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Send notification to customer about product availability
 */
export const notifyCustomerProductAvailable = async (customerId, productName, productId) => {
    try {
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
            body: {
                userId: customerId,
                appType: 'customer',
                title: 'Back in Stock! 🎉',
                body: `${productName} is now available. Get it before it's gone!`,
                data: {
                    productId,
                    screen: 'ProductDetail',
                },
                notificationType: 'general',
                android: {
                    channelId: 'default',
                    priority: 'normal',
                },
            },
        });

        if (error) throw error;
        return { success: true, data };
    } catch (err) {
        console.error('Failed to notify customer about product:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Send promotion notification to seller's customers
 */
export const notifyCustomersAboutPromotion = async (customerIds, title, body, promoData = {}) => {
    if (!customerIds || customerIds.length === 0) {
        return { success: true, data: null, recipientCount: 0 };
    }

    try {
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
            body: {
                userIds: customerIds,
                appType: 'customer',
                title,
                body,
                data: {
                    ...promoData,
                    screen: 'Promotion',
                },
                notificationType: 'promotion',
                android: {
                    channelId: 'promotions',
                    priority: 'normal',
                },
            },
        });

        if (error) throw error;
        return { success: true, data, recipientCount: customerIds.length };
    } catch (err) {
        console.error('Failed to send promotion:', err);
        return { success: false, error: err.message };
    }
};

export default {
    notifyCustomerOrderUpdate,
    notifyCustomerNewMessage,
    notifyCustomerProductAvailable,
    notifyCustomersAboutPromotion,
};
