/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");
// const functions = require("firebase-functions/v2");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const {getFirestore} = require("firebase-admin/firestore");
const {logger} = require("firebase-functions");

const {fetchRankings, fetchPlayers} = require("./api/golfApi");
const {processRounds} = require("./classification/rounds");
const {getActiveTournament} = require("./utils/utils");
const {getNextTournament} = require("./utils/utils");
const {createPlayers} = require("./utils/utils");
const {getApuestasUsers} = require("./utils/utils");
const { Expo } = require("expo-server-sdk");
// const {initializeApp} = require("firebase-admin/app");

const db = getFirestore();
const expo = new Expo();

exports.processTournamentEndings = onSchedule("08 0-4 * * 1", async (event) => {
  try {
    await processRounds();
  } catch (error) {
    logger.error("Error inside process tournament endings...: ", error);
  }
});

exports.processTournamentRounds = onSchedule(
    "*/30 * * * 4-7",
    async (event) => {
      try {
        await processRounds();
      } catch (error) {
        logger.error("Error in tournament rounds processing...: ", error);
      }
    },
);

exports.finishBets = onSchedule("every thursday 03:00", async (event) => {
  const date = new Date();
  const year = date.getFullYear().toString();
  try {
    const activeTournament = await getActiveTournament(year);
    if (activeTournament.length > 0) {
      const activeTournamentId = activeTournament[0];
      const docSnap = await db
          .collection("I_Torneos")
          .doc(year)
          .collection("Tournaments")
          .doc(activeTournamentId)
          .get();

      if (docSnap.exists) {
        docSnap.ref.update({
          apuestas: 0,
        });
        console.log("Apuestas deactivated for active tournament");
      } else {
        console.log("No document found");
        return;
      }
    } else {
      console.log("Error fetching active tournament inside finish bets");
      return;
    }
  } catch (error) {
    console.error("Error closing the bets: ", error);
    return;
  }
});

exports.updateRankings = onSchedule("every monday 00:00", async (event) => {
  try {
    const date = new Date();
    const year = date.getFullYear();
    const statId = "186";

    const rankings = await fetchRankings(year, statId);

    for (const player of rankings) {
      const playerDocRef = db
          .collection("I_MaestroJugadores")
          .doc(player.playerId);
      await playerDocRef.set(
          {
            lastname: player.lastName,
            firstname: player.firstName,
            name: player.fullName,
            ranking: player.rank,
          },
          {merge: true},
      );
    }
    console.log("Rankings updated successfully");
  } catch (error) {
    console.error("Error fetching or updating rankings", error);
    return;
  }
});

exports.activateTournament = onSchedule("every monday 17:00", async (event) => {
  const date = new Date();
  const year = date.getFullYear().toString();
  try {
    const activeTournament = await getActiveTournament(year);
    if (activeTournament.length > 0) {
      const activeTournamentId = activeTournament[0];
      const docSnap = await db
          .collection("I_Torneos")
          .doc(year)
          .collection("Tournaments")
          .doc(activeTournamentId)
          .get();

      if (docSnap.exists) {
        const order = docSnap.data().order;
        await docSnap.ref.update({
          activo: 0,
        });

        console.log("Tournament desactivated! ", activeTournamentId);

        const nextTournamentId = await getNextTournament(year, order);
        const documentSnapshot = await db
            .collection("I_Torneos")
            .doc(year)
            .collection("Tournaments")
            .doc(nextTournamentId)
            .get();
        await documentSnapshot.ref.update({
          activo: 1,
          apuestas: 1,
          round1: "Not Started",
          round2: "Not Started",
          round3: "Not Started",
          round4: "Not Started",
        });
        console.log("Tournament activated ", nextTournamentId);
        const players = await fetchPlayers(1, nextTournamentId, year);
        const amountPlayers = players.length;
        const minimoApuestas = Math.floor(amountPlayers / 10);
        await documentSnapshot.ref.update({
          minimoApuestas: minimoApuestas,
        });
        await createPlayers(db, year, players, nextTournamentId);
      } else {
        console.log("No document Found.");
        return;
      }
    } else {
      console.log("No active tournaments found...");
      return;
    }
  } catch (error) {
    console.error("Error activating tournament ", error);
    throw error;
  }
});

exports.sendWeeklyReminders = onSchedule(
    "every wednesday 18:00",
    async (event) => {
      const currentYear = new Date().getFullYear().toString();
      const activeTournamentId = await getActiveTournament(currentYear);

      if (activeTournamentId.length > 0) {
        const tournamentId = activeTournamentId[0];
        try {
          const userSnapshot = await db
              .collection("I_Members")
              .where("notificationPermissionStatus", "==", "granted")
              .get();

          if (userSnapshot.empty) {
            console.log("No users found with notification permission");
            return;
          }
          console.log(`Found ${userSnapshot.size} 
            users with notification permissions`);

          const usersMadeBet = await getApuestasUsers(currentYear,
              tournamentId);
          const usersWhoBetSet = new Set(usersMadeBet);

          const messages = [];
          let remindersSent = 0;

          for (const userDoc of userSnapshot.docs) {
            const userId = userDoc.id;
            if (!usersWhoBetSet.has(userId)) {
              const userData = userDoc.data();
              const pushToken = userData.expoPushToken;

              if (pushToken && Expo.isExpoPushToken(pushToken)) {
                messages.push({
                  to: pushToken,
                  sound: "default",
                  body: "Players selection for this tournament ends soon!",
                  data: {withSome: "data"},
                });
                remindersSent++;
              } else {
                console.warn(`Invalid or missing Expo push token for user ${userId}`);
              }
            }
          }
          if (messages.length === 0) {
            console.log
            ("No users need betting reminders (everyone has bet or no valid tokens)");
            return;
          }

          console.log(`Sending ${messages.length} bet reminder notifications...`);

          const chunks = expo.chunkPushNotifications(messages);
          const tickets = [];

          for (const chunk of chunks) {
            try {
              const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
              tickets.push(...ticketChunk);
              console.log(`Sent chunk of ${chunk.length} notifications`);
            } catch (error) {
              console.error("Error sending notification chunk:", error);
            }
          }

          // Handle any errors in tickets
          let successCount = 0;
          for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            if (ticket.status === "error") {
              console.error(`Error in ticket ${i}:`, ticket.message);
              if (ticket.details && ticket.details.error === "DeviceNotRegistered") {
                console.log(`Push token is no longer valid for a user`);
              }
            } else if (ticket.status === "ok") {
              successCount++;
            }
          }

          console.log(`Weekly reminder job completed:`);
          console.log(`- Users with notification permission: ${userSnapshot.size}`);
          console.log(`- Users who already bet: ${usersMadeBet.length}`);
          console.log(`- Reminders sent: ${messages.length}`);
          console.log(`- Successful deliveries: ${successCount}`);

          return {
            success: true,
            totalUsersWithPermission: userSnapshot.size,
            usersWhoBet: usersMadeBet.length,
            remindersSent: messages.length,
            successfulDeliveries: successCount,
          };
        } catch (error) {
          console.error("Error sending weekly reminders: ", error);
        }
      } else {
        console.log("No active tournament found");
        return;
      }
    },
);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started
