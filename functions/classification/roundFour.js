const {fetchLeaderBoard, fetchScoreCard} = require("../api/golfApi");
const {getFirestore} = require("firebase-admin/firestore");

const {updatePlayerHoleScores} = require("./scores");

const db = getFirestore();

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
      console.log(`✅ Player ${playerId} added to 
            ${collectionName} with orden ${i + 1}`);
    } catch (error) {
      console.error(`❌ Error processing player ${playerId}:`, error);
    }
  }
};

const processRoundFour = async (tournamentId, year) => {
  try {
    const collectionNameWinners = "I_Finales";
    const collectionNameLosers = "I_TercerCuarto";

    const leaderBoardData = await fetchLeaderBoard(1, tournamentId, year);
    const roundId = leaderBoardData.roundId;
    const roundStatus = leaderBoardData.roundStatus;

    if (roundId !== 4 || roundStatus === "Not Started") {
      console.log("The round is not In Progress or not round 4, skipping...");
      return;
    }

    const baseRef = db.collection("I_Torneos").doc(year)
        .collection("Tournaments").doc(tournamentId);

    const finalesRef = baseRef.collection(collectionNameWinners);
    const tercerCuartoRef = baseRef.collection(collectionNameLosers);

    const finalesSnapshot = await finalesRef.get();
    const tercerCuartoSnapshot = await tercerCuartoRef.get();

    if (finalesSnapshot.empty || tercerCuartoSnapshot.empty) {
      console.warn("Finales or TercerCuarto collection is missing.");
      return;
    }

    const allSnapshots = [
      {snapshot: finalesSnapshot, collectionName: collectionNameWinners},
      {snapshot: tercerCuartoSnapshot, collectionName: collectionNameLosers},
    ];

    for (const {snapshot, collectionName} of allSnapshots) {
      for (const doc of snapshot.docs) {
        const playerData = doc.data();
        const playerId = playerData.playerId;
        const playerDocRef = baseRef.collection(collectionName).doc(doc.id);

        const scoreCard = await fetchScoreCard(1, tournamentId,
            year, playerId, 4);

        if (scoreCard && scoreCard.length > 0) {
          const playerScoreCard = scoreCard[0];
          const holes = playerScoreCard.holes;

          if (holes) {
            const holeUpdates = {};
            Object.keys(holes).forEach((holeNumber) => {
              const hole = holes[holeNumber];
              const holeField = `H${String(holeNumber).padStart(2, "0")}`;
              holeUpdates[holeField] = hole.holeScore;
            });

            await updatePlayerHoleScores(playerId, holeUpdates,
                tournamentId, year, collectionName);
            console.log(`Updated hole scores for player 
                ${playerData.firstName} ${playerData.lastName}`);

            if (playerScoreCard.roundComplete === true) {
              await playerDocRef.update({roundComplete: true});
              console.log(`Marked roundComplete for 
                ${playerData.firstName} ${playerData.lastName}`);
            }
          } else {
            console.log(`No holes available for player 
                ${playerData.firstName} ${playerData.lastName}`);
          }
        } else {
          console.log(`No scorecard data found for player 
            ${playerData.firstName} ${playerData.lastName}`);
        }
      }
    }
    if (["Complete", "Suspended", "Official"].includes(roundStatus)) {
      await baseRef.update({round4: "Complete"});
      console.log("✅ Round 4 marked as Complete.");
    } else {
      console.log("Round 4 still in progress.");
    }

    console.log("✅ Round 4 processed successfully.");
  } catch (error) {
    console.error("❌ Error processing round 4: ", error);
  }
};

module.exports = {createIFinales, processRoundFour};
