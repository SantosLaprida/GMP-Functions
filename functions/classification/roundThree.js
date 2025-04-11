const {fetchLeaderBoard, fetchScoreCard} = require("../api/golfApi");
const {getFirestore} = require("firebase-admin/firestore");

const {updatePlayerHoleScores} = require("./scores");

const db = getFirestore();

const createISemifinales = async (year,
    tournamentId, collectionName, players) => {
  if (!Array.isArray(players) || players.length !== 4) {
    console.error("Player array must contain exactly 4 player IDs.");
    return;
  }

  const basePath = db
      .collection("I_Torneos")
      .doc(year)
      .collection("Tournaments")
      .doc(tournamentId);

  const sourceCollection = basePath.collection("I_Cuartos");
  const targetCollection = basePath.collection(collectionName);

  for (let i = 0; i < players.length; i++) {
    const playerId = players[i].toString();

    try {
      const docSnap = await sourceCollection.doc(playerId).get();

      if (!docSnap.exists) {
        console.warn(`Player ${playerId} not found in I_Cuartos.`);
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
      console.log(`✅ Player ${playerId} added to 
        ${collectionName} with orden ${i + 1}`);
    } catch (error) {
      console.error(`❌ Error processing player ${playerId}:`, error);
    }
  }
};

const processRoundThree = async (tournamentId, year) => {
  try {
    const collectionName = "I_Semifinales";
    const leaderBoardData = await fetchLeaderBoard(1, tournamentId, year);
    const roundId = leaderBoardData.roundId;
    const roundStatus = leaderBoardData.roundStatus;
    if (roundId !== 3 || roundStatus === "Not Started") {
      console.log("The round is not In Progress or not round 3, skipping...");
      return;
    }

    const cuartosRef = db.collection("I_Torneos").doc(year).
        collection("Tournaments").doc(tournamentId).
        collection("I_Cuartos");

    const cuartosSnapshot = await cuartosRef.get();

    if (cuartosSnapshot.empty) {
      console.log("No players in I_Cuartos");
      console.log("Skipping round three processing.");
      return;
    }

    const semisRef = db.collection("I_Torneos").doc(year)
        .collection("Tournaments").doc(tournamentId)
        .collection("I_Cuartos");

    const semisSnapshot = await semisRef.get();

    if (semisSnapshot.empty) {
      console.log("I_Semifinales doesnt exist when processing round 3");
      console.log("Returning");
      return;
    }

    semisSnapshot.forEach(async (doc) => {
      const playerData = doc.data();
      const playerId = playerData.playerId;
      const roundId = 3;

      const scoreCard = await fetchScoreCard(1, tournamentId,
          year, playerId, roundId);
      console.log("Fetched scorecard:", scoreCard);
      console.log("Holes: ", scoreCard.holes);

      if (scoreCard && scoreCard.holes) {
        await updatePlayerHoleScores(playerId, scoreCard.holes,
            tournamentId, year, collectionName);
        console.log(`Updated hole scores for player`);
        console.log(` ${playerData.firstName} ${playerData.lastName}`);
      } else {
        console.log(`No scorecard data available for player`);
        console.log(` ${playerData.firstName} ${playerData.lastName}`);
      }
    });

    console.log("Round 3 processed successfully.");
  } catch (error) {
    console.error("Error processing round 2: ", error);
  }
};

module.exports = {createISemifinales, processRoundThree};
