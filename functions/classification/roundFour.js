const {fetchLeaderBoard, fetchScoreCard} = require("../api/golfApi");
const {compareScores} = require("./scores");
const {getFirestore} = require("firebase-admin/firestore");

const {updatePlayerHoleScores} = require("./scores");
const {processSemisResults} = require("./resultsProcessing");

const db = getFirestore();

const createIResultados = async (year, tournamentId) => {
  const basePath = db
      .collection("I_Torneos")
      .doc(year)
      .collection("Tournaments")
      .doc(tournamentId);

  const resultadosRef = basePath.collection("I_Resultados");
  const finalesRef = basePath.collection("I_Finales");
  const tercerCuartoRef = basePath.collection("I_TercerCuarto");

  try {
    const finalesSnapshot = await finalesRef.get();
    const tercerCuartoSnapshot = await tercerCuartoRef.get();

    if (finalesSnapshot.size !== 2 || tercerCuartoSnapshot.size !== 2) {
      console.error("Expected exactly 2 players in each collection.");
      return;
    }

    const finales = finalesSnapshot.docs.map((doc) => ({
      ...doc.data(),
      playerId: doc.id,
    }));
    const tercerCuarto = tercerCuartoSnapshot.docs.map((doc) => ({
      ...doc.data(),
      playerId: doc.id,
    }));

    const resultFinal = await compareScores(
        finales[0],
        finales[1],
        parseInt(finales[0].playerId),
        parseInt(finales[1].playerId),
    );

    const resultThird = await compareScores(
        tercerCuarto[0],
        tercerCuarto[1],
        parseInt(tercerCuarto[0].playerId),
        parseInt(tercerCuarto[1].playerId),
    );

    const rankings = [
      {rank: 1, playerId: resultFinal.winner},
      {rank: 2, playerId: resultFinal.loser},
      {rank: 3, playerId: resultThird.winner},
      {rank: 4, playerId: resultThird.loser},
    ];

    for (const {rank, playerId} of rankings) {
      const playerDoc = await db.collection("I_MaestroJugadores").
          doc(playerId.toString()).get();

      if (!playerDoc.exists) {
        console.warn(`Player ${playerId} not found in I_MaestroJugadores`);
        continue;
      }

      const playerData = playerDoc.data();

      await resultadosRef.doc(playerId.toString()).set({
        playerId,
        rank,
        name: playerData.name || "",
        logo: playerData.logo || "",
      });

      console.log(`Stored player ${playerId} as rank ${rank}`);
    }

    console.log("🏁 I_Resultados created successfully.");
  } catch (error) {
    console.error("❌ Error creating I_Resultados:", error);
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
      console.log("Creating I_Finales and I_TercerCuarto collections...");
      await processSemisResults(year, tournamentId, "I_Semifinales");
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
      await createIResultados(year, tournamentId);
      console.log("✅ Round 4 marked as Complete.");
    } else {
      console.log("Round 4 still in progress.");
    }

    console.log("✅ Round 4 processed successfully.");
  } catch (error) {
    console.error("❌ Error processing round 4: ", error);
  }
};

module.exports = {processRoundFour, createIResultados};
