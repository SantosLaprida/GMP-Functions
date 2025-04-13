const {fetchLeaderBoard, fetchScoreCard} = require("../api/golfApi");
const {getFirestore} = require("firebase-admin/firestore");

const {compareScores, updatePlayerHoleScores} = require("./scores");
const {createIFinales} = require("./roundFour");

const db = getFirestore();

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
      playersData.push({
        id: doc.id,
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
          parseInt(p1.id),
          parseInt(p2.id),
      );

      winners.push(result.winner.toString());
      losers.push(result.loser.toString());

      console.log(`Match: ${p1.id} vs ${p2.id} -> Winner: ${result.winner}`);
    }

    await createIFinales(year, tournamentId, "I_Finales", winners);
    await createIFinales(year, tournamentId, "I_TercerCuarto", losers);

    console.log("✅ Finales created with players:", winners);
    console.log("✅ Tercer Cuarto created with players:", losers);
  } catch (error) {
    console.error("Error processing Semis results: ", error);
  }
};

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

    for (const doc of semisSnapshot.docs) {
      const playerData = doc.data();
      const playerId = playerData.playerId;
      const playerDocRef = semisRef.doc(doc.id);
      const roundId = 3;

      const scoreCard = await fetchScoreCard(1, tournamentId,
          year, playerId, roundId);

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

          console.log("Hole Updates:", holeUpdates);

          await updatePlayerHoleScores(playerId, holeUpdates,
              tournamentId, year, collectionName);
          console.log(`Updated hole scores for player 
            ${playerData.firstName} ${playerData.lastName}`);

          if (playerScoreCard.roundComplete === true) {
            await playerDocRef.update({
              roundComplete: true,
            });
            console.log(`Round complete updated for player 
              ${playerData.firstName} ${playerData.lastName}`);
          }
        } else {
          console.log(`No hole scores available for player 
            ${playerData.firstName} ${playerData.lastName}`);
        }
      } else {
        console.log(`No scorecard data available for player`);
        console.log(` ${playerData.firstName} ${playerData.lastName}`);
      }
    }

    if (roundStatus === "Complete" || roundStatus === "Suspended" ||
      roundStatus === "Official") {
      const tournamentRef = db.collection("I_Torneos").doc(year).
          collection("Tournaments").doc(tournamentId);
      await tournamentRef.update({
        round3: "Complete",
      });
      console.log("Round 3 marked as Complete.");
      await processSemisResults(year, tournamentId, collectionName);
    }

    console.log("Round 3 processed successfully.");
  } catch (error) {
    console.error("Error processing round 2: ", error);
  }
};

module.exports = {createISemifinales, processRoundThree, processSemisResults};
