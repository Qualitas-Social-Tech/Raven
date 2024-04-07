import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching"
import { clientsClaim } from "workbox-core"

import { initializeApp } from "firebase/app"
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw"
import localforage from 'localforage'

// Use the precache manifest generated by Vite
precacheAndRoute(self.__WB_MANIFEST)

// Clean up old caches
cleanupOutdatedCaches()

const jsonConfig = new URL(location).searchParams.get("config")
// Firebase config initialization
try {
    const firebaseApp = initializeApp(JSON.parse(jsonConfig))
    const messaging = getMessaging(firebaseApp)

    function isChrome() {
        return navigator.userAgent.toLowerCase().includes("chrome")
    }

    onBackgroundMessage(messaging, async (payload) => {

        const currentUser = await localforage.getItem('currentUser')

        const isCurrentUser = currentUser === payload.data.from_user

        const notificationTitle = payload.data.title
        let notificationOptions = {
            body: payload.data.body || "",
        }
        if (payload.data.notification_icon) {
            notificationOptions["icon"] = payload.data.notification_icon
        }

        if (payload.data.raven_message_type === "Image") {
            notificationOptions["image"] = payload.data.content
        }

        if (payload.data.creation) {
            notificationOptions["timestamp"] = payload.data.creation
        }

        if (payload.data.channel_id) {
            notificationOptions["tag"] = payload.data.channel_id
        }
        const url = `${payload.data.base_url}/raven_mobile/channel/${payload.data.channel_id}`
        if (isChrome()) {
            notificationOptions["data"] = {
                url: url,
            }
        } else {
            notificationOptions["actions"] = [
                {
                    action: url,
                    title: "View",
                },
            ]
        }

        if (isCurrentUser) {
            notificationOptions["silent"] = true
        }

        // On Safari, we have to show a push notification - else they will revoke the permission after 3 ignored notifications
        // Show the notification, and then close all notifications of the current channel

        self.registration.showNotification(notificationTitle, notificationOptions)
            .then(() => {
                // If current user, get the notification and close it.
                if (isCurrentUser && payload.data.channel_id) {
                    // get all notifications of the current channel and close it
                    self.registration.getNotifications({ tag: payload.data.channel_id }).then(notifications => {
                        notifications.forEach(notification => {
                            notification.close()
                        })
                    })
                }
            })
    })

    if (isChrome()) {
        self.addEventListener("notificationclick", (event) => {
            event.stopImmediatePropagation()
            if (event.notification.data && event.notification.data.url) {
                clients.openWindow(event.notification.data.url)
            }
            event.notification.close()
        })
    }
} catch (error) {
    console.log("Failed to initialize Firebase", error)
}

self.skipWaiting()
clientsClaim()
console.log("Service Worker Initialized")