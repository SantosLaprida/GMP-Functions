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
const {fetchRankings} = require("./api/golfApi");
// const {initializeApp} = require("firebase-admin/app");

const db = getFirestore();


exports.updateRankings = onSchedule({
  schedule: "every sunday 02:30",
}, async (event) => {
  try {
    const date = new Date();
    const year = date.getFullYear();
    const statId = "186";

    const rankings = await fetchRankings(year, statId);

    for (const player of rankings) {
      const playerDocRef = db.collection("I_MaestroJugadores")
          .doc(player.playerId);
      await playerDocRef.set({
        lastname: player.lastName,
        firstname: player.firstName,
        name: player.fullName,
        ranking: player.rank,
      }, {merge: true});
    }
    console.log("Rankings updated successfully!");
    return null;
  } catch (error) {
    console.error("Error fetching or updating rankings", error);
    return null;
  }
});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started


