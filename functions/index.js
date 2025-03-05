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
const {getFirestore} = require("firebase-admin/firestore");
const {fetchRankings} = require("./api/golfApi");
// const {initializeApp} = require("firebase-admin/app");

admin.initializeApp();

const db = getFirestore();

exports.updateRankings = onSchedule("every day 00:00", async (event) => {
  try {
    const year = "2025";
    const statId = "186";

    const rankings = await fetchRankings(year, statId);

    for (const player of rankings) {
      const playerDocRef = db.collection("I_MaestroJugadores").
          doc(player.id);
      await playerDocRef.update({
        lastname: player.lastname,
        firstname: player.firstname,
        name: player.firstname + " " + player.lastname,
        ranking: player.rank,
      });
    }
    console.log("Rankings updated successfully");
  } catch (error) {
    console.error("Error fetching or updating rankings", error);
  }
});


// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started


