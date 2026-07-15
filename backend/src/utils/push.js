const { Expo } = require('expo-server-sdk');
const db = require('../config/db');

// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
const expo = new Expo();

/**
 * Send a push notification to a specific user
 * @param {number} userId - The u_id of the user
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    // 1. Fetch user's push token from DB
    const { rows } = await db.query('SELECT push_token FROM users WHERE u_id = $1', [userId]);
    if (rows.length === 0 || !rows[0].push_token) {
      console.log(`No push token found for user ${userId}`);
      return false;
    }

    const pushToken = rows[0].push_token;

    // 2. Check that all your push tokens appear to be valid Expo push tokens
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      return false;
    }

    // 3. Construct the message
    const messages = [{
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'default',
      // categoryId links this notification to a set of action buttons registered on the device
      ...(data.categoryId ? { categoryId: data.categoryId } : {}),
    }];

    // 4. Send the notification
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }
    
    return true;
  } catch (err) {
    console.error('Push notification error:', err);
    return false;
  }
};

module.exports = {
  sendPushNotification
};
