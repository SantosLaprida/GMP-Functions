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
const {fetchPlayers} = require("./api/golfApi");
const {getActiveTournament} = require("./utils/utils");
const {getNextTournament} = require("./utils/utils");
const {createPlayers} = require("./utils/utils");
// const {initializeApp} = require("firebase-admin/app");


const db = getFirestore();

exports.updateRankings = onSchedule("every monday 00:00", async (event) => {
  try {
    const date = new Date();
    const year = date.getFullYear();
    const statId = "186";

    const rankings = await fetchRankings(year, statId);

    for (const player of rankings) {
      const playerDocRef = db.collection("I_MaestroJugadores").
          doc(player.playerId);
      await playerDocRef.set({
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
      const docSnap = await db.collection("I_Torneos").doc(year).
          collection("Tournaments").doc(activeTournamentId).get();

      if (docSnap.exists) {
        const order = docSnap.data().order;
        await docSnap.ref.update({
          activo: 0,
        });

        console.log("Tournament desactivated ", activeTournamentId);

        const nextTournamentId = await getNextTournament(year, order);
        const documentSnapshot = await db.collection("I_Torneos").doc(year).
            collection("Tournaments").doc(nextTournamentId).get();
        await documentSnapshot.ref.update({
          activo: 1,
          apuestas: 1,
        });
        console.log("Tournament activated ", nextTournamentId);
        const players = await fetchPlayers(1, nextTournamentId, year);
        await createPlayers(db, year, players, nextTournamentId);
      } else {
        console.log("No document Found!");
        return;
      }
    } else {
      console.log("No active tournaments found");
      return;
    }
  } catch (error) {
    console.error("Error activating tournament ", error);
    throw error;
  }
});


// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started


