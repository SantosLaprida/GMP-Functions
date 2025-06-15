const {getFirestore} = require("firebase-admin/firestore");
const db = getFirestore();

const {compareScores} = require("./scores");

const processSemisResults = async (year, tournamentId, collectionName) => {
  try {
    const collectionRef = db
        .collection("I_Torneos")
        .doc(year)
        .collection("Tournaments")
        .doc(tournamentId)
        .collection(collectionName);

    const snapshot = await collectionRef.get();
    if (snapshot.empty) {
      console.warn("No players found in collection:", collectionName);
      return;
    }

    const playersData = [];
    snapshot.forEach((doc) => {
      const data = doc.data();

      if (!data.playerId) {
        console.error("❌ Missing playerId in document!", {docId: doc.id});
      }


      playersData.push({
        id: data.playerId,
        order: data.order,
        data: data,
      });
    });

    if (playersData.length !== 4) {
      console.error("Expected 4 players in this round, but got",
          playersData.length);
      return;
    }
    playersData.sort((a, b) => a.order - b.order);

    const matchups = [
      [0, 3], // 1 vs 4
      [1, 2], // 2 vs 3
    ];

    const winners = [];
    const losers = [];

    for (const [i1, i2] of matchups) {
      const p1 = playersData[i1];
      const p2 = playersData[i2];

      const result = await compareScores(
          p1.data,
          p2.data,
          p1.id,
          p2.id,
      );


      winners.push(result.winner.toString());
      losers.push(result.loser.toString());
    }

    await createIFinales(year, tournamentId, "I_Finales", winners);
    await createIFinales(year, tournamentId, "I_TercerCuarto", losers);

    console.log("✅ Finales created with players:", winners);
    console.log("✅ Tercer Cuarto created with players:", losers);
  } catch (error) {
    console.error("Error processing Semis results: ", error);
  }
};

const createIFinales = async (year,
    tournamentId, collectionName, players) => {
  if (!Array.isArray(players) || players.length !== 2) {
    console.error("Player array must contain exactly 2 player IDs.");
    return;
  }
  const basePath = db
      .collection("I_Torneos")
      .doc(year)
      .collection("Tournaments")
      .doc(tournamentId);

  const sourceCollection = basePath.collection("I_Semifinales");
  const targetCollection = basePath.collection(collectionName);

  for (let i = 0; i < players.length; i++) {
    const playerId = players[i].toString();

    try {
      const docSnap = await sourceCollection.doc(playerId).get();

      if (!docSnap.exists) {
        console.warn(`Player ${playerId} not found in I_Semifinales.`);
        continue;
      }

      const sourceData = docSnap.data();

      const newData = {};

      for (const key in sourceData) {
        if (!key.startsWith("H") && key !== "order") {
          newData[key] = sourceData[key];
        }
      }

      for (let h = 1; h <= 18; h++) {
        const holeKey = `H${h.toString().padStart(2, "0")}`;
        newData[holeKey] = 0;
      }

      newData.order = i + 1;

      await targetCollection.doc(playerId).set(newData);
    } catch (error) {
      console.error(`❌ Error processing player ${playerId}:`, error);
    }
  }
};

module.exports = {
  processSemisResults,
  createIFinales,
};
