const {getFirestore} = require("firebase-admin/firestore");
const admin = require("firebase-admin");
// const {Timestamp} = admin.firestore;

const db = getFirestore();


exports.getLogoByPlayerId = async (playerId) => {
  try {
    const id = String(playerId);
    const playerDoc = await db.collection("I_MaestroJugadores").
        doc(id).get();

    if (playerDoc.exists) {
      const data = playerDoc.data();
      return data.logo;
    } else {
      console.log("No document found with ", playerId, " In Maestro Jugadores");
      return;
    }
  } catch (error) {
    console.error("Error fetching logo by playerId: ", error);
    return;
  }
};

exports.getActiveTournament = async (year) => {
  try {
    const querySnap = await db.collection("I_Torneos").
        doc(year).collection("Tournaments")
        .where("activo", "==", 1).get();
    if (querySnap.empty) {
      console.log("No active tournament found");
      return [];
    }

    return querySnap.docs.map((doc) => doc.id);
  } catch (error) {
    console.error("Error getting active tournament ", error);
    return;
  }
};

exports.getNextTournament = async (year, order) => {
  try {
    const querySnap = await db.collection("I_Torneos").doc(year)
        .collection("Tournaments")
        .where("order", ">", order)
        .orderBy("order")
        .limit(3)
        .get();

    if (querySnap.empty) {
      console.log("No Upcoming tournaments found.");
      return;
    }

    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (const doc of querySnap.docs) {
      const data = doc.data();

      if (!data.activation_date ||
        !(data.activation_date instanceof admin.firestore.Timestamp)) {
        continue;
      }

      const activationDate = data.activation_date.toDate();
      const diff = Math.abs(activationDate.getTime() - now.getTime());

      if (diff <= oneDayMs) {
        return doc.id;
      }
    }

    console.log("No tournament matched the activation date range.");
    return null;
  } catch (error) {
    console.error("Error fetching the next tournament ", error);
    return;
  }
};


exports.createPlayers = async (db, year, players, tournamentId) => {
  try {
    const tournamentDocRef = db.collection("I_Torneos").doc(year)
        .collection("Tournaments").doc(tournamentId);
    const playerDocs = await db.collection("I_MaestroJugadores")
        .get();

    const playerRanks = {};
    const playerLogos = {};
    playerDocs.forEach((doc) => {
      const playerId = doc.id;
      playerRanks[playerId] = doc.data().ranking || 0;
      playerLogos[playerId] = doc.data().logo;
    });

    for (const player of players) {
      const playerId = player.playerId;
      const rank = playerRanks[playerId] || 0;
      const logo = playerLogos[playerId] || "";

      const playerData = {
        firstName: player.firstName,
        lastName: player.lastName,
        name: `${player.firstName} ${player.lastName}`,
        idPlayer: playerId,
        apuestas: 0,
        rank: rank,
        logo: logo,
      };

      await tournamentDocRef.collection("I_Players").doc(playerId).
          set(playerData);
    }
    console.log("All players created successfully!");
  } catch (error) {
    console.error("Problem creating I_Players", error);
  }
};


exports.getClassificationOrder = async (year, tournamentId, playerId) => {
  try {
    const querySnapshot = await db.collection("I_Torneos").
        doc(year).collection("Tournaments").
        doc(tournamentId).collection("I_Cuartos").doc(playerId).get();

    if (querySnapshot.empty) {
      console.log("Collection is empty");
      return;
    }

    const playerData = querySnapshot.data();
    return playerData.order;
  } catch (error) {
    console.error("Error fetching player order:", error);
    throw error;
  }
};


// node testGetActiveTournament.js
