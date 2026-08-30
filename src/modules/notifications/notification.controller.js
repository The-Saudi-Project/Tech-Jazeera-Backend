/**
 * Notification controller — HTTP translation only.
 */
import ApiResponse from '../../utils/ApiResponse.js';
import * as notificationService from './notification.service.js';

export async function list(req, res) {
  const data = await notificationService.listNotifications(req.user.id, req.query);
  res.json(new ApiResponse('Notifications.', data));
}

export async function markRead(req, res) {
  const notification = await notificationService.markNotificationRead(req.user.id, req.params.id);
  res.json(new ApiResponse('Notification marked read.', notification));
}

export async function markAllRead(req, res) {
  const result = await notificationService.markAllNotificationsRead(req.user.id);
  res.json(new ApiResponse('Notifications marked read.', result));
}

export async function vapidPublicKey(req, res) {
  res.json(new ApiResponse('VAPID public key.', notificationService.getVapidPublicKey()));
}

export async function subscribe(req, res) {
  await notificationService.subscribeToPush(req.user.id, req.body);
  res.status(201).json(new ApiResponse('Subscribed to push notifications.'));
}

export async function unsubscribe(req, res) {
  await notificationService.unsubscribeFromPush(req.user.id, req.body.endpoint);
  res.json(new ApiResponse('Unsubscribed from push notifications.'));
}
